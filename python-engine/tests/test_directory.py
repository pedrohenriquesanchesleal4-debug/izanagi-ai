"""Directory aggregation tests: totals, glob filtering and error tolerance."""

from __future__ import annotations

import pytest

from ast_analyzer import Analyzer, FileReadError

from .conftest import GO_SERVER, PY_GRADED, PY_SERVICE, TS_GREETER


def _build_tree(tmp_path):
    (tmp_path / "pkg").mkdir()
    (tmp_path / "pkg" / "service.py").write_text(PY_SERVICE, encoding="utf-8")
    (tmp_path / "pkg" / "graded.py").write_text(PY_GRADED, encoding="utf-8")
    (tmp_path / "web").mkdir()
    (tmp_path / "web" / "greeter.ts").write_text(TS_GREETER, encoding="utf-8")
    (tmp_path / "sys.go").write_text(GO_SERVER, encoding="utf-8")
    (tmp_path / "notes.txt").write_text("not code", encoding="utf-8")


def test_analyze_dir_totals(tmp_path):
    _build_tree(tmp_path)
    report = Analyzer(prefer_tree_sitter=False).analyze_dir(tmp_path)

    assert report["totals"]["files"] == 4
    assert set(report["files"]) == {
        "pkg/service.py",
        "pkg/graded.py",
        "web/greeter.ts",
        "sys.go",
    }
    assert report["totals"]["by_language"] == {"py": 2, "ts": 1, "go": 1}
    assert report["totals"]["errors"] == 0
    assert report["totals"]["max_cyclomatic"] == 6
    assert report["totals"]["chunks"] == sum(
        len(file_report["chunks"]) for file_report in report["files"].values()
    )
    expected_imports = {
        "os",
        "collections",
        ".siblings",
        "./side-effect",
        "@nestjs/common",
        "path",
        "fmt",
        "strconv",
    }
    assert (
        {imp for file_report in report["files"].values() for imp in file_report["imports"]}
        == expected_imports
    )
    assert report["totals"]["imports_unique"] == len(expected_imports)


def test_analyze_dir_glob_filters(tmp_path):
    _build_tree(tmp_path)
    report = Analyzer(prefer_tree_sitter=False).analyze_dir(tmp_path, glob="**/*.py")

    assert set(report["files"]) == {"pkg/service.py", "pkg/graded.py"}
    assert report["glob"] == "**/*.py"


def test_analyze_dir_reports_per_file_errors(tmp_path):
    (tmp_path / "broken.py").write_bytes(b"\x00binary")
    (tmp_path / "ok.py").write_text("def ok():\n    pass\n", encoding="utf-8")
    report = Analyzer(prefer_tree_sitter=False).analyze_dir(tmp_path)

    assert report["totals"]["errors"] == 1
    assert report["errors"][0]["file"] == "broken.py"
    assert "ok.py" in report["files"]


def test_analyze_dir_missing_root_raises():
    with pytest.raises(FileReadError):
        Analyzer().analyze_dir("/nonexistent/path/xyz")
