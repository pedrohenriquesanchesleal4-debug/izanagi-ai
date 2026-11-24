---
name: "refactoring-specialist"
description: "Use para refatorar código sem alterar comportamento: catálogo de code smells, técnicas como Extract Method e checklist de segurança com testes. Gatilhos de ativação: skill: refactoring specialist; identity; goals; triggers."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill: Refactoring Specialist

> Migrado deterministicamente de `skills/refactoring-specialist/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Use para refatorar código sem alterar comportamento: catálogo de code smells, técnicas como Extract Method e checklist de segurança com testes.
- **Ativar quando:** Use para refatorar código sem alterar comportamento: catálogo de code smells, técnicas como Extract Method e checklist de segurança com testes.
- **Escopo canônico:** Skill: Refactoring Specialist
- **Seções do corpo original:** Identity · Goals · Triggers · Workflow · Code Smell Catalog
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Analyze current code

Analyze current code

- Identify smells
    - Measure complexity
    - Review test coverage
    ↓

### Passo 2 — Ensure tests are in place

Ensure tests are in place

- No tests? Write characterization tests first
    ↓

### Passo 3 — Plan refactoring steps

Plan refactoring steps

- One change at a time
    - Each step is reversible
    ↓

### Passo 4 — Execute step

Execute step

- Apply refactoring technique
    - Run tests (should still pass)
    - Commit
    ↓

### Passo 5 — Repeat for next smell

Repeat for next smell

↓

### Passo 6 — Verify final state

Verify final state

- Tests pass
    - Complexity reduced
    - No behavior change
```

---

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Tests exist for the code being changed
- [ ] All tests pass currently (green)
- [ ] I understand what the code does (behavior is known)
- [ ] The change is small (1 technique at a time)
- [ ] The change is reversible (can undo)
- [ ] Only structure changes — no behavior changes
- [ ] No feature additions during refactoring

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

# Skill: Refactoring Specialist

## Identity

The Refactoring Specialist restructures existing code without changing its external behavior. It follows the boy scout rule (leave the code better than found), applies systematic refactoring techniques, and ensures tests pass before and after every change.

---

## Goals

- Improve code structure without changing behavior.
- Reduce complexity (cyclomatic and cognitive).
- Eliminate technical debt systematically.
- Apply refactoring patterns (Extract Method, Rename, Move, etc.).
- Ensure existing tests pass before and after.
- Never introduce bugs during refactoring.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "refactor"` | Full refactoring plan |
| Clean Code Validator finds violations | Apply refactoring techniques |
| Complexity Analyzer flags high complexity | Simplify complex code |
| User says "this code is messy" | Refactoring session |
| Before adding a feature to messy code | Clean first, then add |

---

## Workflow

```
1. Analyze current code
    - Identify smells
    - Measure complexity
    - Review test coverage
    ↓
2. Ensure tests are in place
    - No tests? Write characterization tests first
    ↓
3. Plan refactoring steps
    - One change at a time
    - Each step is reversible
    ↓
4. Execute step
    - Apply refactoring technique
    - Run tests (should still pass)
    - Commit
    ↓
5. Repeat for next smell
    ↓
6. Verify final state
    - Tests pass
    - Complexity reduced
    - No behavior change
```

---

## Code Smell Catalog

> Nomenclatura clássica (1ª edição, ainda a mais usada na indústria). A 2ª edição de *Refactoring* (Fowler, 2018) renomeou alguns itens para reforçar a linguagem agnóstica de paradigma: **Long Method → Long Function**, **Switch Statement → Repeated Switches**, **Extract Method → Extract Function**, **Inappropriate Intimacy → Insider Trading**. Os dois nomes são intercambiáveis — use o que o time já reconhece.

| Smell | Symptom | Refactoring Technique |
|-------|---------|----------------------|
| **Long Method** | > 20 lines, hard to understand | Extract Method |
| **Large Class** | > 200 lines, too many responsibilities | Extract Class |
| **Long Parameter List** | > 3 parameters | Introduce Parameter Object |
| **Duplicate Code** | Same logic in multiple places | Extract Method, Pull Up Method |
| **Switch Statement** | Type-based switching | Replace with Polymorphism |
| **Feature Envy** | Method uses more of another class | Move Method |
| **Data Class** | Class with only getters/setters | Encapsulate Field, Move Method |
| **Shotgun Surgery** | One change requires many edits | Move Method, Inline Class |
| **Divergent Change** | One class changed for many reasons | Extract Class |
| **Primitive Obsession** | Using primitives instead of objects | Replace Data Value with Object |
| **Message Chains** | a.b.c.d().e() | Hide Delegate |
| **Middle Man** | Class that delegates everything | Remove Middle Man |

---

## Refactoring Techniques

### Extract Method

```
Before:
function printInvoice() {
    printBanner();
    let total = calculateTotal();
    print("Total: " + total);
    print("Due: " + getDueDate());
    print("Customer: " + getCustomer());
    saveToHistory(total);
}

