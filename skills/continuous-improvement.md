# Skill: Continuous Improvement

> Version 1.0.0 | Priority: Medium
> Dependencies: Evolution Engine, Reflection Engine
> Compatibility: ">=1.0.0"

---

## Identity

Continuous Improvement ensures the agent gets better over time. Tracks improvements made, measures effectiveness, and identifies areas for further growth.

---

## Improvement Cycle

```
Reflection → Pattern Detection → Skill Update → Measure → Repeat

Each cycle answers:
1. What did I learn from the last task?
2. What pattern emerged?
3. Did the previous update work?
4. What should I improve next?
```

## Tracking

```yaml
improvements_tracked:
  - date: "2026-07-17"
    change: "Added null safety check to Security Engineer checklist"
    trigger: "Bug report: Str::contains() TypeError"
    effectiveness: "Prevented 3 similar bugs since"
    
  - date: "2026-07-15"
    change: "Reduced Backend Engineer token budget by 10%"
    trigger: "Token waste pattern detected"
    effectiveness: "20% fewer compression activations"
```

---

## Changelog

### 1.0.0 — Initial release. Cycle, tracking.
