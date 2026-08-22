"""Command line interface: ``python -m ast_analyzer analyze <path> [options]``."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from ast_analyzer.analyzer import Analyzer
from ast_analyzer.model import AstAnalyzerError, FileReadError

_EXIT_OK = 0
_EXIT_ERROR = 1


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ast-analyzer",
        description="Izanagi semantic multi-language code analyzer.",
    )
    sub = parser.add_subparsers(dest="command", required=True)
    analyze = sub.add_parser("analyze", help="analyze a source file or directory tree")
    analyze.add_argument("path", help="file or directory to analyze")
    analyze.add_argument("--json", dest="json_out", default=None, help="write JSON report to file")
    analyze.add_argument("--glob", default=None, help="glob pattern for directory scans")
    return parser


def main(argv: list[str] | None = None) -> int:
    """CLI entry point returning a process exit code (0 ok, 1 on real errors)."""
    args = build_parser().parse_args(argv)
    target = Path(args.path)

    try:
        if target.is_dir():
            report = Analyzer().analyze_dir(target, glob=args.glob)
        elif target.is_file():
            report = Analyzer().analyze_file(target)
        else:
            raise FileReadError(f"path does not exist: {target}")
    except (AstAnalyzerError, OSError) as exc:
        payload = {
            "ok": False,
            "error": {"type": type(exc).__name__, "message": str(exc), "path": str(target)},
        }
        sys.stderr.write(json.dumps(payload, ensure_ascii=False) + "\n")
        return _EXIT_ERROR

    text = json.dumps(report, ensure_ascii=False, indent=2)
    sys.stdout.write(text + "\n")
    if args.json_out is not None:
        out_path = Path(args.json_out)
        if out_path.parent != Path(""):
            out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(text + "\n", encoding="utf-8")
    return _EXIT_OK
