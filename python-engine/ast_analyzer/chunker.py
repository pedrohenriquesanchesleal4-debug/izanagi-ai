"""Embedding-ready chunking: self-contained symbol snippets capped at a hard limit."""

from __future__ import annotations

from collections.abc import Sequence

from ast_analyzer.model import MAX_CHUNK_CHARS, LanguageTag, Symbol

_COMMENT_TOKENS: dict[str, str] = {"py": "#", "ts": "//", "tsx": "//", "go": "//"}


def _truncate(text: str) -> str:
    return text if len(text) <= MAX_CHUNK_CHARS else text[:MAX_CHUNK_CHARS]


def _pack(head: str, body_lines: list[str]) -> list[str]:
    """Greedily group ``body_lines`` under ``head`` so every chunk fits the limit."""
    if not body_lines:
        return [_truncate(head)] if head.strip() else []

    groups: list[list[str]] = []
    current: list[str] = []
    size = len(head)
    for line in body_lines:
        extra = len(line) + 1
        if current and size + extra > MAX_CHUNK_CHARS:
            groups.append(current)
            current = [line]
            size = len(head) + extra
            continue
        if not current and len(head) + extra > MAX_CHUNK_CHARS:
            groups.append([line])
            continue
        current.append(line)
        size += extra
    if current:
        groups.append(current)

    chunks: list[str] = []
    for group in groups:
        chunks.append(_truncate(head + "\n".join(group)))
    return chunks


def make_chunks(
    rel_path: str,
    language: LanguageTag,
    source: str,
    symbols: Sequence[Symbol],
) -> list[str]:
    """Build embedding chunks (<= ``MAX_CHUNK_CHARS`` chars), one block per symbol.

    Every chunk opens with a locating header (path, kind, name) plus the symbol
    signature, so each snippet stays self-contained even after long bodies are
    split across multiple chunks. Files without recognized symbols fall back to
    whole-file slices.
    """
    if not source.strip():
        return []

    token = _COMMENT_TOKENS[language]
    lines = source.split("\n")
    ordered = sorted(symbols, key=lambda item: item.line)
    chunks: list[str] = []

    for symbol in ordered:
        start = max(symbol.line - 1, 0)
        end_line = min(symbol.end, len(lines))
        code_lines = lines[start:end_line]
        if not code_lines:
            continue
        head = f"{token} {rel_path}::{symbol.kind} {symbol.name}\n{code_lines[0].rstrip()}\n"
        chunks.extend(_pack(head, code_lines[1:]))

    if not chunks:
        head = f"{token} {rel_path}::module\n"
        chunks.extend(_pack(head, lines))

    return [chunk for chunk in chunks if chunk.strip()]
