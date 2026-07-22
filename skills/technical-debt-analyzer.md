# Skill: Technical Debt Analyzer

> Version 1.0.0 | Priority: High
> Dependencies: Complexity Analyzer, Clean Code Validator
> Compatibility: ">=1.0.0"

---

## Identity

Technical Debt Analyzer identifies, quantifies, and prioritizes technical debt. Measures debt as "time to fix" vs "time to implement correctly." Produces a prioritized backlog for debt reduction.

---

## Debt Categories

| Category | Examples | Interest Rate |
|----------|---------|---------------|
| **Code** | Dead code, duplication, complex functions | High — affects every change |
| **Design** | Missing abstractions, god classes, circular dependencies | High — makes changes hard |
| **Test** | Missing tests, flaky tests, slow tests | Medium — reduces confidence |
| **Documentation** | Missing docs, outdated docs, no ADRs | Low — slows onboarding |
| **Infrastructure** | Manual deploys, no monitoring, old deps | High — blocks velocity |
| **Security** | Known vulnerabilities, missing auth | Critical — risk of breach |

---

## Debt Estimation

```yaml
finding:
  description: "OrderService has 47-line calculateTotals method"
  
  cost_to_fix_now:
    analysis: 0.5h
    refactor: 2h
    tests: 1h
    review: 0.5h
    total: 4h
    
  cost_to_fix_later:
    find_and_understand: 2h (harder to navigate)
    refactor: 3h (more dependencies added)
    tests: 2h (less familiarity)
    review: 1h
    total: 8h
    
  interest_rate: "2x every 6 months"
  priority: "high"
```

---

## Debt Backlog

```yaml
prioritized_debt:
  - priority: 1
    item: "Remove duplicated payment logic in 3 controllers"
    effort: 3h
    impact: "Eliminates inconsistent behavior"
    
  - priority: 2
    item: "Add PHPStan level max"
    effort: 8h
    impact: "Prevents entire class of bugs"
    
  - priority: 3
    item: "Extract OrderService (47 lines → 3 methods)"
    effort: 4h
    impact: "Makes future order changes safer"
  
  total_effort: 40h
  estimated_sprint_impact: "2 sprints to clear high-priority items"
```

---

## Changelog

### 1.0.0 — Initial release. Categories, estimation, prioritized backlog.