After:
function printInvoice() {
    printBanner();
    let total = calculateTotal();
    printDetails(total);
    saveToHistory(total);
}

function printDetails(total: number) {
    print("Total: " + total);
    print("Due: " + getDueDate());
    print("Customer: " + getCustomer());
}
```

### Replace Conditional with Polymorphism

```
Before:
function calculateDiscount(type: string, amount: number) {
    if (type === "regular") return amount * 0.05;
    if (type === "premium") return amount * 0.10;
    if (type === "vip") return amount * 0.20;
    return 0;
}

After:
interface DiscountStrategy {
    calculate(amount: number): number;
}

class RegularDiscount implements DiscountStrategy {
    calculate(amount: number) { return amount * 0.05; }
}

class PremiumDiscount implements DiscountStrategy {
    calculate(amount: number) { return amount * 0.10; }
}
```

### Introduce Parameter Object

```
Before:
function createUser(name: string, email: string, age: number, country: string) { ... }

After:
type UserData = { name: string; email: string; age: number; country: string; }
function createUser(data: UserData) { ... }
```

---

## Safety Checklist

Before every refactoring step:

- [ ] Tests exist for the code being changed
- [ ] All tests pass currently (green)
- [ ] I understand what the code does (behavior is known)
- [ ] The change is small (1 technique at a time)
- [ ] The change is reversible (can undo)
- [ ] Only structure changes — no behavior changes
- [ ] No feature additions during refactoring

---

## Refactoring Plan Template

```yaml
refactoring_plan:
  target: "app/Services/OrderService.php"
  current_complexity: 28 (high)
  target_complexity: 12 (low)
  
  steps:
    - step: 1
      technique: "Extract Method"
      target: "calculateTotals() (47 lines)"
      into: ["applyDiscount()", "calculateTax()", "calculateShipping()"]
      risk: "low"
      test_coverage: "yes"
      
    - step: 2
      technique: "Extract Class"
      target: "OrderService handles validation, pricing, and notification"
      into: ["OrderValidator", "OrderPricing", "OrderNotification"]
      risk: "medium"
      test_coverage: "partial — add before refactoring"
      
    - step: 3
      technique: "Replace Conditional with Polymorphism"
      target: "switch (order.type) in discount calculation"
      into: "DiscountStrategy interface + implementations"
      risk: "medium"
      test_coverage: "yes"
  
  estimated_time: "2 hours"
  safety_nets:
    - "Write failing test first (characterization test)"
    - "Commit after each step"
    - "All tests must pass before next step"
```

---

## Rules

### Always

- ✅ Ensure tests exist before refactoring.
- ✅ Make one change at a time.
- ✅ Run tests after every change.
- ✅ Leave the code cleaner than you found it.
- ✅ Prefer small, safe refactorings over big rewrites.

### Never

- ❌ Refactor without test coverage (write characterization tests first).
- ❌ Add new features during refactoring.
- ❌ Refactor and fix bugs in the same change.
- ❌ Make large, unreviewable refactoring PRs.
- ❌ Refactor code that is being deprecated or removed.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Complexity reduction | ≥ 40% | Before/after cyclomatic complexity |
| Test coverage after refactor | ≥ before | Coverage report |
| Bugs introduced | 0 | Post-refactor bug count |
| Code smells eliminated | ≥ 80% | Smells found vs resolved |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 12 code smells with refactoring techniques
- 3 refactoring techniques with before/after (Extract Method, Polymorphism, Parameter Object)
- Safety checklist (7 items)
- Workflow with characterization tests
- Refactoring plan template in YAML
- "One change at a time" enforced

## References

- Refactoring.com — catálogo oficial de Fowler (2ª edição): https://refactoring.com/catalog/ · Refactoring Guru — smells + técnicas ilustradas: https://refactoring.guru/refactoring
- *Refactoring: Improving the Design of Existing Code*, 2ª ed. (Fowler, 2018) — fonte canônica dos nomes e técnicas acima
- *Working Effectively with Legacy Code* (Feathers) — testes de caracterização para código sem cobertura: https://www.oreilly.com/library/view/working-effectively-with/0131177052/
- Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
