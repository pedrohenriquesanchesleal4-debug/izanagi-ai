---
name: "technical-debt-analyzer"
description: "Identifica, quantifica e prioriza dívida técnica (código, design, testes, docs, infra, segurança) em um backlog priorizado por custo e impacto. Use ao planejar refatorações ou avaliar saúde técnica do projeto. Gatilhos de ativação: skill: technical debt analyzer; identity; debt categories; debt estimation."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill: Technical Debt Analyzer

> Migrado deterministicamente de `skills/technical-debt-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Identifica, quantifica e prioriza dívida técnica (código, design, testes, docs, infra, segurança) em um backlog priorizado por custo e impacto.
- **Ativar quando:** Use ao planejar refatorações ou avaliar saúde técnica do projeto.
- **Escopo canônico:** Skill: Technical Debt Analyzer
- **Seções do corpo original:** Identity · Debt Categories · Debt Estimation · Debt Backlog · Changelog
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Technical Debt Analyzer identifies, quantifies, and prioritizes technical debt.

Technical Debt Analyzer identifies, quantifies, and prioritizes technical debt. Measures debt as "time to fix" vs "time to implement correctly." Produces a prioritized backlog for debt reduction.

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

# Skill: Technical Debt Analyzer

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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
