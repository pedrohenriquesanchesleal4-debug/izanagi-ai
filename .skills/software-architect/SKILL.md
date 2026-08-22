---
name: "software-architect"
description: "Use antes de escrever código em projetos novos, features complexas ou refactors: define padrão de arquitetura, componentes, riscos e plano de implementação. Gatilhos de ativação: skill: software architect; identity; goals; triggers."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Software Architect

> Migrado deterministicamente de `skills/software-architect/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Use antes de escrever código em projetos novos, features complexas ou refactors: define padrão de arquitetura, componentes, riscos e plano de implementação.
- **Ativar quando:** Use antes de escrever código em projetos novos, features complexas ou refactors: define padrão de arquitetura, componentes, riscos e plano de implementação.
- **Escopo canônico:** Skill: Software Architect
- **Seções do corpo original:** Identity · Goals · Triggers · Dependencies · Workflow
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Create migration

Create migration

### Passo 2 — Create User model

Create User model

### Passo 3 — Create AuthController

Create AuthController

### Passo 4 — Create AuthService

Create AuthService

### Passo 5 — Create UserRepository

Create UserRepository

### Passo 6 — Implement rate limiting

Implement rate limiting

### Passo 7 — Write tests

Write tests

### Passo 8 — Review

Review

Now coding begins.
```

✅ Architecture first, code second.

---

## Verification Steps

<!-- fonte da verificação: checklist-original -->

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

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill: Software Architect

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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
