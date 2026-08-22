"""Structural fallback backend: regex tokenization plus indent/brace tracking.

Used when the optional tree-sitter packages are unavailable. Produces the same
metric contract (symbols, imports, cyclomatic complexity) under a documented
heuristic rule set, so consumers never depend on the active mode.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

from ast_analyzer.model import BackendResult, LanguageTag, Symbol
from ast_analyzer.textutils import clean_param, split_top_level

_TAB_WIDTH = 4

_PY_HEADER = re.compile(r"^[ \t]*(?:async[ \t]+)?(?P<kw>def|class)[ \t]+(?P<name>[A-Za-z_]\w*)")
_PY_IMPORT = re.compile(r"^\s*import\s+(?P<modules>.+?)\s*$")
_PY_FROM = re.compile(r"^\s*from\s+(?P<module>[.\w]+)\s+import\b")

_TS_FUNC = re.compile(
    r"(?:(?:export|default|async)\s+)*function\s*\*?\s*(?P<name>[A-Za-z_$][\w$]*)\s*\("
)
_TS_CLASS = re.compile(
    r"(?:(?:export|default|abstract)\s+)*class\s+(?P<name>[A-Za-z_$][\w$]*)[^{;=]*\{"
)
_TS_ARROW = re.compile(
    r"\b(?:const|let|var)\s+(?P<name>[A-Za-z_$][\w$]*)\s*(?::[^=\n]+?)?=\s*"
    r"(?:async\s+)?(?P<head>\((?:[^()]|\([^()]*\))*\)|[A-Za-z_$][\w$]*)"
    r"(?::[^=\n]+?)?=>"
)
_TS_METHOD = re.compile(
    r"(?m)^[ \t]*(?:(?:public|private|protected|static|readonly|async|override|get|set)[ \t]+)*"
    r"(?P<name>[A-Za-z_$][\w$]*)[ \t]*(?P<params>\((?:[^()]|\([^()]*\))*\))"
    r"[ \t]*(?::[ \t]*[^{;=\n]+)?\{"
)
_METHOD_BLACKLIST = frozenset(
    {"if", "for", "while", "switch", "catch", "return", "new", "typeof", "function", "do", "else"}
)

_GO_FUNC = re.compile(
    r"(?m)^[ \t]*func\s+(?:\((?P<recv>[^)]*)\)[ \t]*)?(?P<name>[A-Za-z_]\w*)[ \t]*(?:\[[^\]]*\][ \t]*)?\(",
)

_TS_IMPORTS: tuple[re.Pattern[str], ...] = (
    re.compile(r"\bimport\s+[\w*\s{},$]*?\bfrom\s+['\"](?P<mod>[^'\"]+)['\"]"),
    re.compile(r"\bimport\s+['\"](?P<mod>[^'\"]+)['\"]"),
    re.compile(r"\bexport\s+[\w*\s{},$]*?\bfrom\s+['\"](?P<mod>[^'\"]+)['\"]"),
    re.compile(r"\brequire\s*\(\s*['\"](?P<mod>[^'\"]+)['\"]"),
    re.compile(r"\bimport\s*\(\s*['\"](?P<mod>[^'\"]+)['\"]"),
)
_GO_SINGLE_IMPORT = re.compile(r"\bimport\s+(?:\w+\s+)?\"(?P<mod>[^\"]+)\"")
_GO_BLOCK_IMPORT = re.compile(r"\bimport\s*\((?P<body>[^)]*)\)")

_DECISION_TOKENS: dict[str, re.Pattern[str]] = {
    "py": re.compile(r"\b(?:if|elif|for|while|except|assert|case|and|or)\b"),
    "ts": re.compile(r"\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|\?(?![.?])"),
    "tsx": re.compile(r"\b(?:if|for|while|case|catch)\b|&&|\|\||\?\?|\?(?![.?])"),
    "go": re.compile(r"\b(?:if|for|case)\b|&&|\|\|"),
}


@dataclass(frozen=True)
class _RawSymbol:
    name: str
    kind: str
    start: int  # char offset of the header token
    end: int  # char offset one past the block end
    line: int  # 1-based start line
    end_line: int  # 1-based inclusive end line
    params: list[str] = field(default_factory=list)


def mask_source(text: str, language: LanguageTag) -> str:
    """Blank out comments and string literals preserving length and newlines."""
    chars = list(text)
    length = len(text)
    i = 0

    def blank(start: int, stop: int) -> None:
        for pos in range(start, min(stop, length)):
            if chars[pos] != "\n":
                chars[pos] = " "

    while i < length:
        ch = text[i]
        nxt = text[i + 1] if i + 1 < length else ""
        if ch == "\\":
            chars[i] = " "
            if nxt and nxt != "\n":
                chars[i + 1] = " "
            i += 2
            continue
        if (language == "py" and ch == "#") or (language != "py" and ch == "/" and nxt == "/"):
            end = text.find("\n", i)
            end = length if end == -1 else end
            blank(i, end)
            i = end
            continue
        if language != "py" and ch == "/" and nxt == "*":
            close = text.find("*/", i + 2)
            close = length if close == -1 else close + 2
            blank(i, close)
            i = close
            continue
        if ch in "\"'`":
            triple = language == "py" and text[i : i + 3] == ch * 3
            j = i + (3 if triple else 1)
            while j < length:
                cj = text[j]
                if cj == "\\" and ch != "`" and j + 1 < length:
                    j += 2
                    continue
                if cj == "\n" and not triple and ch != "`":
                    break
                if triple:
                    if text[j : j + 3] == ch * 3:
                        j += 3
                        break
                    j += 1
                    continue
                if cj == ch:
                    j += 1
                    break
                j += 1
            blank(i, j)
            i = max(j, i + 1)
            continue
        i += 1
    return "".join(chars)


def _line_starts(text: str) -> list[int]:
    starts = [0]
    for idx, char in enumerate(text):
        if char == "\n":
            starts.append(idx + 1)
    return starts


def _offset_to_line(starts: list[int], offset: int) -> int:
    low, high = 0, len(starts) - 1
    while low < high:
        mid = (low + high + 1) // 2
        if starts[mid] <= offset:
            low = mid
        else:
            high = mid - 1
    return low + 1


def _visual_indent(line: str) -> int:
    width = 0
    for char in line:
        if char == " ":
            width += 1
        elif char == "\t":
            width += _TAB_WIDTH - (width % _TAB_WIDTH)
        else:
            return width
    return len(line)


def _match_paren(text: str, open_pos: int) -> int | None:
    depth = 0
    for idx in range(open_pos, len(text)):
        if text[idx] == "(":
            depth += 1
        elif text[idx] == ")":
            depth -= 1
            if depth == 0:
                return idx
    return None


def _brace_block_end(masked: str, open_pos: int) -> int | None:
    depth = 0
    for idx in range(open_pos, len(masked)):
        if masked[idx] == "{":
            depth += 1
        elif masked[idx] == "}":
            depth -= 1
            if depth == 0:
                return idx
    return None


def _normalize_ws(raw: str) -> str:
    return re.sub(r"\s+", " ", raw).strip()


def _python_params(masked: str, search_from: int) -> list[str]:
    paren_open = masked.find("(", search_from)
    paren_close = _match_paren(masked, paren_open) if paren_open != -1 else None
    if paren_close is None:
        return []
    inner = _normalize_ws(masked[paren_open + 1 : paren_close])
    names: list[str] = []
    for part in split_top_level(inner):
        cleaned = clean_param(part)
        if cleaned:
            names.append(cleaned)
    return names


def _braced_params(raw: str, language: LanguageTag) -> list[str]:
    normalized = _normalize_ws(raw)
    if not normalized:
        return []
    names: list[str] = []
    for part in split_top_level(normalized):
        if language == "go":
            tokens = part.split()
            first = tokens[0] if tokens else ""
            if re.fullmatch(r"[A-Za-z_]\w*", first):
                names.append(first)
            continue
        part = re.sub(r"^(?:(?:public|private|protected|readonly)\s+)+", "", part)
        cleaned = clean_param(part)
        if cleaned:
            names.append(cleaned)
    return names


def _scan_python(masked: str) -> tuple[list[_RawSymbol], list[str]]:
    symbols: list[_RawSymbol] = []
    imports: list[str] = []
    lines = masked.split("\n")
    offsets = [0]
    for line in lines[:-1]:
        offsets.append(offsets[-1] + len(line) + 1)

    scopes: list[tuple[int, str]] = []
    for lineno, line in enumerate(lines):
        header = _PY_HEADER.match(line)
        if header is None:
            from_match = _PY_FROM.match(line)
            if from_match is not None:
                imports.append(from_match.group("module"))
                continue
            plain = _PY_IMPORT.match(line)
            if plain is not None:
                for module in split_top_level(plain.group("modules")):
                    module = re.sub(r"\s+as\s+\w+$", "", module).strip()
                    if module:
                        imports.append(module)
            continue

        indent = _visual_indent(line[: header.start("kw")])
        while scopes and scopes[-1][0] >= indent:
            scopes.pop()
        keyword = header.group("kw")
        kind = "class" if keyword == "class" else "function"
        if keyword == "def" and scopes and scopes[-1][1] == "class":
            kind = "method"

        end_exclusive = len(lines)
        for probe in range(lineno + 1, len(lines)):
            if lines[probe].strip() and _visual_indent(lines[probe]) <= indent:
                end_exclusive = probe
                break
        last_included = end_exclusive - 1
        while last_included > lineno and not lines[last_included].strip():
            last_included -= 1
        end_offset = offsets[last_included] + len(lines[last_included])

        params = (
            [] if keyword == "class" else _python_params(masked, offsets[lineno] + header.end())
        )
        symbols.append(
            _RawSymbol(
                name=header.group("name"),
                kind=kind,
                start=offsets[lineno],
                end=end_offset,
                line=lineno + 1,
                end_line=last_included + 1,
                params=params,
            )
        )
        scopes.append((indent, kind))
    return symbols, imports


def _scan_braced(
    masked: str, raw: str, language: LanguageTag
) -> tuple[list[_RawSymbol], list[str]]:
    starts = _line_starts(masked)
    entries: dict[int, _RawSymbol] = {}

    def add(entry: _RawSymbol) -> None:
        entries[entry.start] = entry

    func_pattern = _TS_FUNC if language in ("ts", "tsx") else _GO_FUNC
    for match in func_pattern.finditer(masked):
        name = match.group("name")
        if name is None:
            continue
        paren_open = masked.find("(", match.end() - 1)
        paren_close = _match_paren(masked, paren_open) if paren_open != -1 else None
        if paren_close is None:
            continue
        body_open = masked.find("{", paren_close)
        body_close = _brace_block_end(masked, body_open) if body_open != -1 else None
        if body_close is None:
            continue
        if language == "go":
            kind = "method" if match.group("recv") is not None else "function"
        else:
            kind = "function"
        add(
            _RawSymbol(
                name=name,
                kind=kind,
                start=match.start(),
                end=body_close + 1,
                line=_offset_to_line(starts, match.start()),
                end_line=_offset_to_line(starts, body_close),
                params=_braced_params(masked[paren_open + 1 : paren_close], language),
            )
        )

    if language in ("ts", "tsx"):
        for match in _TS_CLASS.finditer(masked):
            body_open = masked.find("{", match.end() - 1)
            body_close = _brace_block_end(masked, body_open) if body_open != -1 else None
            if body_close is None:
                continue
            add(
                _RawSymbol(
                    name=match.group("name"),
                    kind="class",
                    start=match.start(),
                    end=body_close + 1,
                    line=_offset_to_line(starts, match.start()),
                    end_line=_offset_to_line(starts, body_close),
                )
            )
        whole = _RawSymbol(
            name="<module>", kind="module", start=0, end=len(masked), line=1, end_line=len(starts)
        )
        for arrow in _ts_arrows(masked, starts, whole):
            add(arrow)
        classes = sorted(
            (entry for entry in entries.values() if entry.kind == "class"),
            key=lambda entry: entry.start,
        )
        for klass in classes:
            for method_entry in _ts_methods(masked, starts, klass, entries):
                add(method_entry)

    ordered = [entries[offset] for offset in sorted(entries)]
    return ordered, _braced_imports(raw, language)


def _ts_arrows(masked: str, starts: list[int], scope: _RawSymbol) -> list[_RawSymbol]:
    found: list[_RawSymbol] = []
    for match in _TS_ARROW.finditer(masked, scope.start, scope.end):
        head = match.group("head")
        arrow_pos = match.end() - 2
        if head.startswith("("):
            close = _match_paren(masked, match.start("head"))
            if close is None:
                continue
            params_raw = masked[match.start("head") + 1 : close]
        else:
            params_raw = head

        body_open = masked.find("{", arrow_pos)
        brace_ok = False
        if body_open != -1 and body_open < scope.end:
            between = masked[arrow_pos + 2 : body_open]
            brace_ok = not any(char.isalnum() or char in "_$" for char in between)
        if brace_ok:
            body_close = _brace_block_end(masked, body_open)
            if body_close is None or body_close >= scope.end:
                continue
            end_offset = body_close + 1
        else:
            newline = masked.find("\n", arrow_pos)
            end_offset = newline + 1 if newline != -1 else scope.end

        found.append(
            _RawSymbol(
                name=match.group("name"),
                kind="function",
                start=match.start(),
                end=end_offset,
                line=_offset_to_line(starts, match.start()),
                end_line=_offset_to_line(starts, end_offset - 1),
                params=_braced_params(params_raw, "ts"),
            )
        )
    return found


def _ts_methods(
    masked: str,
    starts: list[int],
    klass: _RawSymbol,
    existing: dict[int, _RawSymbol],
) -> list[_RawSymbol]:
    body_open = masked.find("{", klass.start)
    if body_open == -1 or body_open >= klass.end:
        return []
    covered = {(entry.line, entry.name) for entry in existing.values()}
    found: list[_RawSymbol] = []
    for match in _TS_METHOD.finditer(masked, body_open + 1, klass.end):
        name = match.group("name")
        if name in _METHOD_BLACKLIST:
            continue
        line_no = _offset_to_line(starts, match.start())
        if (line_no, name) in covered:
            continue
        body_pos = masked.find("{", match.start("params"))
        body_close = _brace_block_end(masked, body_pos) if body_pos != -1 else None
        if body_close is None or body_close >= klass.end:
            continue
        found.append(
            _RawSymbol(
                name=name,
                kind="method",
                start=match.start(),
                end=body_close + 1,
                line=line_no,
                end_line=_offset_to_line(starts, body_close),
                params=_braced_params(match.group("params")[1:-1], "ts"),
            )
        )
    return found


def _braced_imports(raw: str, language: LanguageTag) -> list[str]:
    modules: list[str] = []
    if language == "go":
        for single in _GO_SINGLE_IMPORT.finditer(raw):
            modules.append(single.group("mod"))
        block = _GO_BLOCK_IMPORT.search(raw)
        if block is not None:
            modules.extend(re.findall(r'"([^"]+)"', block.group("body")))
        return sorted(dict.fromkeys(modules))

    seen: set[str] = set()
    for pattern in _TS_IMPORTS:
        for match in pattern.finditer(raw):
            module = match.group("mod")
            if module not in seen:
                seen.add(module)
                modules.append(module)
    return modules


class FallbackBackend:
    """Regex + structure analyzer used when tree-sitter is absent."""

    name = "fallback"

    def analyze(self, text: str, language: LanguageTag) -> BackendResult:
        masked = mask_source(text, language)
        if language == "py":
            raw_symbols, imports = _scan_python(masked)
        else:
            raw_symbols, imports = _scan_braced(masked, text, language)

        pattern = _DECISION_TOKENS[language]
        counts: dict[int, int] = {}
        for match in pattern.finditer(masked):
            target: _RawSymbol | None = None
            for symbol in raw_symbols:
                if symbol.kind == "class":
                    continue
                if symbol.start <= match.start() < symbol.end:
                    target = symbol
            if target is not None:
                counts[target.line] = counts.get(target.line, 0) + 1

        ordered = sorted(raw_symbols, key=lambda item: item.line)
        symbols = tuple(
            Symbol(name=s.name, kind=s.kind, line=s.line, end=s.end_line, params=list(s.params))  # type: ignore[arg-type]
            for s in ordered
        )
        complexities = {
            symbol.line: counts.get(symbol.line, 0) + 1
            for symbol in ordered
            if symbol.kind != "class"
        }
        return BackendResult(
            symbols=symbols,
            imports=tuple(sorted(dict.fromkeys(imports))),
            complexities=complexities,
        )
