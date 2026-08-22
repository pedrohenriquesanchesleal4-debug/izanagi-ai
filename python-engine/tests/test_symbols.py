"""Symbol extraction tests across all supported languages and both backends."""

from __future__ import annotations

import pytest

from ast_analyzer import FileReadError, UnsupportedLanguageError

from .conftest import PY_SERVICE, TS_GREETER, GO_SERVER


def test_python_symbols_exact(both_modes, write_file):
    path = write_file("service.py", PY_SERVICE)
    report = both_modes.analyze_file(path)

    assert [s["name"] for s in report["symbols"]] == ["Service", "run", "ping"]
    kinds = {s["name"]: s["kind"] for s in report["symbols"]}
    assert kinds == {"Service": "class", "run": "method", "ping": "method"}
    params = {s["name"]: s["params"] for s in report["symbols"]}
    assert params["run"] == ["self", "task", "retries"]
    assert params["ping"] == []
    by_name = {s["name"]: s for s in report["symbols"]}
    assert by_name["Service"]["line"] == 6
    assert by_name["run"]["line"] == 9
    assert by_name["ping"]["end"] == 22


def test_typescript_symbols_exact(both_modes, write_file):
    path = write_file("greeter.ts", TS_GREETER)
    report = both_modes.analyze_file(path)

    names = [(s["name"], s["kind"]) for s in report["symbols"]]
    assert ("shrink", "function") in names
    assert ("Greeter", "class") in names
    assert ("greet", "method") in names
    assert ("constructor", "method") in names
    by_name = {s["name"]: s for s in report["symbols"]}
    assert by_name["shrink"]["params"] == ["text"]
    assert by_name["greet"]["params"] == ["who", "punctuation"]
    assert by_name["greet"]["line"] == 12
    assert by_name["constructor"]["line"] == 10


def test_go_symbols_exact(both_modes, write_file):
    path = write_file("server.go", GO_SERVER)
    report = both_modes.analyze_file(path)

    names = [(s["name"], s["kind"]) for s in report["symbols"]]
    assert ("Serve", "method") in names
    assert ("unused", "function") in names
    by_name = {s["name"]: s for s in report["symbols"]}
    assert by_name["Serve"]["params"] == ["addr"]
    assert by_name["unused"]["params"] == []
    assert by_name["Serve"]["line"] == 10


def test_unsupported_extension_raises(both_modes, write_file):
    path = write_file("notes.txt", "hello")
    with pytest.raises(UnsupportedLanguageError):
        both_modes.analyze_file(path)


def test_binary_content_rejected(both_modes, tmp_path):
    path = tmp_path / "blob.py"
    path.write_bytes(b"def f():\x00pass")
    with pytest.raises(FileReadError):
        both_modes.analyze_file(path)
