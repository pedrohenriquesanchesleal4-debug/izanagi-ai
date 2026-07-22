---
name: sre-reliability
description: |
  Skill de Site Reliability Engineering (SRE) para o Portal. Aborda SLIs/SLOs/SLAs,
  error budgets, observabilidade, incident response, capacity planning e reliability patterns.
  Use esta skill para garantir confiabilidade e disponibilidade do sistema.
---

# Skill SRE & Reliability — Portal

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
