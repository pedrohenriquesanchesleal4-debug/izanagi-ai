# Token Optimization Audit

> Análise de consumo atual + plano de redução de 40-60%.

---

## 1. Diagnóstico — Onde os tokens estão sendo gastos

### 1.1 Estruturas Repetidas (principal vilão)

Cada uma das 98 skills repete o mesmo molde:

```
> Version X | Priority: X
> Dependencies: ...
> Compatibility: ...

## Identity (2-3 parágrafos)
## Goals (lista)
## Triggers (tabela)
## Checklist
## Examples (before/after)
## Changelog
```

**Custo:** ~400 tokens repetidos por skill × 98 skills = **~39.200 tokens** de boilerplate.

### 1.2 YAML Frontmatter vs Formato Atual

O formato atual usa markdown com cabeçalhos. YAML inline seria mais compacto.

### 1.3 Descrições Prolixas

Muitas skills explicam o óbvio. Exemplo real:

```
"We designed this schema with the goal of..."
→ "Schema 3NF com índices em FK, WHERE, ORDER BY."
```

### 1.4 Checklists Duplicadas

OWASP checklist aparece em `security-engineer.md` e `owasp-auditor.md`. Idem para SOLID, Clean Code, etc.

---

## 2. Plano de Redução por Técnica

### Técnica A — Skill Template Compacto (economia: 35%)

Substituir o cabeçalho verbose por YAML inline:

```yaml
# ANTES (79 tokens)
> Version 1.0.0 | Priority: High
> Dependencies: Software Architect, Database Engineer, Security Engineer
> Compatibility: ">=1.0.0"

## Identity
Responsável por projetar a arquitetura...

# DEPOIS (28 tokens)
v: 1.0.0 | p: high | deps: [architect, db, security]
```

**Impacto:** 39.200 → 14.000 tokens (economia de ~25.200 tokens em carga inicial).

### Técnica B — Unificar Checklists Duplicadas (economia: 15%)

Checklists que aparecem em múltiplos lugares viram referências:

```
# ANTES
skills/security-engineer.md tem OWASP checklist (150 tokens)
security/owasp-auditor.md tem OWASP checklist (150 tokens)

# DEPOIS
security/owasp-checklist.md (única fonte)
Referenciado por: security-engineer.md, owasp-auditor.md, pentest-reviewer.md
```

**Impacto:** elimina ~300 tokens duplicados por checklist unificada.

### Técnica C — Short IDs para Skills (economia: 8%)

Usar IDs curtos nas chains:

```
# ANTES
"skills/software-architect", "skills/senior-code-reviewer"

# DEPOIS
"architect", "reviewer"
```

**Impacto:** reduz ~15 tokens por referência em agents.json.

### Técnica D — Remover "Changelog" de Skills Individuais (economia: 5%)

Changelog de cada skill individual raramente é lido. Manter só no CHANGELOG.md central.

**Impacto:** ~30 tokens por skill × 98 = ~2.940 tokens.

### Técnica E — Comprimir Descrições (economia: 20%)

Reduzir identity/goals para 1 linha cada:

```
# ANTES (60 tokens)
"Responsável por projetar a arquitetura de software antes que qualquer código seja escrito. É a primeira skill ativada em projetos novos."

# DEPOIS (20 tokens)
"Arquiteta antes de codificar. Ativada primeiro em projetos novos."
```

---

## 3. Estimativa de Economia Total

| Técnica | Tokens Salvos | % | Esforço |
|---------|--------------|---|---------|
| A — Template compacto | ~25.200 | 35% | Alto (reescrever 98 skills) |
| B — Checklists unificadas | ~4.500 | 15% | Médio (extrair 10 checklists) |
| C — Short IDs | ~2.000 | 8% | Baixo (sed nos agents) |
| D — Remove changelogs | ~2.940 | 5% | Baixo (sed global) |
| E — Descrições comprimidas | ~14.000 | 20% | Alto (revisão manual) |
| **Total** | **~48.640** | **~55%** | — |

---

## 4. Ações Imediatas (baixo esforço, alto retorno)

### 4.1 Template Compacto para Skills Novas

Toda skill nova usa este formato:

```yaml
---
v: 1.0.0
p: high
deps: [skill-a, skill-b]
triggers: [new_project, new_feature]
budget: 500
---
```

### 4.2 Unificar Checklists Agora

| Checklist | Dono | Skills que referenciam |
|-----------|------|----------------------|
| OWASP Top 10 | security/owasp-checklist.md | security-engineer, owasp-auditor, pentest-reviewer |
| SOLID | quality/solid-checklist.md | solid-validator, clean-code-validator, code-reviewer |
| Performance | quality/perf-checklist.md | performance-optimizer, scalability-expert |
| Acessibilidade | quality/a11y-checklist.md | accessibility-reviewer, ux-reviewer, frontend-engineer |

### 4.3 Short IDs nos Agents

```json
// agents/architect-agent.json
"skills": ["architect", "clean-arch", "ddd", "cqrs"]
// Resolve para skills/software-architect.md, architecture/clean-architecture.md, etc.
```

---

## 5. Meta

| Métrica | Atual | Alvo | Prazo |
|---------|-------|------|-------|
| Tokens para carregar tudo | ~88.000 | ≤ 40.000 | v2.0 |
| Tokens por skill (média) | ~900 | ≤ 400 | v2.0 |
| Checklists duplicadas | 12 | 0 | v1.1 |
| Boilerplate por skill | ~400 | ~100 | v2.0 |

---

> "O melhor token é o que você não gasta."
