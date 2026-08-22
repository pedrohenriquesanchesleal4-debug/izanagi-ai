"""Import extraction tests for python, typescript and go sources."""

from __future__ import annotations

from .conftest import GO_SERVER, PY_SERVICE, TS_GREETER


def test_python_imports(both_modes, write_file):
    path = write_file("service.py", PY_SERVICE)
    report = both_modes.analyze_file(path)
    assert report["imports"] == [".siblings", "collections", "os"]


def test_python_alias_deduplication(both_modes, write_file):
    path = write_file("dup.py", "import os\nimport os.path\nfrom os import sep as s\n")
    report = both_modes.analyze_file(path)
    assert report["imports"] == ["os", "os.path"]


def test_typescript_imports(both_modes, write_file):
    path = write_file("greeter.ts", TS_GREETER)
    report = both_modes.analyze_file(path)
    assert report["imports"] == ["./side-effect", "@nestjs/common", "path"]


def test_go_imports(both_modes, write_file):
    path = write_file("server.go", GO_SERVER)
    report = both_modes.analyze_file(path)
    assert report["imports"] == ["fmt", "strconv"]
