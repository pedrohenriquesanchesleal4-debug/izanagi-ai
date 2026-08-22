"""Tree-sitter powered backend (primary mode): real AST parsing for py/ts/tsx/go."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable

from ast_analyzer.model import BackendResult, LanguageTag, Symbol
from ast_analyzer.textutils import clean_param as _clean_param
from ast_analyzer.textutils import unquote

try:
    from tree_sitter import Language, Node, Parser
except ImportError as _exc:  # pragma: no cover - guarded by HAS_TREE_SITTER probe
    raise ImportError("tree-sitter is not installed") from _exc


def _lang_py() -> Language:
    import tree_sitter_python

    return Language(tree_sitter_python.language())


def _lang_ts() -> Language:
    import tree_sitter_typescript

    return Language(tree_sitter_typescript.language_typescript())


def _lang_tsx() -> Language:
    import tree_sitter_typescript

    return Language(tree_sitter_typescript.language_tsx())


def _lang_go() -> Language:
    import tree_sitter_go

    return Language(tree_sitter_go.language())


_LANG_FACTORIES: dict[str, Callable[[], Language]] = {
    "py": _lang_py,
    "ts": _lang_ts,
    "tsx": _lang_tsx,
    "go": _lang_go,
}


@dataclass
class _Record:
    kind: str
    name: str
    start_row: int
    end_row: int
    params: list[str] = field(default_factory=list)
    complexity: int = 1


_PY_DECISIONS = {
    "if_statement",
    "elif_clause",
    "for_statement",
    "while_statement",
    "except_clause",
    "boolean_operator",
    "conditional_expression",
    "assert_statement",
    "case_clause",
    "if_clause",
    "for_in_clause",
}

_TS_DECISIONS = {
    "if_statement",
    "for_statement",
    "for_in_statement",
    "while_statement",
    "catch_clause",
    "ternary_expression",
    "switch_case",
}

_GO_DECISIONS = {
    "if_statement",
    "for_statement",
    "expression_case",
    "communication_case",
}

_BINARY_NODE = "binary_expression"
_TS_CONDITIONAL_OPS = {"&&", "||", "??"}
_GO_CONDITIONAL_OPS = {"&&", "||"}


class TreeSitterBackend:
    """Primary analysis backend backed by grammatical ASTs."""

    name = "tree-sitter"

    def __init__(self) -> None:
        self._languages: dict[str, Language] = {}
        self._parsers: dict[str, Parser] = {}

    def _parser_for(self, language: LanguageTag) -> Parser:
        cached = self._parsers.get(language)
        if cached is not None:
            return cached
        lang = self._languages.get(language)
        if lang is None:
            lang = _LANG_FACTORIES[language]()
            self._languages[language] = lang
        parser = Parser(lang)
        self._parsers[language] = parser
        return parser

    def analyze(self, text: str, language: LanguageTag) -> BackendResult:
        parser = self._parser_for(language)
        tree = parser.parse(text.encode("utf-8"))
        root = tree.root_node

        records: list[_Record] = []
        imports: list[str] = []
        self._walk(root, language, (), records, imports)

        symbols = tuple(
            Symbol(
                name=rec.name,
                kind=rec.kind,  # type: ignore[arg-type]
                line=rec.start_row + 1,
                end=rec.end_row + 1,
                params=list(rec.params),
            )
            for rec in records
        )
        complexities = {rec.start_row + 1: rec.complexity for rec in records if rec.kind != "class"}
        return BackendResult(
            symbols=symbols,
            imports=tuple(sorted(dict.fromkeys(imports))),
            complexities=complexities,
        )

    # ------------------------------------------------------------------ walk

    def _walk(
        self,
        node: Node,
        language: LanguageTag,
        stack: tuple[_Record, ...],
        out: list[_Record],
        imports: list[str],
    ) -> None:
        for child in node.named_children:
            ctype = child.type
            if language == "py" and ctype == "import_statement":
                imports.extend(self._py_import_names(child))
                continue
            if language == "py" and ctype == "import_from_statement":
                mod = self._py_import_from(child)
                if mod is not None:
                    imports.append(mod)
                continue
            if language in ("ts", "tsx") and ctype == "import_statement":
                source_node = child.child_by_field_name("source")
                if source_node is not None and source_node.text:
                    imports.append(self._unquote(source_node.text.decode("utf-8")))
                continue
            if language == "go" and ctype == "import_declaration":
                imports.extend(self._go_import_paths(child))
                continue

            record = self._maybe_open_symbol(child, language, stack)
            if record is not None:
                out.append(record)
                self._walk(child, language, (*stack, record), out, imports)
                continue

            if language == "ts" and ctype == "variable_declarator" and self._ts_is_function_value(child):
                arrow = self._ts_arrow_record(child)
                if arrow is not None:
                    out.append(arrow)
                    self._walk(child, language, (*stack, arrow), out, imports)
                    continue

            if language == "ts" and ctype == "export_statement":
                self._collect_reexport(child, imports)

            if language in ("ts", "go") and ctype == _BINARY_NODE:
                ops = _TS_CONDITIONAL_OPS if language == "ts" else _GO_CONDITIONAL_OPS
                op_node = child.child_by_field_name("operator")
                if op_node is not None and op_node.text and op_node.text.decode("utf-8") in ops:
                    self._attribute(stack, 1)
                self._walk(child, language, stack, out, imports)
                continue

            if language == "ts" and ctype == "call_expression":
                req = self._ts_require_module(child)
                if req is not None:
                    imports.append(req)

            decisions = (
                _PY_DECISIONS
                if language == "py"
                else _TS_DECISIONS
                if language == "ts" or language == "tsx"
                else _GO_DECISIONS
            )
            if ctype in decisions:
                self._attribute(stack, 1)

            self._walk(child, language, stack, out, imports)

    @staticmethod
    def _attribute(stack: tuple[_Record, ...], amount: int) -> None:
        for record in reversed(stack):
            if record.kind != "class":
                record.complexity += amount
                return

    def _maybe_open_symbol(
        self, node: Node, language: LanguageTag, stack: tuple[_Record, ...]
    ) -> _Record | None:
        text_of = lambda n: n.text.decode("utf-8", errors="replace") if n.text else ""
        if language == "py":
            if node.type == "function_definition":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    return None
                innermost = stack[-1] if stack else None
                kind = "method" if innermost is not None and innermost.kind == "class" else "function"
                return _Record(
                    kind=kind,
                    name=text_of(name_node),
                    start_row=node.start_point.row,
                    end_row=node.end_point.row,
                    params=self._py_params(node),
                )
            if node.type == "class_definition":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    return None
                return _Record(
                    kind="class",
                    name=text_of(name_node),
                    start_row=node.start_point.row,
                    end_row=node.end_point.row,
                )
            return None

        if language == "go":
            if node.type == "function_declaration":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    return None
                return _Record(
                    kind="function",
                    name=text_of(name_node),
                    start_row=node.start_point.row,
                    end_row=node.end_point.row,
                    params=self._go_params(node.child_by_field_name("parameters")),
                )
            if node.type == "method_declaration":
                name_node = node.child_by_field_name("name")
                if name_node is None:
                    return None
                return _Record(
                    kind="method",
                    name=text_of(name_node),
                    start_row=node.start_point.row,
                    end_row=node.end_point.row,
                    params=self._go_params(node.child_by_field_name("parameters")),
                )
            return None

        # ts / tsx
        if node.type in ("function_declaration", "generator_function_declaration"):
            name_node = node.child_by_field_name("name")
            if name_node is None:
                return None
            return _Record(
                kind="function",
                name=text_of(name_node),
                start_row=node.start_point.row,
                end_row=node.end_point.row,
                params=self._ts_params(node.child_by_field_name("parameters")),
            )
        if node.type == "function_expression":
            name_node = node.child_by_field_name("name")
            if name_node is None:
                return None
            return _Record(
                kind="function",
                name=text_of(name_node),
                start_row=node.start_point.row,
                end_row=node.end_point.row,
                params=self._ts_params(node.child_by_field_name("parameters")),
            )
        if node.type in ("method_definition", "abstract_method_definition"):
            name_node = node.child_by_field_name("name")
            if name_node is None:
                return None
            return _Record(
                kind="method",
                name=text_of(name_node),
                start_row=node.start_point.row,
                end_row=node.end_point.row,
                params=self._ts_params(node.child_by_field_name("parameters")),
            )
        if node.type == "class_declaration":
            name_node = node.child_by_field_name("name")
            if name_node is None:
                return None
            return _Record(
                kind="class",
                name=text_of(name_node),
                start_row=node.start_point.row,
                end_row=node.end_point.row,
            )
        return None

    # ------------------------------------------------------------- ts arrows

    @staticmethod
    def _ts_is_function_value(declarator: Node) -> bool:
        value = declarator.child_by_field_name("value")
        return value is not None and value.type in ("arrow_function", "function_expression")

    def _ts_arrow_record(self, declarator: Node) -> _Record | None:
        name_node = declarator.child_by_field_name("name")
        value = declarator.child_by_field_name("value")
        if name_node is None or value is None or not name_node.text:
            return None
        params_node = value.child_by_field_name("parameters")
        return _Record(
            kind="function",
            name=name_node.text.decode("utf-8", errors="replace"),
            start_row=declarator.start_point.row,
            end_row=value.end_point.row,
            params=self._ts_params(params_node),
        )

    def _ts_params(self, parameters: Node | None) -> list[str]:
        if parameters is None:
            return []
        names: list[str] = []
        for child in parameters.named_children:
            pattern = child.child_by_field_name("pattern")
            raw = pattern.text if pattern is not None and pattern.text else child.text
            if raw is None:
                continue
            cleaned = _clean_param(raw.decode("utf-8", errors="replace"))
            if cleaned:
                names.append(cleaned)
        return names

    def _ts_require_module(self, call: Node) -> str | None:
        fn = call.child_by_field_name("function")
        args = call.child_by_field_name("arguments")
        if fn is None or args is None or not fn.text or fn.text != b"require":
            return None
        for arg in args.named_children:
            if arg.type == "string":
                return self._unquote(arg.text.decode("utf-8", errors="replace"))
        return None

    def _collect_reexport(self, export_node: Node, imports: list[str]) -> None:
        source = export_node.child_by_field_name("source")
        if source is not None and source.text:
            imports.append(self._unquote(source.text.decode("utf-8", errors="replace")))

    # ------------------------------------------------------------ py helpers

    def _py_import_names(self, node: Node) -> list[str]:
        mods: list[str] = []
        for child in node.named_children:
            if child.type == "dotted_name":
                if child.text:
                    mods.append(child.text.decode("utf-8", errors="replace"))
            elif child.type == "aliased_import":
                target = child.child_by_field_name("name")
                if target is not None and target.text:
                    mods.append(target.text.decode("utf-8", errors="replace"))
        return mods

    def _py_import_from(self, node: Node) -> str | None:
        module = node.child_by_field_name("module_name")
        if module is None or not module.text:
            return None
        return module.text.decode("utf-8", errors="replace")

    def _py_params(self, func_node: Node) -> list[str]:
        parameters = func_node.child_by_field_name("parameters")
        if parameters is None:
            return []
        names: list[str] = []
        for child in parameters.named_children:
            raw = child.text.decode("utf-8", errors="replace") if child.text else ""
            cleaned = _clean_param(raw)
            if cleaned:
                names.append(cleaned)
        return names

    # ------------------------------------------------------------- go helper

    def _go_import_paths(self, node: Node) -> list[str]:
        paths: list[str] = []

        def collect(current: Node) -> None:
            if current.type == "interpreted_string_literal" and current.text:
                paths.append(self._unquote(current.text.decode("utf-8", errors="replace")))
                return
            for child in current.named_children:
                collect(child)

        collect(node)
        return paths

    def _go_params(self, parameters: Node | None) -> list[str]:
        if parameters is None:
            return []
        names: list[str] = []
        for decl in parameters.named_children:
            identifiers = [c for c in decl.named_children if c.type == "identifier"]
            if identifiers:
                for ident in identifiers:
                    if ident.text:
                        names.append(ident.text.decode("utf-8", errors="replace"))
            elif decl.type != "," and decl.text and decl.text.strip():
                cleaned = decl.text.decode("utf-8", errors="replace").strip()
                if cleaned and not cleaned.startswith("("):
                    names.append(cleaned)
        return names

    @staticmethod
    def _unquote(raw: str) -> str:
        return unquote(raw)
