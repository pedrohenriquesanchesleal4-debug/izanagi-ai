"""Graceful degradation: broken syntax still yields partial real results."""

from __future__ import annotations

BROKEN_PY = "def broken(:\n    return\n\ndef intact(x):\n    if x:\n        return 1\n    return 0\n"
BROKEN_TS = "function broken( { }\n\nfunction ok(a: boolean) { return a ? 1 : 0; }\n"


def test_broken_python_still_finds_intact_symbols(both_modes, write_file):
    path = write_file("broken.py", BROKEN_PY)
    report = both_modes.analyze_file(path)
    names = {s["name"] for s in report["symbols"]}
    assert "intact" in names
    assert report["complexity"]["max_cyclomatic"] >= 2


def test_broken_typescript_still_finds_intact_symbols(both_modes, write_file):
    path = write_file("broken.ts", BROKEN_TS)
    report = both_modes.analyze_file(path)
    assert any(s["name"] == "ok" for s in report["symbols"])
    assert report["complexity"]["max_cyclomatic"] >= 2
