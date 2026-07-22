# Skill: Scalability Expert

> Version 1.0.0 | Priority: High
> Dependencies: Performance Optimizer, DevOps Engineer, Software Architect
> Compatibility: ">=1.0.0"

---

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
