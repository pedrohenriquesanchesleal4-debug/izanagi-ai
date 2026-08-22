"""Cyclomatic complexity tests with hand-counted expected values.

Counting rules (identical on both backends): base 1 per function/method, plus
1 per ``if``/``elif``/``else if``, loop, exception handler, ternary conditional,
boolean operator (``and``/``or``/``&&``/``||``), non-default switch case and
match case. ``else``/``finally``/``default`` never count.
"""

from __future__ import annotations

from .conftest import GO_GRADED, GO_SERVER, PY_COMBO, PY_GRADED, PY_SERVICE, TS_CLASSIFY, TS_GREETER


def test_python_grade_counts_exactly(both_modes, write_file):
    path = write_file("graded.py", PY_GRADED)
    report = both_modes.analyze_file(path)
    # grade: base 1 + if + elif + elif = 4
    assert report["complexity"]["max_cyclomatic"] == 4
    assert report["complexity"]["avg"] == 4.0


def test_python_boolean_operators_count(both_modes, write_file):
    path = write_file("combo.py", PY_COMBO)
    report = both_modes.analyze_file(path)
    # combo: 1 + if + and + or = 4 ; plain: 1 -> avg 2.5
    assert report["complexity"]["max_cyclomatic"] == 4
    assert report["complexity"]["avg"] == 2.5


def test_python_loops_and_handlers(both_modes, write_file):
    path = write_file("service.py", PY_SERVICE)
    report = both_modes.analyze_file(path)
    # run: 1 + for + if + and + while + except = 6 ; ping: 1
    assert report["complexity"]["max_cyclomatic"] == 6
    assert report["complexity"]["avg"] == round((6 + 1) / 2, 2)


def test_typescript_ternary_and_boolean_ops(both_modes, write_file):
    path = write_file("classify.ts", TS_CLASSIFY)
    report = both_modes.analyze_file(path)
    # classify: 1 + if + if + && + ternary = 5
    assert report["complexity"]["max_cyclomatic"] == 5
    assert report["complexity"]["avg"] == 5.0


def test_typescript_switch_case_skips_default(both_modes, write_file):
    path = write_file("greeter.ts", TS_GREETER)
    report = both_modes.analyze_file(path)
    # shrink: 1 ; constructor: 1 ; greet: 1 + if + || + case + catch = 5
    assert report["complexity"]["max_cyclomatic"] == 5
    assert report["complexity"]["avg"] == round((1 + 1 + 5) / 3, 2)


def test_go_case_clauses_and_boolean_ops(both_modes, write_file):
    path = write_file("graded.go", GO_GRADED)
    report = both_modes.analyze_file(path)
    # Grade: 1 + case + case + if + || = 5
    assert report["complexity"]["max_cyclomatic"] == 5
    assert report["complexity"]["avg"] == 5.0


def test_go_method_complexity(both_modes, write_file):
    path = write_file("server.go", GO_SERVER)
    report = both_modes.analyze_file(path)
    # Serve: 1 + for + && + if = 4 ; unused: 1
    assert report["complexity"]["max_cyclomatic"] == 4
    assert report["complexity"]["avg"] == 2.5


def test_empty_function_has_base_complexity(both_modes, write_file):
    path = write_file("noop.py", "def noop():\n    pass\n")
    report = both_modes.analyze_file(path)
    assert report["complexity"] == {"max_cyclomatic": 1, "avg": 1.0}


def test_file_without_functions_reports_zeroes(both_modes, write_file):
    path = write_file("data.py", "X = 1\nY = 2\n")
    report = both_modes.analyze_file(path)
    assert report["complexity"] == {"max_cyclomatic": 0, "avg": 0.0}
