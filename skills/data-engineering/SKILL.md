---
name: data-engineering
description: |
  Skill de Data Engineering para o Portal. Abrange modelagem de dados, bancos NoSQL,
  message queues, streaming, ETL, search (Elasticsearch) e boas práticas de dados.
  Use esta skill para projetar ou implementar pipelines de dados e sistemas de armazenamento.
---

# Skill Data Engineering — Portal

## Bancos de Dados

### MongoDB
- Document model: embedding (preferido) vs references
- Indexes: single field, compound, text, 2dsphere
- Aggregation pipeline: `$match` → `$group` → `$sort` → `$project`
- Read/Write concerns: `majority` para dados críticos

### Elasticsearch
- Inverted index para full-text search
- Mapping explícito (nunca dynamic mapping em produção)
- Analyzers customizados (português: `brazilian` stemmer)
- Index lifecycle: hot → warm → cold → delete
- Query DSL: `bool` (must/should/filter)

---

## Message Queues & Streaming

### Kafka (Event Streaming)
```
Producer → Topic (partitions) → Consumer Group → Consumer
```

- **Topics**: nome no formato `portal.<domain>.<event>` (ex: `portal.posts.published`)
- **Partitions**: 3-6 por topic (escala com consumo)
- **Retention**: 7 days (padrão), ajustável por caso de uso
- **Schema Registry**: Avro (preferido) ou JSON Schema

### RabbitMQ (Message Queue)
- **Exchanges**: direct (routing key), topic (pattern), fanout (broadcast)
- **Queues**: named, durable, com DLQ (dead letter queue)
- **Consumer**: prefetch count = 1 para processamento sequencial

---

## ETL Pipelines

### Padrão
```
Extract (API/DB/Files) → Transform (clean/validate/aggregate) → Load (Target)
```

### Ferramentas
| Ferramenta | Quando usar |
|------------|-------------|
| dbt | Transform SQL no data warehouse |
| Airflow | Orchestration de pipelines complexos |
| Custom Node.js | Pipelines simples (extract → transform → load direto) |

---

## Modelagem de Dados

### NoSQL (MongoDB)
- **Embed**: quando entidade é "owned" e acessada junto (ex: endereço no perfil)
- **Reference**: quando entidade é independente (ex: posts e autores)

### SQL (PostgreSQL)
- Normalização até 3NF (dados transacionais)
- Views materializadas para agregados frequentes
- Indexes: B-tree (padrão), GIN (array/jsonb), BRIN (time-series)

---

## Boas Práticas

- **Schema evolution**: migrations sempre backward-compatible
- **Monitoring**: track lag (Kafka), queue depth (RabbitMQ), query performance (ES)
- **Backup**: MongoDB Atlas backups, ES snapshots, Kafka topic backup
- **Idempotency**: consumers devem ser idempotentes (mesmo evento processado 2x = mesmo resultado)
- **Dead letter**: toda queue/topic deve ter DLQ configurada
