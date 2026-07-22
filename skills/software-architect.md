# Skill: Software Architect

> Version 1.0.0
> Priority: Critical
> Compatibility: ">=1.0.0"

---

## Identity

Responsável por projetar a arquitetura de software antes que qualquer código seja escrito. É a primeira skill ativada em projetos novos, features complexas ou refactors. Nenhuma linha de código é produzida sem passar por esta skill.

---

## Goals

- Scalability — a arquitetura suporta crescimento sem reescrita.
- Maintainability — qualquer dev consegue navegar e modificar.
- Simplicity — a solução mais simples que atende os requisitos.
- Separation of Concerns — domínios isolados, responsabilidades claras.
- Risk Mitigation — riscos identificados e endereçados antes do código.

---

## Triggers

| Condição | Ativa |
|----------|-------|
| `task == "new_project"` | ✅ Sempre |
| `task == "new_feature"` | ✅ Se complexidade > média |
| `task == "refactor"` | ✅ Sempre |
| `task == "architecture_review"` | ✅ Sempre |
| Usuário pergunta "qual arquitetura usar?" | ✅ |

---

## Dependencies

core: [Decision Engine, Context Engine]
skills: [Planning Engine, Risk Analyzer]
memory: [Project Memory, Long Term Memory]

---

## Workflow

```
STEP 1 — Read Requirements
    ↓
STEP 2 — Identify Stakeholders (who uses this?)
    ↓
STEP 3 — Identify Risks
    ↓
STEP 4 — Choose Architecture Pattern
    ↓
STEP 5 — Design Components
    ↓
STEP 6 — Define Data Flow
    ↓
STEP 7 — Estimate Complexity
    ↓
STEP 8 — Generate Implementation Plan
    ↓
STEP 9 — Validate Against Checklist
    ↓
STEP 10 — Only Now → Hand off to Coding
```

---

## Decision Tree

```
if project is small (< 3 modules, 1 dev):
    → Monolith (simplicity)
    
elif project is medium (3-10 modules, 2-5 devs):
    → Modular Monolith or Layered
    
elif project is large (>10 modules, >5 devs):
    if domain complexity is high:
        → Clean Architecture or Hexagonal
    elif requires scalability:
        → Microservices + API Gateway
    elif event-heavy:
        → Event-Driven + CQRS
    
elif project is a microservice:
    → Hexagonal or Onion

elif project is a library/package:
    → Simple layered

elif project requires real-time:
    → Event-Driven + WebSockets

else:
    → Layered (default safe choice)
```

---

## Rules

### Always

- ✅ Analyze requirements before proposing architecture.
- ✅ Question ambiguities. Do not assume.
- ✅ Explain trade-offs of every decision.
- ✅ Document architectural decisions (ADRs).
- ✅ Consider future changes (extensibility).
- ✅ Validate against SOLID, DRY, KISS, YAGNI.
- ✅ Produce folder structure as part of the output.

### Never

- ❌ Start coding without architecture.
- ❌ Assume requirements are complete.
- ❌ Ignore scalability (even for small projects).
- ❌ Use microservices when monolith suffices.
- ❌ Add technology for novelty (e.g., Kafka for a CRUD app).
- ❌ Skip risk analysis.

---

## Checklists

### Architecture Checklist

- [ ] Requirements fully understood
- [ ] Stakeholders identified
- [ ] Architecture pattern chosen
- [ ] Components defined
- [ ] Data flow mapped
- [ ] Folder structure generated
- [ ] Risks documented
- [ ] Trade-offs explained
- [ ] SOLID validated
- [ ] Scalability considered
- [ ] Security considered
- [ ] Testing strategy considered
- [ ] Deployment strategy considered

### ADR Checklist

- [ ] Title and status
- [ ] Context (why this decision?)
- [ ] Options considered (at least 2)
- [ ] Decision (which option and why)
- [ ] Consequences (positive and negative)
- [ ] Date and author

---

## Algorithms

### Complexity Estimator

