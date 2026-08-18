---
name: observability-expert
description: "Instrumentação com OpenTelemetry, logs estruturados e correlação por trace_id/span_id para achar causa raiz em microsserviços. Use ao instrumentar sistemas distribuídos ou debugar produção."
---

# Observability Expert (Tracing Distribuído e Logs Estruturados)

Especialista em observabilidade corporativa: instrumentação com **OpenTelemetry**, logs estruturados em JSON com correlação por `trace_id`, e depuração cirúrgica de gargalos em sistemas distribuídos.

## Когда usar / Quando usar

Use ao: instrumentar microsserviços ou aplicações web modernas; diagnosticar lentidões intermitentes ou erros propagados entre múltiplos serviços. **Pule** para: monitoramento básico de infraestrutura (skill `monitoring-specialist`).

## Os 3 Pilares da Observabilidade
1. **Métricas (Metrics)**: O *quê* está acontecendo (contadores, histogramas, taxas).
2. **Logs (Logs)**: O *porquê* aconteceu (eventos discretos com contexto e JSON estruturado).
3. **Traces (Traces)**: O *caminho* que a requisição fez por entre os serviços (Distributed Tracing).

## Exemplo de Log Estruturado em JSON (Padrão Izanagi)
```json
{
  "timestamp": "2026-08-10T19:30:00.123Z",
  "level": "ERROR",
  "service": "billing-api",
  "trace_id": "a1b2c3d4e5f6",
  "span_id": "789012",
  "event": "payment_gateway_timeout",
  "latency_ms": 5002,
  "client_id": "cust_8812"
}
```

## Checklist de qualidade
- [ ] Logs emitidos estritamente em formato JSON estruturado (sem `console.log` solto)
- [ ] Propagação de `trace_id` em todas as chamadas HTTP de saída
- [ ] Instrumentação OpenTelemetry configurada nos serviços críticos

## Anti-padrões (proibido)
1. ❌ Strings de log soltas sem contexto (`console.log("deu erro aqui")`)
2. ❌ Logar dados sensíveis (senhas, cartões de crédito, tokens) nos objetos de log

## Composição com outras skills
- **Before**: `monitoring-specialist` (métricas) → `devops` (infra)
- **After**: `bug-hunter` (análise de causa raiz) → `sre-reliability` (incident response)

## References
- OpenTelemetry Documentation: https://opentelemetry.io · Distributed Tracing in Practice.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI: cópia fiel de `skills/observability-expert/SKILL.md` (fonte da verdade).
