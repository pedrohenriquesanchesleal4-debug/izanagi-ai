"""Backend selection: tree-sitter when importable, structural fallback otherwise."""

from __future__ import annotations

from ast_analyzer.backends.fallback_backend import FallbackBackend
from ast_analyzer.backends.treesitter_backend import TreeSitterBackend
from ast_analyzer.model import BackendResult, LanguageTag

try:  # capability probe kept at import time so callers can branch cheaply
    import tree_sitter as _ts  # noqa: F401

    HAS_TREE_SITTER = True
except ImportError:
    HAS_TREE_SITTER = False


class Backend:
    """Common interface for analysis backends."""

    name = "base"

    def analyze(self, text: str, language: LanguageTag) -> BackendResult:  # pragma: no cover
        raise NotImplementedError


def select_backend(prefer_tree_sitter: bool = True) -> tuple[Backend, bool]:
    """Return ``(backend, tree_sitter_active)`` honouring availability and preference."""
    if prefer_tree_sitter and HAS_TREE_SITTER:
        try:
            return TreeSitterBackend(), True
        except Exception:
            pass
    return FallbackBackend(), False


__all__ = ["Backend", "FallbackBackend", "TreeSitterBackend", "HAS_TREE_SITTER", "select_backend"]
