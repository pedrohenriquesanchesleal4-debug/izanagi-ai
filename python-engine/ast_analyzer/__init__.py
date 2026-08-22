"""Izanagi semantic multi-language code analysis engine."""

from __future__ import annotations

from ast_analyzer.analyzer import Analyzer
from ast_analyzer.backends import HAS_TREE_SITTER
from ast_analyzer.chunker import MAX_CHUNK_CHARS
from ast_analyzer.languages import SUPPORTED_EXTENSIONS, detect_language
from ast_analyzer.model import (
    BackendResult,
    BinaryContentError,
    Capabilities,
    ComplexityInfo,
    DirError,
    DirReport,
    FileReadError,
    FileReport,
    FileReport as AnalysisResult,
    Symbol,
    SymbolInfo,
    SymbolKind,
    Totals,
    UnsupportedLanguageError,
)

__version__ = "0.1.0"

__all__ = [
    "Analyzer",
    "HAS_TREE_SITTER",
    "MAX_CHUNK_CHARS",
    "SUPPORTED_EXTENSIONS",
    "AnalysisResult",
    "BackendResult",
    "BinaryContentError",
    "Capabilities",
    "ComplexityInfo",
    "DirError",
    "DirReport",
    "FileReadError",
    "FileReport",
    "Symbol",
    "SymbolInfo",
    "SymbolKind",
    "Totals",
    "UnsupportedLanguageError",
    "__version__",
    "detect_language",
]
