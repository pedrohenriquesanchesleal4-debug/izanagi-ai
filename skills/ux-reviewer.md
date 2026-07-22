# Skill: UX Reviewer

> Version 1.0.0 | Priority: Medium
> Dependencies: Frontend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

UX Reviewer evaluates user interfaces against usability heuristics: consistency, feedback, error prevention, user control, and accessibility.

---

## Nielsen's Heuristics

```yaml
1_visibility: "System status visible (loading indicators, progress bars)"
2_real_world: "Use user's language, not technical jargon"
3_control: "Undo/redo, cancel, easy navigation back"
4_consistency: "Same patterns throughout (buttons, forms, icons)"
5_error_prevention: "Confirm destructive actions, validate inline"
6_recognition: "Show options rather than ask to remember"
7_flexibility: "Shortcuts for power users, simple paths for beginners"
8_aesthetic: "Clean design, whitespace, visual hierarchy"
9_errors: "Clear error messages with recovery path"
10_help: "Contextual help, documentation accessible"
```

---

## UX Report

```yaml
ux_review:
  page: "Checkout page"
  
  findings:
    - heuristic: "1_visibility"
      issue: "No loading state when processing payment"
      severity: "high"
      fix: "Add spinner + 'Processing payment...' message"
    
    - heuristic: "5_error_prevention"
      issue: "No confirmation before cancelling order"
      severity: "medium"
      fix: "Add 'Are you sure?' modal"
    
    - heuristic: "9_errors"
      issue: "Generic 'Something went wrong' message"
      severity: "high"
      fix: "Specific messages: 'Card declined', 'Insufficient funds'"
    
  score: 7 / 10
```

---

## Changelog

### 1.0.0 — Initial release. Heuristics, report format.
