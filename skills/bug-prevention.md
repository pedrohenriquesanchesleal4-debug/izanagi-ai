# Skill: Bug Prevention

> Version 1.0.0 | Priority: High
> Dependencies: Root Cause Analyzer, Unit Test Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Bug Prevention analyzes code before bugs happen. Identifies common bug patterns, applies static analysis, enforces type safety, and suggests defenses against entire classes of bugs.

---

## Prevention Layers

```yaml
layer_1_types:
  - Strict types (PHP declare(strict_types=1))
  - Type hints on all functions (PHP 8.2+, TypeScript)
  - No mixed/any types (use union types)
  - Readonly properties for immutability

layer_2_static_analysis:
  - PHPStan level max / Psalm
  - TypeScript strict mode
  - ESLint with type-checked rules
  - SonarQube / CodeQL

layer_3_testing:
  - TDD for complex logic
  - Property-based testing (edge cases)
  - Mutation testing (verify tests catch bugs)
  - Contract testing for API boundaries

layer_4_process:
  - Code review checklist with high-risk items
  - Mandatory review for: auth, payments, data deletion
  - Pre-commit hooks for static analysis
  - Canary deployments for risky changes
```

---

## Common Bug Patterns

| Pattern | Detection | Prevention |
|---------|-----------|------------|
| Null reference | Static analysis, type hints | Nullable types, null checks |
| Off-by-one | Code review | Use collection methods (not raw loops) |
| SQL injection | Static analysis, review | Parameterized queries (always) |
| Race condition | Review, testing | Locks, transactions, idempotency |
| Floating point | Review | Use decimal/bigint for money |
| Inconsistent state | Review, testing | Unit of Work, transactions |
| Unhandled error | Static analysis | Global error handler, typed exceptions |

---

## Bug Prevention Score

```yaml
prevention_score: 72 / 100

layers:
  types: 80% (some mixed types remain)
  static_analysis: 60% (PHPStan level 6, target level max)
  testing: 70% (unit tests but no mutation)
  process: 80% (reviews done but no high-risk checklist)
```

---

## Changelog

### 1.0.0 — Initial release. Prevention layers, bug patterns, scoring.
