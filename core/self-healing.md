# Self-Healing & Failure Memory

> Status: **IMPLEMENTED** — `src/runtime/recovery/healing.ts`, `src/runtime/memory/store.ts`
> Versão: 3.0.0 | Compatibilidade: >= 2.0.0

## Propósito

Classificar falhas e aplicar a estratégia de recuperação correta, com limites rígidos para impedir loops infinitos. Falhas são transformadas em padrões reutilizáveis consultados antes de cada execução.

## Classificação de falhas

| Tipo | Exemplo | Estratégia |
|---|---|---|
| `recoverable` | timeout, 429, 5xx | retry com backoff exponencial |
| `validation` | artefato fora do contrato | skill replacement corretivo + retry |
| `planning` | grafo cíclico | replan (reconstrói grafo) |
| `tool` | comando falhou | handoff para devops ou retry |
| `agent` | saída inconsistente | handoff para techlead |
| `dependency` | módulo ausente | handoff para bug-hunter |
| `non-recoverable` | falha estrutural | abort com relatório |

## Pipeline

```text
Failure → Classification → Padrão conhecido? → SIM: local repair guiado
                                → NÃO: transitória → retry (backoff)
                                → NÃO: validação → skill replacement
                                → NÃO: planejamento → replan
                                → NÃO: demais → handoff / abort
```

Limites: `maxAttempts`, `maxTokens`, `maxTime` — excedeu qualquer um → abort.

## Failure Memory

Categorias: `episodic`, `semantic`, `procedural`, `decision`, `failure`, `skill`, `project`.

Padrão de falha (`.izanagi/state/runtime-state.json`):

```json
{
  "pattern": "NEXT-HYDRATION-017",
  "symptoms": ["Cannot read properties of null"],
  "rootCause": "acesso a window no SSR",
  "solution": "guard typeof window",
  "confidence": 0.94,
  "occurrences": 3
}
```

`findRelevantFailures(query)` é consultado antes de toda execução — solução conhecida aplicada imediatamente.

## CLI

```bash
izanagi memory inspect       # estado da memória (patterns, learnings, stats)
izanagi memory search <q>    # busca nas categorias markdown
```

## Testes

`src/runtime/tests/healing.test.ts`, `memory.test.ts` — cobertura: classificação, limites, consolidação de padrões, relevância.
