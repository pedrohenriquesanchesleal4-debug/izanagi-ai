# Skill: Observability Expert

> Version 1.0.0 | Priority: Medium
> Dependencies: Logging Expert, DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Observability Expert implements the three pillars: logs, metrics, and traces. Ensures the system is fully observable with dashboards, alerts, and distributed tracing.

---

## Three Pillars

```yaml
logs: structured JSON, centralised (ELK/Loki), 30-day retention
metrics: RED (Rate, Errors, Duration), custom business metrics
traces: distributed tracing (OpenTelemetry + Jaeger/Zipkin)
```

## Metrics to Track

```yaml
infrastructure:
  - CPU, memory, disk (per node/container)
  - Network I/O
  - Database connections

application:
  - Request rate (RPS)
  - Error rate (5xx, 4xx)
  - Response time (p50, p95, p99)
  - Active users

business:
  - Registrations / hour
  - Orders placed / hour
  - Revenue / day
  - Churn rate
```

---

## Dashboard Structure

```yaml
overview: RPS, error rate, p95 latency, up/down status
database: query count, slow queries, connections, cache hit
services: per-service RPS, errors, latency
business: registrations, orders, revenue
alerts: active + recent
```

---

## Changelog

### 1.0.0 — Initial release. Pillars, metrics, dashboard.
