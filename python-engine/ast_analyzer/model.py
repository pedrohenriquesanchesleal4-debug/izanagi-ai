"""Typed data model shared by every analyzer backend."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal, TypedDict

LanguageTag = Literal["ts", "tsx", "py", "go"]
SymbolKind = Literal["function", "class", "method"]

MAX_CHUNK_CHARS = 512

SYMBOL_KINDS: tuple[str, ...] = ("function", "class", "method")
LANGUAGE_TAGS: tuple[str, ...] = ("ts", "tsx", "py", "go")


class SymbolInfo(TypedDict):
    name: str
    kind: str
    line: int
    end: int
    params: list[str]


class ComplexityInfo(TypedDict):
    max_cyclomatic: int
    avg: float


class Capabilities(TypedDict):
    tree_sitter: bool


class FileReport(TypedDict):
    file: str
    language: LanguageTag
    symbols: list[SymbolInfo]
    complexity: ComplexityInfo
    imports: list[str]
    chunks: list[str]
    capabilities: Capabilities


class Totals(TypedDict):
    files: int
    symbols: int
    functions: int
    methods: int
    classes: int
    imports_unique: int
    chunks: int
    max_cyclomatic: int
    avg_cyclomatic: float
    by_language: dict[str, int]
    errors: int


class DirError(TypedDict):
    file: str
    error: str


class DirReport(TypedDict):
    root: str
    glob: str
    capabilities: Capabilities
    files: dict[str, FileReport]
    totals: Totals
    errors: list[DirError]


@dataclass(frozen=True)
class Symbol:
    """A named structural unit extracted from source code."""

    name: str
    kind: SymbolKind
    line: int
    end: int
    params: list[str] = field(default_factory=list)

    def as_dict(self) -> dict[str, object]:
        return {
            "name": self.name,
            "kind": self.kind,
            "line": self.line,
            "end": self.end,
            "params": list(self.params),
        }


@dataclass(frozen=True)
class BackendResult:
    """Raw analysis output of one backend for a single file.

    ``complexities`` maps each function/method start line to its computed
    cyclomatic complexity (classes are containers and carry no complexity).
    """

    symbols: tuple[Symbol, ...]
    imports: tuple[str, ...]
    complexities: dict[int, int]

    def max_cyclomatic(self) -> int:
        return max(self.complexities.values(), default=0)

    def avg_cyclomatic(self) -> float:
        if not self.complexities:
            return 0.0
        return round(sum(self.complexities.values()) / len(self.complexities), 2)


class AstAnalyzerError(Exception):
    """Base class for all ast_analyzer failures."""


class UnsupportedLanguageError(AstAnalyzerError):
    """Raised when the file extension has no registered language parser."""


class FileReadError(AstAnalyzerError):
    """Raised when the target path cannot be read as text."""


class BinaryContentError(AstAnalyzerError):
    """Raised when content contains NUL bytes (binary, not parseable)."""
