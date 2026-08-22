"""Public facade: file and directory analysis with capability negotiation."""

from __future__ import annotations

from pathlib import Path

from ast_analyzer.backends import select_backend
from ast_analyzer.chunker import make_chunks
from ast_analyzer.languages import SUPPORTED_EXTENSIONS, detect_language
from ast_analyzer.model import (
    AstAnalyzerError,
    BackendResult,
    Capabilities,
    DirError,
    DirReport,
    FileReadError,
    FileReport,
    Symbol,
    Totals,
)

_DEFAULT_GLOB = "**/*"


def _read_text(path: Path) -> str:
    try:
        raw = path.read_bytes()
    except OSError as exc:
        raise FileReadError(f"cannot read {path}: {exc}") from exc
    if b"\x00" in raw:
        raise FileReadError(f"binary content rejected: {path}")
    return raw.decode("utf-8", errors="replace")


class Analyzer:
    """Multi-language semantic analyzer over files and directory trees.

    ``prefer_tree_sitter`` selects the grammatical backend when the optional
    packages are importable; otherwise the structural fallback runs. The active
    mode is always exposed through :attr:`capabilities`.
    """

    def __init__(self, prefer_tree_sitter: bool = True) -> None:
        self._backend, tree_sitter_active = select_backend(prefer_tree_sitter)
        self._capabilities: Capabilities = {"tree_sitter": tree_sitter_active}

    @property
    def capabilities(self) -> Capabilities:
        return dict(self._capabilities)

    @property
    def backend_name(self) -> str:
        return self._backend.name

    def analyze_file(self, path: str | Path) -> FileReport:
        """Analyze one source file and return its full report."""
        target = Path(path)
        language = detect_language(target)
        text = _read_text(target)
        return self._build_report(str(target), language, text)[0]

    def analyze_dir(self, path: str | Path, glob: str | None = None) -> DirReport:
        """Analyze every supported file under ``path`` (optionally filtered by glob)."""
        root = Path(path)
        if not root.is_dir():
            raise FileReadError(f"not a directory: {root}")
        pattern = glob or _DEFAULT_GLOB
        candidates = sorted(
            candidate
            for candidate in root.glob(pattern)
            if candidate.is_file() and candidate.suffix.lower() in SUPPORTED_EXTENSIONS
        )

        files: dict[str, FileReport] = {}
        errors: list[DirError] = []
        function_complexities: list[int] = []
        by_language: dict[str, int] = {}

        for candidate in candidates:
            rel = candidate.relative_to(root).as_posix()
            try:
                language = detect_language(candidate)
                text = _read_text(candidate)
            except AstAnalyzerError as exc:
                errors.append({"file": rel, "error": str(exc)})
                continue
            report, complexities = self._build_report(rel, language, text)
            files[rel] = report
            function_complexities.extend(complexities)
            by_language[language] = by_language.get(language, 0) + 1

        totals: Totals = {
            "files": len(files),
            "symbols": sum(len(report["symbols"]) for report in files.values()),
            "functions": sum(
                1
                for report in files.values()
                for symbol in report["symbols"]
                if symbol["kind"] == "function"
            ),
            "methods": sum(
                1
                for report in files.values()
                for symbol in report["symbols"]
                if symbol["kind"] == "method"
            ),
            "classes": sum(
                1
                for report in files.values()
                for symbol in report["symbols"]
                if symbol["kind"] == "class"
            ),
            "imports_unique": len({item for report in files.values() for item in report["imports"]}),
            "chunks": sum(len(report["chunks"]) for report in files.values()),
            "max_cyclomatic": max(
                (report["complexity"]["max_cyclomatic"] for report in files.values()), default=0
            ),
            "avg_cyclomatic": round(sum(function_complexities) / len(function_complexities), 2)
            if function_complexities
            else 0.0,
            "by_language": by_language,
            "errors": len(errors),
        }

        return DirReport(
            root=str(root.resolve()),
            glob=pattern,
            capabilities=dict(self._capabilities),
            files=files,
            totals=totals,
            errors=errors,
        )

    def _build_report(
        self, display_path: str, language: str, text: str
    ) -> tuple[FileReport, list[int]]:
        result: BackendResult = self._backend.analyze(text, language)  # type: ignore[arg-type]
        symbols: list[Symbol] = list(result.symbols)
        chunks = make_chunks(display_path, language, text, symbols)
        complexities = [
            result.complexities[symbol.line]
            for symbol in symbols
            if symbol.kind != "class" and symbol.line in result.complexities
        ]
        report = FileReport(
            file=display_path,
            language=language,  # type: ignore[arg-type]
            symbols=[symbol.as_dict() for symbol in symbols],  # type: ignore[misc]
            complexity={
                "max_cyclomatic": result.max_cyclomatic(),
                "avg": result.avg_cyclomatic(),
            },
            imports=list(result.imports),
            chunks=chunks,
            capabilities=dict(self._capabilities),
        )
        return report, complexities
