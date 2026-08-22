---
name: "scalability-expert"
description: "Use para projetar escalabilidade horizontal, cache, sharding de banco e pipelines assíncronos antes que o sistema degrade sob carga. Gatilhos de ativação: skill: scalability expert; identity; scaling dimensions; horizontal scaling checklist."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill: Scalability Expert

> Migrado deterministicamente de `skills/scalability-expert/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para projetar escalabilidade horizontal, cache, sharding de banco e pipelines assíncronos antes que o sistema degrade sob carga.
- **Ativar quando:** Use para projetar escalabilidade horizontal, cache, sharding de banco e pipelines assíncronos antes que o sistema degrade sob carga.
- **Escopo canônico:** Skill: Scalability Expert
- **Seções do corpo original:** Identity · Scaling Dimensions · Horizontal Scaling Checklist · Database Sharding · Changelog
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Scalability Expert ensures systems handle growth in users, data, and traffic without de...

Scalability Expert ensures systems handle growth in users, data, and traffic without degradation. Designs horizontal scaling, caching layers, database sharding, CDN strategy, and async processing pipelines.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Application is stateless (session in Redis, not local)
- [ ] Static assets served from CDN
- [ ] Database has read replicas
- [ ] Queues can scale independently
- [ ] No file storage on local disk (use S3/CDN)
- [ ] Health checks and auto-scaling configured
- [ ] Load balancer configured (round-robin or least connections)
- [ ] Cache invalidation works across nodes
- [ ] Graceful shutdown (drain connections before stopping)
- [ ] Metrics track requests per second per node

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

# Skill: Scalability Expert

## Identity

Scalability Expert ensures systems handle growth in users, data, and traffic without degradation. Designs horizontal scaling, caching layers, database sharding, CDN strategy, and async processing pipelines.

---

## Scaling Dimensions

```yaml
horizontal: add more servers (web, API, workers)
vertical: bigger servers (limited ceiling)

cache:
  - Browser: CDN for static assets
  - Application: Redis for hot data
  - Database: query cache, read replicas

database:
  - Read replicas for read-heavy workloads
  - Sharding for write-heavy workloads
  - Connection pooling (PgBouncer, ProxySQL)

async:
  - Queues for time-consuming tasks (email, export)
  - Event-driven for decoupling services
  - Stream processing for real-time data
```

---

## Horizontal Scaling Checklist

- [ ] Application is stateless (session in Redis, not local)
- [ ] Static assets served from CDN
- [ ] Database has read replicas
- [ ] Queues can scale independently
- [ ] No file storage on local disk (use S3/CDN)
- [ ] Health checks and auto-scaling configured
- [ ] Load balancer configured (round-robin or least connections)
- [ ] Cache invalidation works across nodes
- [ ] Graceful shutdown (drain connections before stopping)
- [ ] Metrics track requests per second per node

---

## Database Sharding

```yaml
strategy: "modular sharding by user_id"
shards: 4
key: "user_id % 4"

challenges:
  - Cross-shard queries (avoid or use fan-out)
  - Rebalancing when adding shards
  - Backup and restore per shard

alternative: "NoSQL (DynamoDB, CosmosDB) for automatic sharding"
```

---

## Changelog

### 1.0.0 — Initial release. Scaling dimensions, checklist, sharding.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
