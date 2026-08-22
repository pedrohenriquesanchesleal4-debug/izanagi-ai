"""Language detection by file extension."""

from __future__ import annotations

from pathlib import Path

from ast_analyzer.model import LanguageTag, UnsupportedLanguageError

EXTENSION_TO_LANGUAGE: dict[str, LanguageTag] = {
    ".py": "py",
    ".ts": "ts",
    ".tsx": "tsx",
    ".go": "go",
}

SUPPORTED_EXTENSIONS: frozenset[str] = frozenset(EXTENSION_TO_LANGUAGE)


def detect_language(path: str | Path) -> LanguageTag:
    """Return the language tag for ``path`` or raise UnsupportedLanguageError."""
    suffix = Path(path).suffix.lower()
    tag = EXTENSION_TO_LANGUAGE.get(suffix)
    if tag is None:
        raise UnsupportedLanguageError(f"unsupported extension {suffix!r}: {path}")
    return tag
