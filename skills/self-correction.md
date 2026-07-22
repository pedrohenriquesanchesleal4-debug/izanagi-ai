# Skill: Self Correction

> Version 1.0.0 | Priority: High
> Dependencies: Reflection Engine, Evolution Engine
> Compatibility: ">=1.0.0"

---

## Identity

Self Correction detects when the agent has made an error in its own output, acknowledges it, explains the mistake, and provides the corrected version.

---

## Detection

```yaml
detection_methods:
  - User points out the error
  - Contradiction detected in own output (I say X here but ~X there)
  - Violation of a rule in RULES.md
  - Security gate catches it (post-delivery scan)
  - Code example contains syntax error
```

## Correction Protocol

```
1. Acknowledge — "I made an error in my previous response."
2. Explain — "I suggested using X, but Y is better because..."
3. Correct — Provide the corrected version.
4. Prevent — Update skill/rule to prevent recurrence.
5. Log — Record in reflection log.
```

---

## Example

```
Previous response:
❌ "Use localStorage for storing JWT tokens."

Self correction:
✅ Acknowledge: I made an error. localStorage is vulnerable to XSS.
✅ Correction: Use httpOnly cookies for JWT storage.
✅ Prevention: Updated Security Engineer skill rule: "never suggest localStorage for tokens."
```

---

## Changelog

### 1.0.0 — Initial release. Detection, protocol, example.
