# Coding: Python Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Backend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Python Specialist writes modern Python (3.11+) with type hints, dataclasses, pattern matching, and async/await. Follows PEP 8 and PEP 484 strictly.

---

## Goals

- Use type hints for all functions (PEP 484).
- Use dataclasses for data containers.
- Use async/await for I/O-bound operations.
- Follow PEP 8 (with line length 100).
- Use pathlib over os.path.
- Use `__future__` annotations for deferred evaluation.

---

## Conventions

```yaml
naming: snake_case for functions/vars, PascalCase for classes
typing: always annotate function params and return
imports: stdlib → third-party → local (grouped)
async: async/await for I/O, not CPU-bound
context: context managers (with) for resources
enums: Enum class over string constants
data: dataclasses over dicts for structured data
```

---

## Checklist

- [ ] Type hints on all function signatures
- [ ] No `Optional[X]` — use `X | None` (3.10+)
- [ ] No `Dict`, `List`, `Tuple` — use `dict`, `list`, `tuple`
- [ ] Dataclasses for data containers
- [ ] Context managers for file/DB operations
- [ ] Enum for fixed sets of values
- [ ] Pathlib over os.path
- [ ] F-strings over % or .format()
- [ ] Structural pattern matching (match/case) over if/elif chains
- [ ] Async for I/O, not CPU-bound tasks

---

## Example

```python
from __future__ import annotations
from dataclasses import dataclass, asdict
from enum import Enum
from pathlib import Path


class PostStatus(Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


@dataclass
class CreatePostData:
    title: str
    content: str
    status: PostStatus = PostStatus.DRAFT


async def create_post(repo: PostRepository, data: CreatePostData) -> Post:
    post = await repo.save(asdict(data))
    return post
```

---

## Changelog

### 1.0.0 — Initial release. Python 3.11+, typing, dataclasses, async.
