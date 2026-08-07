# Core: Reflection Engine

> Version 1.0.0
> Priority: High
> Dependencies: Memory Manager, Evolution Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Reflection Engine activates after every task execution. It reviews what was done, identifies what went well and what can improve, logs patterns and mistakes, and feeds data into the Evolution Engine to update skills over time.

---

## Goals

- Review every task after delivery.
- Identify at least 1 improvement opportunity per task.
- Log all mistakes to prevent recurrence.
- Feed structured data to the Evolution Engine.
- Build a personal improvement history for the agent.

---

## Workflow

```
1. Task completes
    ↓
2. Gather execution data
    - Input, classification, chain used
    - Token usage per skill
    - Quality gate results
    ↓
3. Run self-review questions
    - What went well?
    - What could be better?
    - Was the classification correct?
    - Was context sufficient?
    - Were quality gates passed?
    ↓
4. Check for patterns
    - Recurring mistakes
    - Recurring clarifications
    - Token waste patterns
    ↓
5. Generate reflection output
    ↓
6. Pass to Memory Manager (log)
    ↓
7. Pass to Evolution Engine (if pattern found)
```

---

## Self-Review Questions

### Quality

- Was the output complete?
- Did it answer all user questions?
- Was it concise?
- Was it correct?

### Process

- Was the classification accurate?
- Was the skill chain optimal?
- Was context sufficient?
- Was budget respected?

### Security

- Were any secrets exposed?
- Were any vulnerabilities introduced?
- Was security validated?

### Teaching

- Did the user learn something?
- Did I explain the reasoning?
- Was the explanation appropriate for the user level?

---

## Reflection Log Format

```yaml
reflection:
  task_id: "task-20260717-001"
  timestamp: "2026-07-17T11:30:00Z"
  classification: "new_feature"
  chain: ["architect", "security", "backend", "testing"]
  
  scores:
    completeness: 4.5 / 5
    conciseness: 4.0 / 5
    correctness: 5.0 / 5
    teaching: 3.5 / 5
    
  wins:
    - "Architecture was clean and well-explained"
    - "Security considerations included early"
    
  improvements:
    - "Could have included more testing examples"
    - "Token budget exceeded by 12%"
    
  patterns:
    - type: "token_waste"
      detail: "Verbose code examples in security section"
      frequency: 3
    
  evolution_triggers:
    - skill: "backend-engineer"
      suggestion: "Add token budget optimization for code examples"
```

---

## Pattern Detection

The engine maintains a rolling window of the last 50 reflections to detect:

| Pattern | Detection | Action |
|---------|-----------|--------|
| Token waste | >5 compressions in 10 tasks | Update Token Manager budget |
| Misclassification | >3 clarifications for same category | Update Decision Engine keywords |
| Repeated mistakes | >2 same improvement items | Flag for Evolution Engine |
| User confusion | >2 follow-up clarifications | Add teaching moment to output |
| Security gaps | Any security item missed | Immediate skill update |

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Tasks reflected | 100% | Reflections / total tasks |
| Improvements per task | ≥ 1 | Count improvement items |
| Pattern detection rate | ≥ 80% | Patterns found / patterns present |
| Evolution triggers | ≥ 1 per 10 tasks | Count triggers generated |

---

## Reflection Quality Gates

1. ✅ Reflection is generated for every task.
2. ✅ At least 1 improvement identified.
3. ✅ Scores are honest (not all 5/5).
4. ✅ Patterns are detected (if present).

---

## Memory Hooks

```yaml
on_reflect:
  - save: reflection_log
  - save: pattern_window (rolling 50)

on_pattern_detected:
  - notify: Evolution Engine
  - save: pattern_alert

on_complete:
  - compress: reflection_log if > budget
```

---

## Persistência Real (Memory Hooks)

O YAML acima é teórico — a persistência de verdade acontece em `.agents/memoria/` (ver skill `memoria-projeto`). Ao final de cada tarefa:

| O que aconteceu | Hook |
|---|---|
| Erro corrigido (1ª vez) | append 1 linha em `.agents/memoria/erros-corrigidos.md` |
| Erro repetido (2+ vezes) | marcação `[REINCIDÊNCIA]` + contagem em `learnings.md` |
| Decisão de arquitetura/design | append 1 linha em `.agents/memoria/decisoes.md` |
| Padrão de código novo / convenção | append 1 linha em `.agents/memoria/contexto.md` |

Regras: append (nunca reescrever), entrada de 1-3 linhas no formato `- [AAAA-MM-DD] descrição`, sem dados sensíveis. Sem arquivo de memória → nada a persistir (reflexão vira log interno apenas).

## Triagem Anti-Repetição (antes da entrega)

Antes de entregar, responda contra `.agents/memoria/`:

1. **Já resolvido?** — `erros-corrigidos.md`/`learnings.md` têm solução para este problema? Se sim, aplique a correção registrada em vez de debug novo.
2. **Armadilha registrada?** — `learnings.md` marca armadilha desta área/stack? Não trilhe o caminho conhecido como errado.
3. **Decisão contraditória?** — `decisoes.md` tem decisão prévia que invalida o plano? Alinhe antes de prosseguir.

Falhou em qualquer uma → entregue citando a entrada de memória usada, sem silenciar a contradição.

## Loop de Correção em 1 Passe

Se um erro se repetir:

1. **Pare** — não trilhe o mesmo caminho de debug.
2. Abra `learnings.md` / `erros-corrigidos.md` e localize a entrada do erro.
3. Aplique a **correção definitiva registrada** — direto, sem re-explorar.
4. Registre a reincidência (contagem +1, marcação `[REINCIDÊNCIA]`).

NUNCA percorra o mesmo debug duas vezes — a memória existe exatamente para isso.

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Post-task self-review with scoring
- Pattern detection over rolling 50-task window
- Structured reflection log in YAML format
- Integration with Evolution Engine
- 5 dimensions of review: quality, process, security, teaching, efficiency
