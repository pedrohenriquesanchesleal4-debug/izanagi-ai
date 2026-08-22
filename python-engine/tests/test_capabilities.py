"""Capability negotiation and cross-backend consistency tests."""

from __future__ import annotations

import pytest

import ast_analyzer
from ast_analyzer import HAS_TREE_SITTER, Analyzer

from .conftest import GO_SERVER, PY_SERVICE, TS_GREETER


def test_capability_flag_reflects_mode():
    assert Analyzer(prefer_tree_sitter=True).capabilities == {"tree_sitter": HAS_TREE_SITTER}
    assert Analyzer(prefer_tree_sitter=False).capabilities == {"tree_sitter": False}


def test_backend_name_matches_capabilities():
    for prefer in (True, False):
        analyzer = Analyzer(prefer_tree_sitter=prefer)
        active = analyzer.capabilities["tree_sitter"]
        if prefer and HAS_TREE_SITTER:
            assert active is True
        else:
            assert active is False or analyzer.backend_name == "fallback"


def test_version_exported():
    assert ast_analyzer.__version__ == "0.1.0"


SAMPLES = {
    "service.py": PY_SERVICE,
    "greeter.ts": TS_GREETER,
    "server.go": GO_SERVER,
}

EXPECTED_COMPLEXITY = {
    "service.py": {"max_cyclomatic": 6, "avg": 3.5},
    "greeter.ts": {"max_cyclomatic": 5, "avg": round((1 + 1 + 5) / 3, 2)},
    "server.go": {"max_cyclomatic": 4, "avg": 2.5},
}


@pytest.mark.parametrize("name", sorted(SAMPLES))
def test_backends_agree_on_metrics(name, tmp_path):
    path = tmp_path / name
    path.write_text(SAMPLES[name], encoding="utf-8")

    ts_report = Analyzer(prefer_tree_sitter=True).analyze_file(path)
    fb_report = Analyzer(prefer_tree_sitter=False).analyze_file(path)

    def core(report):
        return [
            (s["name"], s["kind"], s["line"], s["params"])
            for s in report["symbols"]
        ]

    assert core(ts_report) == core(fb_report)
    assert ts_report["complexity"] == EXPECTED_COMPLEXITY[name]
    assert fb_report["complexity"] == EXPECTED_COMPLEXITY[name]
    assert ts_report["imports"] == fb_report["imports"]
