# Core: Quality Gates

> Version 1.0.0
> Priority: Critical
> Dependencies: Token Manager, Security Scanner
> Compatibility: ">=1.0.0"

---

## Identity

Quality Gates are the final validation layer before any output is delivered to the user. Every response passes through 5 gates: Security, Style, Clarity, Conciseness, and Completeness. If any gate fails, the output is rejected and reworked.

---

## Gates Overview

```
┌─────────────────────────────────────────────────┐
│                 QUALITY GATES                   │
│                                                 │
│  Input → Gate 1 → Gate 2 → Gate 3 → Gate 4 →   │
│          → Gate 5 → ✅ Pass → Output           │
│                    → ❌ Fail → Rework          │
│                                                 │
│  Gate 1: Security (fatal if fail)               │
│  Gate 2: Style                                  │
│  Gate 3: Clarity                                │
│  Gate 4: Conciseness                            │
│  Gate 5: Completeness                           │
└─────────────────────────────────────────────────┘
```

---

## Gate 1: Security

**Fatal gate** — if this fails, output is blocked immediately.

### Checks

- [ ] No hardcoded credentials, API keys, tokens, or secrets
- [ ] No SQL injection vectors (raw queries without parameterization)
- [ ] No XSS vectors (untrusted output without escaping)
- [ ] No CSRF vulnerabilities
- [ ] No SSRF vulnerabilities
- [ ] No insecure deserialization
- [ ] No hardcoded IPs or internal paths
- [ ] No commented-out security code
- [ ] Passwords are hashed (bcrypt/argon2), not encrypted
- [ ] HTTPS is enforced (not HTTP)
- [ ] File uploads are validated (type, size, path traversal)

### Failure Action

```yaml
fail:
  action: "Block output"
  message: "❌ SECURITY GATE FAILED: [specific issue]"
  notify: "Reflection Engine"
  log: true
```

---

## Gate 2: Style

**Non-fatal** — can pass with warnings.

### Checks

- [ ] Follows project naming conventions
- [ ] Consistent indentation (spaces vs tabs)
- [ ] No commented-out code blocks
- [ ] No debug statements (dd(), var_dump, console.log)
- [ ] No trailing whitespace
- [ ] Imports are organized
- [ ] Line length ≤ 120 characters
- [ ] PHP: follows PSR-12
- [ ] JS/TS: follows project ESLint config
- [ ] Python: follows PEP 8

### Failure Action

```yaml
warn:
  action: "Pass with warnings"
  message: "⚠️ STYLE GATE: [specific issues] — fixed automatically"
  fix: true
```

---

## Gate 3: Clarity

**Non-fatal** — subjective, uses heuristics.

### Checks

- [ ] Response directly answers the user's question
- [ ] No undefined acronyms or jargon
- [ ] Code examples have context (filename, purpose)
- [ ] Steps are in logical order
- [ ] Error messages are human-readable
- [ ] Variable names are meaningful
- [ ] Complex logic has brief explanation

### Heuristics

```
clarity_score = 0
if answer_directly_matches_question:
    clarity_score += 3
if jargon_defined:
    clarity_score += 1
if code_has_context:
    clarity_score += 1
if steps_are_ordered:
    clarity_score += 1
if no_undefined_acronyms:
    clarity_score += 1

if clarity_score < 5:
    fail("Response lacks clarity — rewrite")
```

---

## Gate 4: Conciseness

**Non-fatal** — measured against token budget.

### Checks

- [ ] No repetition of the same information
- [ ] No filler phrases ("I would recommend", "It is important to note")
- [ ] No verbose markdown (excessive headers, dividers)
- [ ] Token count ≤ budget for the skill chain
- [ ] No redundant code examples (same pattern twice)

### Heuristics

```
repetition_penalty = count_repeated_phrases(output)
filler_penalty = count_filler_phrases(output)
total_penalty = repetition_penalty + filler_penalty

if total_penalty > 5:
    fail("Response too verbose — compress")
```

---

## Gate 5: Completeness

**Non-fatal** — checks that nothing is missing.

### Checks

- [ ] All user questions are answered
- [ ] All requirements from the task are addressed
- [ ] No "TODO" or "FIXME" left in code
- [ ] Error handling is included
- [ ] Edge cases are mentioned
- [ ] Dependencies are declared
- [ ] Installation/setup instructions are provided (if applicable)

### Heuristics

```
answered = count_user_questions_answered(output)
expected = count_user_questions(input)
completeness_ratio = answered / expected

if completeness_ratio < 1.0:
    fail("Missing answers to [n] question(s)")
```

---

## Combined Result

```yaml
quality_result:
  security: "✅ PASS"
  style: "⚠️ PASS (warnings: trailing whitespace)"
  clarity: "✅ PASS"
  conciseness: "✅ PASS (3% under budget)"
  completeness: "✅ PASS"
  overall: "✅ PASS"
  token_usage: "1,234 / 2,048"
```

---

## Rules

### Always

- ✅ Run all 5 gates on every output.
- ✅ Block output on security gate failure.
- ✅ Log gate results for Reflection Engine.
- ✅ Fix style issues automatically when possible.

### Never

- ❌ Skip gates for speed.
- ❌ Deliver output that fails any gate.
- ❌ Modify security gate rules without user approval.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Security pass rate | 100% | Outputs passing / total outputs |
| Overall pass rate | ≥ 95% | Outputs passing all gates |
| Auto-fix rate | ≥ 80% | Issues auto-fixed / total issues |
| Gate latency | < 50ms | Time to run all gates |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 5 quality gates with distinct checklists
- Security gate is fatal — blocks output on failure
- Style gate auto-fixes common issues
- Clarity, conciseness, completeness use heuristic scoring
- Full logging for Reflection Engine integration
