# Execution Graph & Orchestration

> Status: **IMPLEMENTED** — `src/runtime/orchestration/graph.ts`, `planner.ts`, `orchestrator.ts`
> Versão: 3.0.0 | Compatibilidade: >= 2.0.0

## Propósito

Transformar cada execução complexa em um grafo explícito, construído dinamicamente conforme a tarefa — nunca workflows gigantes estáticos.

## Node

```json
{
  "id": "architecture",
  "kind": "agent",
  "agent": "architect",
  "skills": ["architecture-patterns"],
  "inputs": ["requirements"],
  "outputs": ["architecture"],
  "dependencies": ["discovery"],
  "retryPolicy": { "maxAttempts": 2, "backoffMs": 500 },
  "timeoutMs": 300000,
  "tokenBudget": 4000,
  "validator": "architecture"
}
```

Kinds: `agent`, `skill`, `tool`, `validator`, `evaluator`, `aggregator`, `parallel`, `gate`.

## Templates (planner)

| Template | Grafo |
|---|---|
| `fullstack` | discovery → architect → (security ∥ database ∥ product) → senior-engineer → (qa-gate ∥ critic) → evaluation |
| `debugging` | reproduce → root-cause → fix → regression-test → evaluation |
| `security_audit` | scan → deep-analysis → remediation → critic → evaluation |
| `architecture` | research → design → adr → evaluation |
| `automacao` | plan → build → test → evaluation |
| `frontend` | design-direction → design-system → implementation → (perf-check ∥ critic) → evaluation |
| `implementation` | execute → verify → evaluation |

## Paralelismo

O planner detecta dependências e computa `parallelBatches`: nós sem dependência mútua executam em paralelo, `aggregator` combina resultados.

## Orçamento global

`maxAttempts` (3), `maxTokens` (32k), `maxTimeMs` (900s) — impede loops infinitos.

## CLI

```bash
izanagi workflow list                    # templates + composições
izanagi workflow inspect fullstack       # detalha um grafo
izanagi run "tarefa" --runtime           # executa via Orchestrator (graph + eval + trace)
```

## Testes

`src/runtime/tests/graph.test.ts` — cobertura: ordem topológica, batches paralelos, detecção de ciclo, subgraph, replan.
