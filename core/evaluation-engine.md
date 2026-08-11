# Evaluation Engine

> Status: **IMPLEMENTED** — `src/runtime/evaluation/engine.ts` + `src/runtime/contracts/artifacts.ts`
> Versão: 3.0.0 | Compatibilidade: >= 2.0.0

## Propósito

Avaliar resultados de agentes e workflows com métricas estruturadas e verdict derivado por thresholds. O Evaluation Engine é a primitiva que alimenta decisões de self-healing, learning e relatórios de benchmark.

## Verdicts

| Verdict | Critério |
|---|---|
| `PASS` | score >= 0.85, zero testes falhando, zero regressões |
| `PASS_WITH_WARNINGS` | score >= 0.70, ou testes pulados |
| `FAIL` | testes falhando, regressões, ou score < 0.70 |
| `BLOCKED` | falha estrutural sem nenhum teste passando |
| `UNKNOWN` | sem evidência suficiente |

## Métricas (ponderação padrão)

| Métrica | Peso |
|---|---|
| correctness | 0.30 |
| testResults | 0.20 |
| requirementCoverage | 0.15 |
| architecture | 0.10 |
| security | 0.10 |
| performance | 0.05 |
| maintainability | 0.05 |
| artifactValidity | 0.05 |

Métricas não medidas são ignoradas na ponderação (não penalizam), mas reduzem a `confidence` da avaliação.

## Contrato de saída

```json
{
  "taskId": "...",
  "success": true,
  "score": 0.94,
  "confidence": 0.91,
  "metrics": { "correctness": 0.96, "security": 0.93 },
  "tests": { "passed": 42, "failed": 0 },
  "regressions": [],
  "recommendations": []
}
```

## Artefatos & Validação

Schemas em `src/runtime/contracts/artifacts.ts` para: `requirements`, `architecture`, `database-schema`, `api-contract`, `security-report`, `test-plan`, `implementation-plan`, `evaluation`, `research`, `trace`. Validação detecta stubs (`TODO`, `FIXME`, `implement later`), campos obrigatórios ausentes e tamanho mínimo. Artefato inválido → `INVALID → REPAIR → RE-EVALUATE`.

## CLI

```bash
izanagi eval <file.json>            # avalia métricas de um artefato JSON
izanagi eval --metrics correctness=0.9,security=0.8
izanagi eval --report <run-id>      # avaliação registrada de um run
```

## Testes

`src/runtime/tests/evaluation.test.ts` — cobertura: weighted score, verdicts, testMetrics, confidence, thresholds custom.
