"""Shared fixtures: real embedded source samples for every supported language."""

from __future__ import annotations

import textwrap
from pathlib import Path

import pytest

from ast_analyzer import Analyzer

ENGINE_ROOT = Path(__file__).resolve().parents[1]

PY_GRADED = '''\
"""Grading utilities."""


def grade(score):
    if score >= 90:
        return "A"
    elif score >= 80:
        return "B"
    elif score >= 70:
        return "C"
    else:
        return "F"
'''

PY_COMBO = '''\
def combo(a, b, c):
    if a and b or c:
        return 1
    return 0


def plain():
    return 42
'''

PY_SERVICE = '''\
import os
from collections import OrderedDict as OD
from .siblings import helper


class Service:
    """Runs tasks."""

    def run(self, task, retries=3):
        for attempt in range(retries):
            if attempt and task.ready():
                break
        while task.pending():
            task.tick()
        try:
            return task.execute()
        except ValueError:
            return None

    @staticmethod
    def ping() -> bool:
        return True
'''

TS_CLASSIFY = '''\
export function classify(n: number): string {
  if (n > 10) {
    return "big";
  }
  if (n > 5 && n <= 10) {
    return "mid";
  }
  return n > 0 ? "small" : "none";
}
'''

TS_GREETER = '''\
import { Injectable } from "@nestjs/common";
import * as path from "path";
import "./side-effect";

export const shrink = (text: string): string => text.trim();

export class Greeter {
  private prefix = "hello";

  constructor(public readonly limit: number = 3) {}

  greet(who: string, punctuation = "!"): string {
    if (!who || this.prefix === "") {
      return "?";
    }
    switch (who) {
      case "a":
        return "A";
      default:
        break;
    }
    try {
      return `${this.prefix} ${who}${punctuation}`;
    } catch (err) {
      return path.basename(String(err));
    }
  }
}
'''

GO_GRADED = '''\
package main

func Grade(n int) string {
\tswitch {
\tcase n >= 90:
\t\treturn "A"
\tcase n >= 80:
\t\treturn "B"
\t}
\tif n < 0 || n > 100 {
\t\treturn "?"
\t}
\treturn "F"
}
'''

GO_SERVER = '''\
package server

import (
\t"fmt"
\t"strconv"
)

type Server struct{ port int }

func (s *Server) Serve(addr string) error {
\tfor i := 0; i < 3 && addr != ""; i++ {
\t\tif s.port <= 0 {
\t\t\tcontinue
\t\t}
\t}
\tfmt.Println("serving", addr)
\treturn nil
}

func unused() {
\t_ = strconv.Itoa(1)
}
'''


def _write(tmp_path: Path, name: str, content: str) -> Path:
    target = tmp_path / name
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(textwrap.dedent(content), encoding="utf-8")
    return target


@pytest.fixture
def write_file(tmp_path: Path):
    def factory(name: str, content: str) -> Path:
        return _write(tmp_path, name, content)

    return factory


@pytest.fixture(params=[True, False], ids=["treesitter", "fallback"])
def both_modes(request: pytest.FixtureRequest) -> Analyzer:
    return Analyzer(prefer_tree_sitter=request.param)


@pytest.fixture
def tree_sitter_mode() -> Analyzer:
    return Analyzer(prefer_tree_sitter=True)


@pytest.fixture
def fallback_mode() -> Analyzer:
    return Analyzer(prefer_tree_sitter=False)
