---
name: "bug-hunter"
description: "Investiga bugs com protocolo disciplinado: reproduzir, isolar, entender a causa raiz, corrigir e verificar com teste de regressão. Use ao investigar erros, exceções ou comportamento inesperado. Gatilhos de ativação: skill: bug hunter; identity; goals; triggers."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill: Bug Hunter

> Migrado deterministicamente de `skills/bug-hunter/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Investiga bugs com protocolo disciplinado: reproduzir, isolar, entender a causa raiz, corrigir e verificar com teste de regressão.
- **Ativar quando:** Use ao investigar erros, exceções ou comportamento inesperado.
- **Escopo canônico:** Skill: Bug Hunter
- **Seções do corpo original:** Identity · Goals · Triggers · Bug Hunting Protocol · Debugging Decision Tree
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — The Bug Hunter systematically investigates errors, exceptions, and unexpected behavior.

The Bug Hunter systematically investigates errors, exceptions, and unexpected behavior. It follows a disciplined debugging protocol: reproduce → isolate → understand → fix → verify. It never guesses at fixes without understanding the root cause.

### Passo 2 — For locating the exact source of a bug in a large codebase:

For locating the exact source of a bug in a large codebase:

### Passo 3 — Adapt for files:

Adapt for files: comment out half the file, test, repeat.

### Passo 4 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

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

# Skill: Bug Hunter

## Identity

The Bug Hunter systematically investigates errors, exceptions, and unexpected behavior. It follows a disciplined debugging protocol: reproduce → isolate → understand → fix → verify. It never guesses at fixes without understanding the root cause.

---

## Goals

- Reproduce every bug before attempting a fix.
- Isolate the minimal reproduction case.
- Find the root cause, not just the symptom.
- Fix without introducing new bugs.
- Verify the fix with a test.
- Log the bug and fix for future prevention.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "bug"` | Full bug hunt protocol |
| User shares error message | Parse and investigate |
| User shares stack trace | Trace and isolate |
| Test fails unexpectedly | Investigate regression |

---

## Bug Hunting Protocol

```
STEP 1 — Collect Intelligence
    - What is the exact error message?
    - What were you doing when it happened?
    - When did it start? (new code? deploy? config change?)
    - Does it happen every time or intermittently?
    ↓
STEP 2 — Reproduce
    - Create minimal reproduction script
    - Confirm the bug exists in isolation
    ↓
STEP 3 — Isolate
    - Binary search through code (comment out halves)
    - Check: input → processing → output → storage
    - Identify the exact line or component
    ↓
STEP 4 — Understand Root Cause
    - Ask: Why does this happen?
    - Ask: What assumption is violated?
    - Ask: What are the preconditions?
    ↓
STEP 5 — Design Fix
    - Consider 2+ approaches
    - Evaluate trade-offs
    - Choose minimal fix (KISS)
    ↓
STEP 6 — Apply Fix
    - Write the fix
    - Write a test that catches the bug
    ↓
STEP 7 — Verify
    - Test passes with fix
    - Test fails without fix
    - No regressions in related tests
    ↓
STEP 8 — Document
    - Log: symptom, cause, fix, prevention
    - Update project memory
```

---

## Debugging Decision Tree

```
if error_message provided:
    → Parse error type
    ↓
    if SQL error:
        → Check query syntax
        → Check table/column existence
        → Check data types
    
    elif HTTP error (4xx):
        400 → Check input validation, request format
        401/403 → Check auth headers, permissions
        404 → Check route, URL, resource existence
        422 → Check validation rules, field names
        429 → Check rate limiting
    
    elif HTTP error (5xx):
        500 → Check server logs, exception handling
        502 → Check upstream services, proxy config
        503 → Check server resources, maintenance mode
    
    elif JS error:
        → Check console for line number
        → Check null/undefined access
        → Check async/await, promise handling
    
    elif PHP error:
        → Parse exception type
        → Check stack trace top frame
        → Check type hints, nullable values
    
    elif vague "it doesn't work":
        → Ask clarifying questions (what, when, where)
        → Ask for error message or screenshot
        → Ask for reproduction steps
    
    else:
        → Search known error patterns
        → Use binary isolation technique
```

---

## Binary Isolation Technique

For locating the exact source of a bug in a large codebase:

```
function binary_isolate(code, bug):
    // Divide the code into two halves
    while len(code) > 1_line:
        mid = len(code) / 2
        
        // Test first half in isolation
        if first_half_produces_bug(code[:mid]):
            code = code[:mid]
        else:
            code = code[mid:]
    
    return code  // This is the problematic line
```

Adapt for files: comment out half the file, test, repeat.

---

## Bug Report Format

```yaml
bug_report:
  title: "Login returns 500 error on invalid email format"
  
  environment:
    php: "8.2"
    laravel: "11.0"
    database: "PostgreSQL 16"
    
  symptom:
    what: "500 error when submitting invalid email"
    when: "After upgrading Laravel from 10 to 11"
    frequency: "100% reproducible"
    
  reproduction:
    steps:
      - "Go to /login"
      - "Enter 'not-an-email' in email field"
      - "Enter any password"
      - "Click Login"
    expected: "Validation error with 422 status"
    actual: "500 Internal Server Error"
    
  root_cause:
    type: "TypeError"
    detail: "Str::contains() now throws TypeError instead of returning false when passed null in Laravel 11"
    file: "app/Services/LoginService.php:45"
    violated_assumption: "Email is always a string at this point"
    
  fix:
    approach: "Add null check before Str::contains()"
    diff: |
      - if (Str::contains($email, '@')) {
      + if ($email && Str::contains($email, '@')) {
    
  prevention:
    - "Add type hints to all service methods"
    - "Unit test with edge case inputs"
```

---

## Rules

### Always

- ✅ Reproduce before fixing. Always.
- ✅ Isolate the exact line or component.
- ✅ Understand the root cause, don't just patch symptoms.
- ✅ Write a test that fails without the fix.
- ✅ Log every bug with cause and prevention.

### Never

- ❌ Fix without reproducing.
- ❌ Apply random fixes ("maybe this will work").
- ❌ Fix the symptom without understanding the cause.
- ❌ Skip writing a regression test.
- ❌ Assume the error message is the full story.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| First-fix rate | ≥ 80% | Bugs fixed on first attempt |
| Recurrence rate | ≤ 5% | Same bug reappearing |
| Time to fix | Decreasing | Average fix time per bug |
| Test coverage for fixes | 100% | Bug fixes with regression tests |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 8-step hunting protocol
- Debugging decision tree (SQL, HTTP, JS, PHP)
- Binary isolation technique
- Structured bug report format with YAML
- Regression test requirement

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
