# Tracing & Observability

> Status: **IMPLEMENTED** — `src/runtime/observability/tracer.ts`
> Versão: 3.0.0 | Compatibilidade: >= 2.0.0

## Propósito

Cada execução registra em `.izanagi/state/traces/<run-id>.json`:

```text
task, command, startedAt/endedAt, durationMs, model, tokens (in/out/total),
retries, failures, agents, skills, tools, artifacts, evaluation (score/verdict),
healing (ações), spans (task/decision/agent/skill/tool/model/evaluation/...),
execution graph (nós + status + erro)
```

## CLI

```bash
izanagi trace                 # lista as últimas 20 execuções (run-id, verdict, score)
izanagi trace <run-id>        # detalhe: spans, healing, graph, avaliação
izanagi eval --report <run-id>  # só a avaliação
```

## Span

```json
{
  "id": "3-model-router",
  "name": "model-router:claude-sonnet-4-5",
  "type": "decision",
  "status": "ok",
  "startedAt": "...",
  "endedAt": "...",
  "durationMs": 12,
  "metadata": { "reasons": [] }
}
```

## Testes

`src/runtime/tests/tracer.test.ts` — cobertura: spans, persistência, listagem, runId.
