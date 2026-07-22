# Exemplo: Skill Compacta vs Atual

> Demonstração da economia de tokens com o novo formato.

---

## Antes (850 tokens) — `skills/bug-hunter.md`

```markdown
# Skill: Bug Hunter

> Version 1.0.0 | Priority: High
> Dependencies: Debug Specialist, Root Cause Analyzer
> Compatibility: ">=1.0.0"

## Identity

The Bug Hunter systematically investigates errors, exceptions, and unexpected behavior...

## Goals

- Reproduce every bug
- Isolate minimal reproduction case
- Find root cause, not symptom

## Triggers

| Condition | Action |
|-----------|--------|
| task == "bug" | Full protocol |
| User shares error | Parse/investigate |

## Steps

1. Collect intelligence
2. Reproduce
3. Isolate
4. Understand root cause
5. Design fix
6. Apply fix
7. Verify
8. Document

## Rules

### Always
- Reproduce before fixing

### Never
- Fix without reproducing

## Metrics...
```

---

## Depois (320 tokens) — mesmo conteúdo

```yaml
---
v: 1.0.0 | p: high
deps: [debug, root-cause]
triggers: [bug, error, crash]
budget: 500
---
# Bug Hunter — protocolo 8 passos

## Steps
1. collect_intel — erro exato, input, ambiente, mudanças recentes
2. reproduce — script mínimo que reproduz
3. isolate — busca binária (comenta metade, testa, repete)
4. understand — 5 Whys, causa raiz
5. design_fix — 2+ abordagens, escolhe a mínima
6. apply — código + test que falha sem o fix
7. verify — test passa, sem regressão
8. document — causa, fix, prevenção

## Always
- Reproduzir antes de qualquer fix
- Teste de regressão obrigatório

## Never
- "talvez isso resolva" — sem chute
- Pular reprodução
```

**Economia: 850 → 320 tokens (-62%).**
