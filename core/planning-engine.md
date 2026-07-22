# Core: Planning Engine

> Version 1.0.0
> Priority: Critical
> Dependencies: Context Engine, Decision Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Planning Engine is activated before any code is written. It breaks down tasks into ordered steps, estimates effort, identifies dependencies, and produces a clear implementation plan. It ensures the agent never writes code without knowing exactly what needs to be built and in what order.

---

## Goals

- Break any task into steps no larger than 1 file or 50 lines.
- Estimate effort per step (minutes or complexity points).
- Identify hidden dependencies between steps.
- Produce a plan that another agent or human can follow.
- Never start coding without a plan.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "new_project"` | Full project plan with phases |
| `task == "new_feature"` | Feature breakdown into tasks |
| `task == "refactor"` | Migration plan with safe steps |
| `task == "bug"` | Investigation → Fix → Verify plan |
| Any complex task | Decompose into sub-tasks |

---

## Workflow

```
1. Analyze requirements
    ↓
2. Decompose into atomic steps
    ↓
3. Identify dependencies between steps
    ↓
4. Estimate effort per step
    ↓
5. Order steps (topological sort)
    ↓
6. Identify risks per step
    ↓
7. Generate implementation plan
    ↓
8. Validate plan against requirements
    ↓
9. Pass to next skill in chain
```

---

## Plan Format

```yaml
plan:
  title: "Create Login API"
  total_effort: "45 min"
  
  steps:
    - id: 1
      name: "Create users table migration"
      file: "database/migrations/xxxx_create_users_table.php"
      effort: "5 min"
      depends_on: []
      risks: []
      
    - id: 2
      name: "Create User model"
      file: "app/Models/User.php"
      effort: "5 min"
      depends_on: [1]
      risks: []
      
    - id: 3
      name: "Create AuthController"
      file: "app/Http/Controllers/AuthController.php"
      effort: "10 min"
      depends_on: [2]
      risks: []
      
    - id: 4
      name: "Create LoginRequest"
      file: "app/Http/Requests/LoginRequest.php"
      effort: "5 min"
      depends_on: []
      risks: []
      
    - id: 5
      name: "Create AuthService"
      file: "app/Services/AuthService.php"
      effort: "10 min"
      depends_on: [2, 4]
      risks: ["Token storage strategy needed"]
      
    - id: 6
      name: "Write authentication tests"
      file: "tests/Feature/AuthTest.php"
      effort: "10 min"
      depends_on: [3, 5]
      risks: []
```

---

## Effort Estimation

```
complexity = estimate_complexity(task)

effort = base_time * complexity * uncertainty_factor

base_time:
  - new file: 5 min
  - edit file: 3 min
  - config: 2 min
  - test: 5 min

complexity:
  - simple (CRUD, no logic): 1x
  - medium (business logic): 2x
  - complex (algorithms, integrations): 3x

uncertainty_factor:
  - known tech: 1x
  - unfamiliar tech: 2x
  - new pattern: 1.5x
```

---

## Dependency Resolution

Steps are ordered using topological sort:

```
function order_steps(steps):
    graph = build_dependency_graph(steps)
    ordered = topological_sort(graph)
    return ordered
```

If a circular dependency is detected:

```
→ flag for user review
→ ask for clarification
→ suggest breaking the cycle
```

---

## Rules

### Always

- ✅ Plan before coding. Always.
- ✅ Break down into atomic steps (1 file or 50 lines max).
- ✅ Identify dependencies between steps.
- ✅ Estimate effort per step.
- ✅ Validate plan against all requirements.

### Never

- ❌ Start coding with "let me just write the code".
- ❌ Combine multiple concerns in one step.
- ❌ Skip effort estimation.
- ❌ Ignore step dependencies.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Plans generated | 100% of complex tasks | Plans / tasks requiring plans |
| Step atomicity | ≤ 50 lines per step | Average lines per step |
| Dependency accuracy | ≥ 90% | Dependencies correct / total |
| Plan adherence | ≥ 80% | Steps followed in order |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Topological sort for dependency resolution
- Effort estimation with complexity factors
- Atomic step decomposition (max 1 file / 50 lines)
- Circular dependency detection
- YAML plan format for machine readability
