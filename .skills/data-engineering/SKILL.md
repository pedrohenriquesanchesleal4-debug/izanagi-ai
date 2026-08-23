---
name: "data-engineering"
description: "Guia de modelagem de dados, NoSQL, message queues, streaming e pipelines ETL com boas práticas de schema, idempotência e monitoramento. Use para projetar pipelines de dados ou sistemas de armazenamento. Gatilhos de ativação: skill data engineering — izanagi; bancos de dados; message queues & streaming; etl pipelines."
version: 2.0.0
category: data
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_read
references:
  - "references.md"
---

# Skill Data Engineering — Izanagi

> Migrado deterministicamente de `skills/data-engineering/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Dados (`data`)
- **Resumo:** Guia de modelagem de dados, NoSQL, message queues, streaming e pipelines ETL com boas práticas de schema, idempotência e monitoramento.
- **Ativar quando:** Use para projetar pipelines de dados ou sistemas de armazenamento.
- **Escopo canônico:** Skill Data Engineering — Izanagi
- **Seções do corpo original:** Bancos de Dados · Message Queues & Streaming · ETL Pipelines · Modelagem de Dados · Boas Práticas
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_read

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: MongoDB

- Document model: embedding (preferido) vs references
- Indexes: single field, compound, text, 2dsphere
- Aggregation pipeline: `$match` → `$group` → `$sort` → `$project`
- Read/Write concerns: `majority` para dados críticos

### Passo 2 — Aplicar: Elasticsearch

- Inverted index para full-text search
- Mapping explícito (nunca dynamic mapping em produção)
- Analyzers customizados (português: `brazilian` stemmer)
- Index lifecycle: hot → warm → cold → delete
- Query DSL: `bool` (must/should/filter)

---

### Passo 3 — Aplicar: Kafka (Event Streaming)

```
Producer → Topic (partitions) → Consumer Group → Consumer
```

- **Topics**: nome no formato `Izanagi.<domain>.<event>` (ex: `Izanagi.posts.published`)
- **Partitions**: 3-6 por topic (escala com consumo)
- **Retention**: 7 days (padrão), ajustável por caso de uso
- **Schema Registry**: Avro (preferido) ou JSON Schema

### Passo 4 — Aplicar: RabbitMQ (Message Queue)

- **Exchanges**: direct (routing key), topic (pattern), fanout (broadcast)
- **Queues**: named, durable, com DLQ (dead letter queue)
- **Consumer**: prefetch count = 1 para processamento sequencial

---

### Passo 5 — Aplicar: Padrão

```
Extract (API/DB/Files) → Transform (clean/validate/aggregate) → Load (Target)
```

### Passo 6 — Aplicar: Ferramentas

| Ferramenta | Quando usar |
|------------|-------------|
| dbt | Transform SQL no data warehouse |
| Airflow | Orchestration de pipelines complexos |
| Custom Node.js | Pipelines simples (extract → transform → load direto) |

---

### Passo 7 — Aplicar: NoSQL (MongoDB)

- **Embed**: quando entidade é "owned" e acessada junto (ex: endereço no perfil)
- **Reference**: quando entidade é independente (ex: posts e autores)

### Passo 8 — Aplicar: SQL (PostgreSQL)

- Normalização até 3NF (dados transacionais)
- Views materializadas para agregados frequentes
- Indexes: B-tree (padrão), GIN (array/jsonb), BRIN (time-series)

---

### Passo 9 — Aplicar: Boas Práticas

- **Schema evolution**: migrations sempre backward-compatible
- **Monitoring**: track lag (Kafka), queue depth (RabbitMQ), query performance (ES)
- **Backup**: MongoDB Atlas backups, ES snapshots, Kafka topic backup
- **Idempotency**: consumers devem ser idempotentes (mesmo evento processado 2x = mesmo resultado)
- **Dead letter**: toda queue/topic deve ter DLQ configurada

### Passo 10 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:data -->

- Rodar --dry-run sobre amostra real e comparar o que seria feito com o esperado, linha a linha nas bordas.
- Reconciliar contagens origem → destino (processados, ignorados, falhas com motivo).
- Provar reexecução segura: segunda passada não duplica nem altera resultado.
- Confirmar que nenhum Red Flag (WHERE ausente, PII em log, checkpoint ausente) persiste no pipeline entregue.

## Common Rationalizations

- **"Dados de produção são limpos, validação em lote é paranoia."**
  - Verdade: Produção contém vazio, duplicado, formato legado e outlier desde o primeiro dia. Validação de schema ANTES da carga é o mínimo; assumir limpeza é exportar o bug para o destino.
- **"Registro duplicado é raro, trato se aparecer."**
  - Verdade: Raro em volume alto é frequente em absoluto. Upsert por ID natural/idempotency key é design padrão, não otimização defensiva.
- **"Migro essa base na mão, é uma vez só."**
  - Verdade: 'Uma vez só' executada sob pressão, sem dry-run e sem rollback, é o cenário clássico de perda irreversível. Migração na mão é migração sem verificação.
- **"Índice a gente cria quando a query ficar lenta."**
  - Verdade: Sem índice, a lentidão chega em produção no pico de uso e o índice de emergência trava a tabela justamente no horário crítico. Modelagem inclui acesso previsto.
- **"ETL falhou no meio, rodo do zero que resolve."**
  - Verdade: Recomeçar do zero reprocessa efeito colateral e pode duplicar tudo. Checkpoint é obrigatório: falhou no 643 de 1000, retoma do 644.
- **"PII nesse dataset tá ok porque é ambiente interno."**
  - Verdade: Ambiente interno é o vetor clássico de vazamento (acesso amplo, sem auditoria). Minimização e tratamento de PII aplicam-se onde o dado está, não onde ele 'deveria' estar.

## Red Flags

- DELETE/UPDATE sem WHERE em script operacional (ou com WHERE 'óbvio' não conferido).
- Migração sem path de rollback testado.
- Pipeline batch sem checkpoint — falha no fim recomeça tudo.
- Contagem de registros origem vs destino nunca reconciliada.
- Retry automático em operação não-idempotente sem idempotency key.
- Schema do destino aceitando qualquer coisa (validação adiada indefinidamente).
- PII em log, export ou ambiente compartilhado sem tratamento.

## Legacy Reference (v1)

# Skill Data Engineering — Izanagi

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

- **Topics**: nome no formato `Izanagi.<domain>.<event>` (ex: `Izanagi.posts.published`)
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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
