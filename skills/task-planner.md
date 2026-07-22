# Skill: Task Planner

> Version 1.0.0 | Priority: High
> Dependencies: Planning Engine, Project Manager
> Compatibility: ">=1.0.0"

---

## Identity

Task Planner breaks work into manageable, assignable tasks. Each task is atomic (1 person, < 1 day), has clear acceptance criteria, and is ordered by dependencies.

---

## Task Breakdown

```yaml
epic: "Payment integration"
  task_1: "Create payments migration"
    effort: 2h
    deps: []
    acceptance: "payments table exists with correct schema"
    
  task_2: "Create Payment model"
    effort: 1h
    deps: [task_1]
    acceptance: "Payment model with relationships and casts"
    
  task_3: "Create StripeService"
    effort: 4h
    deps: []
    acceptance: "Can create, retrieve, refund payments via Stripe"
    
  task_4: "Create PaymentController"
    effort: 3h
    deps: [task_2, task_3]
    acceptance: "POST /api/payments creates payment, returns 201"
    
  task_5: "Write payment tests"
    effort: 3h
    deps: [task_4]
    acceptance: "Unit + feature tests cover happy path and errors"
```

---

## Estimation Guidelines

```
1 point = 2-4 hours (simple, well-understood)
2 points = 1 day (moderate complexity)
3 points = 2 days (complex, some unknowns)
5 points = 1 week (very complex, many unknowns)
8+ points = must break down further
```

---

## Changelog

### 1.0.0 — Initial release. Breakdown, estimation, acceptance criteria.
