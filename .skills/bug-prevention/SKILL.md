---
name: "bug-prevention"
description: "Analisa código antes de bugs acontecerem: tipagem estrita, análise estática, testes e checklist de revisão para classes inteiras de bugs. Use ao revisar código para prevenir bugs recorrentes. Gatilhos de ativação: skill: bug prevention; identity; prevention layers; common bug patterns."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Bug Prevention

> Migrado deterministicamente de `skills/bug-prevention/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Analisa código antes de bugs acontecerem: tipagem estrita, análise estática, testes e checklist de revisão para classes inteiras de bugs.
- **Ativar quando:** Use ao revisar código para prevenir bugs recorrentes.
- **Escopo canônico:** Skill: Bug Prevention
- **Seções do corpo original:** Identity · Prevention Layers · Common Bug Patterns · Bug Prevention Score · Changelog
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Bug Prevention analyzes code before bugs happen.

Bug Prevention analyzes code before bugs happen. Identifies common bug patterns, applies static analysis, enforces type safety, and suggests defenses against entire classes of bugs.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

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

# Skill: Bug Prevention

## Identity

Bug Prevention analyzes code before bugs happen. Identifies common bug patterns, applies static analysis, enforces type safety, and suggests defenses against entire classes of bugs.

---

## Prevention Layers

```yaml
layer_1_types:
  - Strict types (PHP declare(strict_types=1))
  - Type hints on all functions (PHP 8.2+, TypeScript)
  - No mixed/any types (use union types)
  - Readonly properties for immutability

layer_2_static_analysis:
  - PHPStan level max / Psalm
  - TypeScript strict mode
  - ESLint with type-checked rules
  - SonarQube / CodeQL

layer_3_testing:
  - TDD for complex logic
  - Property-based testing (edge cases)
  - Mutation testing (verify tests catch bugs)
  - Contract testing for API boundaries

layer_4_process:
  - Code review checklist with high-risk items
  - Mandatory review for: auth, payments, data deletion
  - Pre-commit hooks for static analysis
  - Canary deployments for risky changes
```

---

## Common Bug Patterns

| Pattern | Detection | Prevention |
|---------|-----------|------------|
| Null reference | Static analysis, type hints | Nullable types, null checks |
| Off-by-one | Code review | Use collection methods (not raw loops) |
| SQL injection | Static analysis, review | Parameterized queries (always) |
| Race condition | Review, testing | Locks, transactions, idempotency |
| Floating point | Review | Use decimal/bigint for money |
| Inconsistent state | Review, testing | Unit of Work, transactions |
| Unhandled error | Static analysis | Global error handler, typed exceptions |

---

## Bug Prevention Score

```yaml
prevention_score: 72 / 100

layers:
  types: 80% (some mixed types remain)
  static_analysis: 60% (PHPStan level 6, target level max)
  testing: 70% (unit tests but no mutation)
  process: 80% (reviews done but no high-risk checklist)
```

---

## Changelog

### 1.0.0 — Initial release. Prevention layers, bug patterns, scoring.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