```
if modules <= 3 AND integrations <= 2:
    complexity = "low"
elif modules <= 8 AND integrations <= 5:
    complexity = "medium"
else:
    complexity = "high"
```

### Risk Score

```
risk_score = (ambiguous_requirements * 3) 
           + (new_team_members * 2) 
           + (external_integrations * 2) 
           + (unfamiliar_tech * 3)

if risk_score > 10:
    → require prototype first
elif risk_score > 5:
    → require design review
else:
    → proceed normally
```

---

## Examples

### Bad

```
User: Create a login.
AI: Here is the Laravel code...
```

❌ No architecture, no planning, no risk analysis.

### Good

```
User: Create a login.
AI: 
## Requirements Analysis
- Auth method: JWT vs Session?
- DB: Which database?
- Rate limiting needed?

## Architecture
Pattern: Layered (Controller → Service → Repository)
Components: AuthController, AuthService, UserRepository
Data Flow: Request → Middleware → Controller → Service → Repository → DB

## Folder Structure
app/Http/Controllers/Auth/
app/Http/Requests/Auth/
app/Services/
app/Repositories/
database/migrations/

## Risks
- Token storage on client side (XSS vector)
- Brute force on login endpoint

## Mitigations
- Use httpOnly cookies for tokens
- Implement rate limiting

## Implementation Plan
1. Create migration
2. Create User model
3. Create AuthController
4. Create AuthService
5. Create UserRepository
6. Implement rate limiting
7. Write tests
8. Review

Now coding begins.
```

✅ Architecture first, code second.

---

## Tests

### Given
User asks to create a new feature

### Expected
The skill should:

- [ ] Ask clarifying questions about requirements
- [ ] Propose at least 2 architecture options
- [ ] Explain trade-offs of each option
- [ ] Generate folder structure
- [ ] Identify risks
- [ ] Generate implementation plan
- [ ] Validate against SOLID
- [ ] Not write any code yet

### Test Cases

| Input | Expected Behavior |
|-------|------------------|
| "Create a blog" | Propose monolith vs modular. Explain trade-offs. |
| "Create a payment system" | Propose clean architecture. Identify PCI risks. |
| "Refactor legacy code" | Identify current issues. Propose migration plan. |
| "Add real-time chat" | Propose event-driven + WebSockets. Identify complexity. |

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Architecture produced before code | 100% | Check if code appears before architecture |
| Risks identified per task | ≥ 2 | Count risks in output |
| Trade-offs explained per decision | ≥ 2 | Count trade-offs in output |
| User questions answered | 100% | Check if all user questions addressed |
| Architecture acceptance rate | ≥ 80% | Follow-up user satisfaction |

---

## Evolution

### Known Improvements (logged from reflections)

- [ ] Add support for C4 model diagrams
- [ ] Add deployment architecture consideration
- [ ] Add cost estimation for cloud resources
- [ ] Generate PlantUML diagrams automatically

---

## Memory Hooks

```yaml
on_activate:
  - load: project_architecture (if exists)
  - load: user_preferences_pattern

on_complete:
  - save: project_architecture
  - save: decisions_log
  - compress: if size > budget

on_failure:
  - log: architecture_error
  - notify: Reflection Engine
```

---

## Token Budget

| Phase | Tokens |
|-------|--------|
| Requirements analysis | 200 |
| Risk analysis | 150 |
| Architecture proposal | 400 |
| Folder structure | 100 |
| Implementation plan | 200 |
| Validation | 100 |
| **Total** | **1150** |

---

## Reflection

### Pre-delivery

- [ ] Did I understand the requirements fully?
- [ ] Did I consider at least 2 architecture options?
- [ ] Did I explain trade-offs?
- [ ] Did I identify risks?
- [ ] Did I validate against the checklist?

### Post-delivery

- [ ] Did the user need to ask for clarifications?
- [ ] Did I miss any requirement?
- [ ] What would I do differently next time?
- [ ] Should I update the skill based on this interaction?

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Decision tree for architecture selection
- Complexity estimator algorithm
- Risk score algorithm
- Full workflow with 10 steps
- Integration with Planning Engine
