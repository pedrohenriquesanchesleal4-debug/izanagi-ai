"""End-to-end CLI tests executed via subprocess (``python -m ast_analyzer``)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from .conftest import ENGINE_ROOT, GO_SERVER, PY_GRADED, PY_SERVICE, TS_GREETER

PYTHON = sys.executable


def run_cli(*args: str, cwd: Path = ENGINE_ROOT) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [PYTHON, "-m", "ast_analyzer", *args],
        cwd=str(cwd),
        capture_output=True,
        text=True,
        timeout=60,
        check=False,
    )


def _build_tree(tmp_path: Path) -> None:
    (tmp_path / "pkg").mkdir()
    (tmp_path / "pkg" / "service.py").write_text(PY_SERVICE, encoding="utf-8")
    (tmp_path / "pkg" / "graded.py").write_text(PY_GRADED, encoding="utf-8")
    (tmp_path / "greeter.ts").write_text(TS_GREETER, encoding="utf-8")
    (tmp_path / "sys.go").write_text(GO_SERVER, encoding="utf-8")


def test_cli_single_file_exit_zero_and_valid_json(write_file):
    path = write_file("graded.py", PY_GRADED)
    result = run_cli("analyze", str(path))

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert payload["file"] == str(path)
    assert payload["language"] == "py"
    assert payload["complexity"]["max_cyclomatic"] == 4
    assert payload["capabilities"]["tree_sitter"] in (True, False)


def test_cli_json_flag_writes_file(tmp_path):
    path = tmp_path / "graded.py"
    path.write_text(PY_GRADED, encoding="utf-8")
    out = tmp_path / "out" / "report.json"
    result = run_cli("analyze", str(path), "--json", str(out))

    assert result.returncode == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert json.loads(result.stdout) == written


def test_cli_directory_aggregates(tmp_path):
    _build_tree(tmp_path)
    result = run_cli("analyze", str(tmp_path), "--glob", "**/*.py")

    assert result.returncode == 0
    payload = json.loads(result.stdout)
    assert set(payload["files"]) == {"pkg/service.py", "pkg/graded.py"}
    assert payload["totals"]["by_language"] == {"py": 2}
    assert payload["totals"]["max_cyclomatic"] == 6


def test_cli_missing_path_exit_one(tmp_path):
    result = run_cli("analyze", str(tmp_path / "nope.py"))

    assert result.returncode == 1
    error = json.loads(result.stderr)
    assert error["ok"] is False
    assert error["error"]["type"] == "FileReadError"


def test_cli_unsupported_extension_exit_one(tmp_path):
    path = tmp_path / "notes.txt"
    path.write_text("hello", encoding="utf-8")
    result = run_cli("analyze", str(path))

    assert result.returncode == 1
    error = json.loads(result.stderr)
    assert error["error"]["type"] == "UnsupportedLanguageError"


@pytest.mark.parametrize("prefer_env", [None])
def test_cli_console_script_installed(prefer_env):
    """The ``ast-analyzer`` entry point resolves after editable installation."""
    script = ENGINE_ROOT / ".venv" / "bin" / "ast-analyzer"
    if not script.exists():
        pytest.skip("console script not installed in this environment")
    result = subprocess.run(
        [str(script), "--help"], capture_output=True, text=True, timeout=30, check=False
    )
    assert result.returncode == 0
    assert "analyze" in result.stdout
