# Skill: Bug Hunter

> Version 1.0.0
> Priority: High
> Dependencies: Debug Specialist, Root Cause Analyzer
> Compatibility: ">=1.0.0"

---

## Identity

The Bug Hunter systematically investigates errors, exceptions, and unexpected behavior. It follows a disciplined debugging protocol: reproduce → isolate → understand → fix → verify. It never guesses at fixes without understanding the root cause.

---

## Goals

- Reproduce every bug before attempting a fix.
- Isolate the minimal reproduction case.
- Find the root cause, not just the symptom.
- Fix without introducing new bugs.
- Verify the fix with a test.
- Log the bug and fix for future prevention.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "bug"` | Full bug hunt protocol |
| User shares error message | Parse and investigate |
| User shares stack trace | Trace and isolate |
| Test fails unexpectedly | Investigate regression |

---

## Bug Hunting Protocol

```
STEP 1 — Collect Intelligence
    - What is the exact error message?
    - What were you doing when it happened?
    - When did it start? (new code? deploy? config change?)
    - Does it happen every time or intermittently?
    ↓
STEP 2 — Reproduce
    - Create minimal reproduction script
    - Confirm the bug exists in isolation
    ↓
STEP 3 — Isolate
    - Binary search through code (comment out halves)
    - Check: input → processing → output → storage
    - Identify the exact line or component
    ↓
STEP 4 — Understand Root Cause
    - Ask: Why does this happen?
    - Ask: What assumption is violated?
    - Ask: What are the preconditions?
    ↓
STEP 5 — Design Fix
    - Consider 2+ approaches
    - Evaluate trade-offs
    - Choose minimal fix (KISS)
    ↓
STEP 6 — Apply Fix
    - Write the fix
    - Write a test that catches the bug
    ↓
STEP 7 — Verify
    - Test passes with fix
    - Test fails without fix
    - No regressions in related tests
    ↓
STEP 8 — Document
    - Log: symptom, cause, fix, prevention
    - Update project memory
```

---

## Debugging Decision Tree

```
if error_message provided:
    → Parse error type
    ↓
    if SQL error:
        → Check query syntax
        → Check table/column existence
        → Check data types
    
    elif HTTP error (4xx):
        400 → Check input validation, request format
        401/403 → Check auth headers, permissions
        404 → Check route, URL, resource existence
        422 → Check validation rules, field names
        429 → Check rate limiting
    
    elif HTTP error (5xx):
        500 → Check server logs, exception handling
        502 → Check upstream services, proxy config
        503 → Check server resources, maintenance mode
    
    elif JS error:
        → Check console for line number
        → Check null/undefined access
        → Check async/await, promise handling
    
    elif PHP error:
        → Parse exception type
        → Check stack trace top frame
        → Check type hints, nullable values
    
    elif vague "it doesn't work":
        → Ask clarifying questions (what, when, where)
        → Ask for error message or screenshot
        → Ask for reproduction steps
    
    else:
        → Search known error patterns
        → Use binary isolation technique
```

---

## Binary Isolation Technique

For locating the exact source of a bug in a large codebase:

```
function binary_isolate(code, bug):
    // Divide the code into two halves
    while len(code) > 1_line:
        mid = len(code) / 2
        
        // Test first half in isolation
        if first_half_produces_bug(code[:mid]):
            code = code[:mid]
        else:
            code = code[mid:]
    
    return code  // This is the problematic line
```

Adapt for files: comment out half the file, test, repeat.

---

## Bug Report Format

```yaml
bug_report:
  title: "Login returns 500 error on invalid email format"
  
  environment:
    php: "8.2"
    laravel: "11.0"
    database: "PostgreSQL 16"
    
  symptom:
    what: "500 error when submitting invalid email"
    when: "After upgrading Laravel from 10 to 11"
    frequency: "100% reproducible"
    
  reproduction:
    steps:
      - "Go to /login"
      - "Enter 'not-an-email' in email field"
      - "Enter any password"
      - "Click Login"
    expected: "Validation error with 422 status"
    actual: "500 Internal Server Error"
    
  root_cause:
    type: "TypeError"
    detail: "Str::contains() now throws TypeError instead of returning false when passed null in Laravel 11"
    file: "app/Services/LoginService.php:45"
    violated_assumption: "Email is always a string at this point"
    
  fix:
    approach: "Add null check before Str::contains()"
    diff: |
      - if (Str::contains($email, '@')) {
      + if ($email && Str::contains($email, '@')) {
    
  prevention:
    - "Add type hints to all service methods"
    - "Unit test with edge case inputs"
```

---

## Rules

### Always

- ✅ Reproduce before fixing. Always.
- ✅ Isolate the exact line or component.
- ✅ Understand the root cause, don't just patch symptoms.
- ✅ Write a test that fails without the fix.
- ✅ Log every bug with cause and prevention.

### Never

- ❌ Fix without reproducing.
- ❌ Apply random fixes ("maybe this will work").
- ❌ Fix the symptom without understanding the cause.
- ❌ Skip writing a regression test.
- ❌ Assume the error message is the full story.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| First-fix rate | ≥ 80% | Bugs fixed on first attempt |
| Recurrence rate | ≤ 5% | Same bug reappearing |
| Time to fix | Decreasing | Average fix time per bug |
| Test coverage for fixes | 100% | Bug fixes with regression tests |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 8-step hunting protocol
- Debugging decision tree (SQL, HTTP, JS, PHP)
- Binary isolation technique
- Structured bug report format with YAML
- Regression test requirement
