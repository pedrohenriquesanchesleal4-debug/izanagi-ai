---
name: "clean-code-validator"
description: "Revisa código contra princípios de clean code — nomes, funções pequenas, efeitos colaterais, tratamento de erro — e gera relatório de violações com fix sugerido. Use após escrever ou refatorar código. Gatilhos de ativação: skill: clean code validator; identity; goals; triggers."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Clean Code Validator

> Migrado deterministicamente de `skills/clean-code-validator/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Revisa código contra princípios de clean code — nomes, funções pequenas, efeitos colaterais, tratamento de erro — e gera relatório de violações com fix sugerido.
- **Ativar quando:** Use após escrever ou refatorar código.
- **Escopo canônico:** Skill: Clean Code Validator
- **Seções do corpo original:** Identity · Goals · Triggers · Validation Rules · Violation Examples
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — The Clean Code Validator reviews code against established clean code principles:

The Clean Code Validator reviews code against established clean code principles: meaningful names, small functions, no side effects, proper error handling, and consistent formatting. It enforces readability and maintainability over cleverness.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Names reveal intent (`$elapsedTimeInDays`, not `$etd`)
- [ ] No abbreviations (`$elapsedTimeInDays`, not `$elapsed`)
- [ ] No noise words (`$data`, `$info`, `$thing`)
- [ ] Boolean names are predicates (`$isActive`, `$hasPermission`)
- [ ] Functions named by what they do (`createUser`, `sendEmail`)
- [ ] Classes named by what they are (`UserController`, `PaymentService`)
- [ ] Consistent naming convention per language
- [ ] Does one thing (single responsibility)
- [ ] Small (< 20 lines)
- [ ] No side effects (doesn't modify inputs or global state)

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

# Skill: Clean Code Validator

## Identity

The Clean Code Validator reviews code against established clean code principles: meaningful names, small functions, no side effects, proper error handling, and consistent formatting. It enforces readability and maintainability over cleverness.

---

## Goals

- Every name reveals intent.
- Every function does one thing.
- Every function is small (< 20 lines).
- No side effects in unexpected places.
- Error handling is not an afterthought.
- Code is self-documenting (comments explain "why", not "what").

---

## Triggers

| Condition | Action |
|-----------|--------|
| After any code output | Clean code validation |
| After Senior Code Reviewer | Deep clean code pass |
| `task == "clean"` or `task == "refactor"` | Full clean code analysis |

---

## Validation Rules

### Naming

- [ ] Names reveal intent (`$elapsedTimeInDays`, not `$etd`)
- [ ] No abbreviations (`$elapsedTimeInDays`, not `$elapsed`)
- [ ] No noise words (`$data`, `$info`, `$thing`)
- [ ] Boolean names are predicates (`$isActive`, `$hasPermission`)
- [ ] Functions named by what they do (`createUser`, `sendEmail`)
- [ ] Classes named by what they are (`UserController`, `PaymentService`)
- [ ] Consistent naming convention per language

### Functions

- [ ] Does one thing (single responsibility)
- [ ] Small (< 20 lines)
- [ ] No side effects (doesn't modify inputs or global state)
- [ ] No more than 3 parameters (use object if more)
- [ ] Return type is consistent
- [ ] No flag parameters (split into two functions)
- [ ] No output parameters (return instead)

### Comments

- [ ] No comments that explain "what" (code should be clear)
- [ ] Comments explain "why" or "why not"
- [ ] No commented-out code
- [ ] No TODO or FIXME without owner and date

### Formatting

- [ ] Consistent indentation
- [ ] Vertical density (related code together)
- [ ] Vertical distance (declared near usage)
- [ ] Horizontal alignment not needed
- [ ] No trailing whitespace
- [ ] One blank line between methods

### Error Handling

- [ ] Exceptions over error codes
- [ ] Try-catch at appropriate boundary
- [ ] Exception messages are descriptive
- [ ] No swallowed exceptions (empty catch)
- [ ] No return null (throw or return Optional)

---

## Violation Examples

### Before (violations)

```php
// ❌ Name doesn't reveal intent
function get($id) {
    // ❌ Side effect: modifies global state
    $_SESSION['last_access'] = time();
    
    // ❌ Comment explains "what", not "why"
    // get user from db
    $u = DB::table('users')->find($id);
    
    // ❌ Return null instead of throwing
    if (!$u) return null;
    
    return $u;
}
```

### After (clean)

```php
function findUserById(int $id): User
{
    $user = DB::table('users')->find($id);

    if (!$user) {
        throw new UserNotFoundException("User with ID {$id} not found");
    }

    return $user;
}
```

---

## Function Size Heuristic

```
function_score = lines_of_code * 1.0
               + parameters * 1.5
               + conditional_branches * 0.5
               + side_effects * 5.0
               + return_points * 0.3

if function_score > 30:
    flag("Function is too complex — extract smaller functions")

guidelines:
  1-10 lines:  ✅ ideal
  11-20 lines: ✅ acceptable
  21-30 lines: ⚠️ consider extracting
  31+ lines:   ❌ must refactor
```

---

## Clean Code Report

```yaml
clean_code_report:
  file: "app/Services/PaymentService.php"
  score: 7.2 / 10
  
  violations:
    - rule: "Function does more than one thing"
      location: "processPayment() line 42"
      detail: "Validates input, processes payment, sends email, logs audit"
      fix: "Extract validatePayment(), sendReceipt(), logAuditTrail()"
      effort: "low"
      
    - rule: "Flag parameter"
      location: "getOrders(true) line 88"
      detail: "Boolean parameter 'includeCanceled' should be separate method"
      fix: "Split into getOrders() and getOrdersWithCanceled()"
      effort: "low"
      
    - rule: "Function too long (47 lines)"
      location: "calculateTotals() line 120"
      detail: "Does discount calculation, tax, shipping, totals"
      fix: "Extract: applyDiscount(), calculateTax(), calculateShipping()"
      effort: "medium"
  
  positives:
    - "Good use of type hints"
    - "Exception messages are descriptive"
    - "Dependency injection used"
```

---

## Rules

### Always

- ✅ Check every function for single responsibility.
- ✅ Flag functions over 20 lines.
- ✅ Flag unclear names.
- ✅ Flag side effects.
- ✅ Flag empty catch blocks.
- ✅ Suggest specific, actionable fixes.

### Never

- ❌ Accept "clever" code over readable code.
- ❌ Allow side effects in unexpected places.
- ❌ Allow functions that do more than one thing.
- ❌ Accept TODO or FIXME as permanent.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Functions under 20 lines | ≥ 80% | Count functions / total |
| Descriptive naming | ≥ 90% | Names reviewed and approved |
| No empty catches | 100% | Count catch blocks |
| TODO/FIXME rate | 0 | Count in production code |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 6 validation categories (naming, functions, comments, formatting, error handling, tests)
- Function size heuristic with scoring
- Clean code report in YAML
- Before/after examples for violations
- Specific, actionable fix suggestions

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
