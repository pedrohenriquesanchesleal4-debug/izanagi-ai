# Skill: Risk Analyzer

> Version 1.0.0 | Priority: High
> Dependencies: Requirement Analyzer, Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

Risk Analyzer identifies, assesses, and mitigates project and technical risks before they materialize.

---

## Risk Assessment Matrix

```yaml
probability:
  rare: 1 (unlikely)
  unlikely: 2
  possible: 3
  likely: 4
  almost_certain: 5

impact:
  negligible: 1
  minor: 2
  moderate: 3
  major: 4
  catastrophic: 5

risk_score: probability × impact

thresholds:
  critical: 20-25 → requires immediate mitigation
  high: 15-19 → requires mitigation plan
  medium: 10-14 → monitor monthly
  low: 1-9 → accept
```

---

## Risk Register

```yaml
risks:
  - id: R1
    title: "Third-party payment API downtime"
    probability: unlikely (2)
    impact: major (4)
    score: 8 (medium)
    mitigation: "Queue failed payments with retry + fallback"
    
  - id: R2
    title: "Key developer leaves mid-project"
    probability: possible (3)
    impact: major (4)
    score: 12 (medium)
    mitigation: "Cross-training, documentation, no bus factor = 1"
    
  - id: R3
    title: "Database migration causes data loss"
    probability: unlikely (2)
    impact: catastrophic (5)
    score: 10 (medium)
    mitigation: "Staging restore test before production, backup verified"
```

---

## Changelog

### 1.0.0 — Initial release. Matrix, thresholds, register.
