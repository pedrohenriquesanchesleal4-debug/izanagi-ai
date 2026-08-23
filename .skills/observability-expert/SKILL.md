---
name: "observability-expert"
description: "Instrumentação com OpenTelemetry, logs estruturados e correlação por trace_id/span_id para achar causa raiz em microsserviços. Use ao instrumentar sistemas distribuídos ou debugar produção. Gatilhos de ativação: observability expert (tracing distribuído e logs estruturados); когда usar / quando usar; os 3 pilares da observabilidade; exemplo de log estruturado em json (padrão izanagi)."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Observability Expert (Tracing Distribuído e Logs Estruturados)

> Migrado deterministicamente de `skills/observability-expert/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Instrumentação com OpenTelemetry, logs estruturados e correlação por trace_id/span_id para achar causa raiz em microsserviços.
- **Ativar quando:** Use ao instrumentar sistemas distribuídos ou debugar produção.
- **Escopo canônico:** Observability Expert (Tracing Distribuído e Logs Estruturados)
- **Seções do corpo original:** Когда usar / Quando usar · Os 3 Pilares da Observabilidade · Exemplo de Log Estruturado em JSON (Padrão Izanagi) · Checklist de qualidade · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Métricas (Metrics):

**Métricas (Metrics)**: O *quê* está acontecendo (contadores, histogramas, taxas).

### Passo 2 — Logs (Logs):

**Logs (Logs)**: O *porquê* aconteceu (eventos discretos com contexto e JSON estruturado).

### Passo 3 — Traces (Traces):

**Traces (Traces)**: O *caminho* que a requisição fez por entre os serviços (Distributed Tracing).

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Logs emitidos estritamente em formato JSON estruturado (sem `console.log` solto)
- [ ] Propagação de `trace_id` em todas as chamadas HTTP de saída
- [ ] Instrumentação OpenTelemetry configurada nos serviços críticos

## Common Rationalizations

- **"Funciona na minha máquina, o problema é o ambiente."**
  - Verdade: Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.
- **"Deploy manual hoje, pipeline depois que estabilizar."**
  - Verdade: Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.
- **"Monitoramento a gente implanta quando escalar."**
  - Verdade: Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.
- **"Rollback nunca precisamos, pra que testar?"**
  - Verdade: A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.
- **"CI tá lento, vou pular os checks só dessa vez."**
  - Verdade: 'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.
- **"Alerta demais incomoda, melhor só o essencial depois."**
  - Verdade: Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.

## Red Flags

- Pipeline sem etapa obrigatória de build+teste antes do deploy.
- Secrets impressos no log de CI (mesmo mascarados tardiamente).
- Serviço sem healthcheck/readiness probe configurado.
- Infra alterada direto no console, fora do código versionado (drift).
- Single point of failure sem redundância nem plano documentado.
- Backup existente mas nunca restaurado em teste.
- Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.

## Legacy Reference (v1)

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
