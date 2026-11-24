---
name: "sre-reliability"
description: "Use para definir SLIs/SLOs/SLAs, error budget, observabilidade, resposta a incidentes e capacity planning visando confiabilidade do sistema. Gatilhos de ativação: skill sre & reliability — izanagi; sre fundamentals; error budget; observabilidade."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Skill SRE & Reliability — Izanagi

> Migrado deterministicamente de `skills/sre-reliability/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para definir SLIs/SLOs/SLAs, error budget, observabilidade, resposta a incidentes e capacity planning visando confiabilidade do sistema.
- **Ativar quando:** Use para definir SLIs/SLOs/SLAs, error budget, observabilidade, resposta a incidentes e capacity planning visando confiabilidade do sistema.
- **Escopo canônico:** Skill SRE & Reliability — Izanagi
- **Seções do corpo original:** SRE Fundamentals · Error Budget · Observabilidade · Incident Response · Reliability Patterns
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Detect:

**Detect**: alerta (PagerDuty) ou report de usuario

### Passo 2 — Triage:

**Triage**: determinar severidade, notificar equipe

### Passo 3 — Mitigate:

**Mitigate**: rollback, feature flag, scale up

### Passo 4 — Resolve:

**Resolve**: aplicar fix permanente

### Passo 5 — Learn:

**Learn**: postmortem (blameless), acoes preventivas

---

## Verification Steps

<!-- fonte da verificação: fallback-honesto:devops -->

- Provar o pipeline ponta a ponta em ambiente de teste antes de produção.
- Confirmar healthcheck, rollback e alertas acionáveis configurados para o que foi alterado.
- Verificar que nenhum secret aparece em logs/manifestos gerados.
- Registrar versão, timestamp de deploy e resultado dos checks (rastreabilidade).

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

# Skill SRE & Reliability — Izanagi

## SRE Fundamentals

### SLIs (Service Level Indicators)
| Indicador | Metrica |
|-----------|---------|
| Availability | `(successful_requests / total_requests) * 100` |
| Latency | `p50, p95, p99` response time |
| Throughput | Requests per second |
| Error Rate | `(5xx / total) * 100` |
| Saturation | CPU/Memory/Disk usage % |

### SLOs (Service Level Objectives)
```
Latency: 99% of requests < 500ms (p99 rolling 30d)
Availability: 99.9% uptime (monthly)
Error Rate: < 0.1% 5xx errors
```

### SLAs (Service Level Agreements)
- **99.9%** = 8.77h downtime/year (aceitavel)
- **99.99%** = 52.56m downtime/year (recomendado)
- **99.999%** = 5.26m downtime/year (critico)

---

## Error Budget

```
Error Budget = 100% - SLO
ex: SLO 99.9% → Error Budget = 0.1% = ~43min/month
```

- **Disponivel**: tempo que o sistema pode falhar sem violar SLO
- **Uso**: deploys so sao permitidos se error budget ainda disponivel
- **Se esgotar**: congelamento de deploys ate recuperar

---

## Observabilidade

### Three Pillars
```
Logs (events) + Metrics (aggregations) + Traces (distributed)
```

### Stack Recomendada
| Ferramenta | Uso |
|------------|-----|
| Grafana + Prometheus | Metrics + dashboards |
| Sentry | Error tracking |
| OpenTelemetry | Distributed tracing |
| Vercel Analytics | Core Web Vitals |
| CloudWatch | AWS metrics + logs |
| PagerDuty / OpsGenie | On-call alerting |

---

## Incident Response

### Severity Levels
| Severity | Exemplo | SLA Response |
|----------|---------|-------------|
| SEV-1 | Site down | 15min |
| SEV-2 | Feature broken | 1h |
| SEV-3 | Bug menor | 8h |
| SEV-4 | Cosmetico | Next sprint |

### Response Process
1. **Detect**: alerta (PagerDuty) ou report de usuario
2. **Triage**: determinar severidade, notificar equipe
3. **Mitigate**: rollback, feature flag, scale up
4. **Resolve**: aplicar fix permanente
5. **Learn**: postmortem (blameless), acoes preventivas

---

## Reliability Patterns

| Pattern | Descricao |
|---------|-----------|
| Circuit Breaker | Parar chamadas a servico falho, retry apos timeout |
| Bulkhead | Isolar recursos por servico (thread pools separados) |
| Retry with Backoff | Exponential backoff + jitter |
| Timeout | Sempre configurar timeouts em chamadas externas |
| Rate Limiting | Proteger contra abuso e picos de trafego |
| Graceful Degradation | Funcionalidades nao-criticas falham sem quebrar o core |
| Health Checks | Endpoint `/health` para readiness/liveness |

---

## Capacity Planning

```yaml
# Metrica de crescimento
requests_per_month: 1_000_000
growth_rate: 20%  # anual
projected: 1_200_000  # proximo ano
```

### Passos
1. Monitorar trafego atual + tendencias
2. Identificar bottlenecks (DB, API, compute)
3. Calcular capacidade necessaria (com buffer de 50%)
4. Auto-scaling configurado (min/max/desired)
5. Load test periodicos para validar

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
