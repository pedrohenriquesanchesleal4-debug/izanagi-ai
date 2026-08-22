"""Chunking tests: hard 512-char limit, self-containment and oversized splitting."""

from __future__ import annotations

from ast_analyzer import MAX_CHUNK_CHARS

BODY_LINES = [
    "    value = base * multiplier + offset",
    "    if value > threshold:",
    "        value = threshold",
    "    for step in range(10):",
    "        value += step * factor",
]


def _big_module() -> str:
    header = '"""Module with one very large function."""\n\n\n'
    body = "\n".join(
        f"    acc_{i} = base_{i} * {i} + offset_{i}  # padded line with filler content"
        for i in range(40)
    )
    return f"{header}def big(base_0, offset_0):\n{body}\n    return acc_0\n"


def test_every_chunk_respects_limit(both_modes, write_file):
    path = write_file("big.py", _big_module())
    report = both_modes.analyze_file(path)
    assert report["chunks"], "expected at least one chunk"
    assert all(len(chunk) <= MAX_CHUNK_CHARS for chunk in report["chunks"])


def test_oversized_symbol_is_split(both_modes, write_file):
    path = write_file("big.py", _big_module())
    report = both_modes.analyze_file(path)
    symbol_chunks = [c for c in report["chunks"] if "::function big" in c]
    assert len(symbol_chunks) >= 3


def test_chunks_are_self_contained(both_modes, write_file):
    path = write_file("big.py", _big_module())
    report = both_modes.analyze_file(path)
    for chunk in report["chunks"]:
        assert chunk.startswith("#")
        assert "::" in chunk.splitlines()[0]
        assert "def big(" in chunk


def test_symbol_signature_repeated_on_continuations(both_modes, write_file):
    path = write_file("big.py", _big_module())
    report = both_modes.analyze_file(path)
    continuations = [c for c in report["chunks"] if "acc_2" not in c]
    assert continuations
    assert all("def big(" in c for c in continuations)


def test_small_file_yields_one_chunk_per_symbol(both_modes, write_file):
    source = "def a():\n    pass\n\n\ndef b():\n    return 1\n"
    path = write_file("small.py", source)
    report = both_modes.analyze_file(path)
    assert len(report["chunks"]) == 2
    assert any("::function a" in chunk for chunk in report["chunks"])
    assert any("::function b" in chunk for chunk in report["chunks"])


def test_symbolless_file_falls_back_to_module_chunks(both_modes, write_file):
    path = write_file("data.py", "X = 1\nY = 2\nZ = 3\n")
    report = both_modes.analyze_file(path)
    assert len(report["chunks"]) == 1
    assert "::module" in report["chunks"][0]
    assert "Y = 2" in report["chunks"][0]


def test_empty_file_has_no_chunks(both_modes, write_file):
    path = write_file("empty.py", "")
    report = both_modes.analyze_file(path)
    assert report["chunks"] == []
