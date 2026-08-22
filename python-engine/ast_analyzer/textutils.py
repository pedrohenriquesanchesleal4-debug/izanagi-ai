"""Shared text helpers used by every analysis backend."""

from __future__ import annotations


def clean_param(raw: str) -> str:
    """Strip type annotations / default values from one raw parameter snippet."""
    depth = 0
    cut = len(raw)
    for idx, ch in enumerate(raw):
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth -= 1
        elif depth == 0 and ch == ":":
            cut = min(cut, idx)
            break
        elif (
            depth == 0
            and ch == "="
            and raw[idx : idx + 2] not in ("==", "=>")
            and raw[max(idx - 1, 0) : idx + 1] not in ("!", "<", ">", "=")
        ):
            cut = min(cut, idx)
            break
    return raw[:cut].strip()


def split_top_level(text: str, separator: str = ",") -> list[str]:
    """Split ``text`` on ``separator`` ignoring occurrences nested in brackets/strings."""
    parts: list[str] = []
    depth = 0
    current: list[str] = []
    quote: str | None = None
    idx = 0
    while idx < len(text):
        ch = text[idx]
        if quote is not None:
            current.append(ch)
            if ch == "\\" and idx + 1 < len(text):
                current.append(text[idx + 1])
                idx += 2
                continue
            if ch == quote:
                quote = None
            idx += 1
            continue
        if ch in "\"'`":
            quote = ch
            current.append(ch)
        elif ch in "([{":
            depth += 1
            current.append(ch)
        elif ch in ")]}":
            depth -= 1
            current.append(ch)
        elif ch == separator and depth == 0:
            parts.append("".join(current))
            current = []
        else:
            current.append(ch)
        idx += 1
    if current:
        parts.append("".join(current))
    return [part.strip() for part in parts if part.strip()]


def unquote(raw: str) -> str:
    """Remove one pair of surrounding quotes from a string literal body."""
    body = raw.strip()
    if len(body) >= 2 and body[0] == body[-1] and body[0] in "\"'`":
        return body[1:-1]
    return body
