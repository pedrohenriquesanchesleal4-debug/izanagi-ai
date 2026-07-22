---
name: architecture-patterns
description: |
  Skill de Architecture Patterns para o Portal. Aborda padroes arquiteturais como
  microservices, event-driven, CQRS, hexagonal architecture, clean architecture, e
  decision records (ADRs). Use esta skill ao projetar ou refatorar a arquitetura do sistema.
---

# Skill Architecture Patterns — Portal

## Microservices

### Principios
- **Domain boundaries**: cada servico = um bounded context
- **Database per service**: cada servico tem seu proprio banco
- **Communication**: eventos assincronos (Kafka) > chamadas sincronas (HTTP)
- **Deployment**: independente (cada servico deploya separado)
- **Team ownership**: um time por servico (Conway's Law)

### API Gateway Pattern
```
Client → API Gateway → Service A
                     → Service B
                     → Service C
```
- Gateway cuida de: auth, rate limiting, routing, aggregation
- Servicos nao conhecem o cliente diretamente

---

## Event-Driven Architecture

### Event Types
| Tipo | Descricao | Exemplo |
|------|-----------|---------|
| Event Notification | "Algo aconteceu" sem dados | `post.published` |
| Event-Carried State Transfer | Evento com dados completos | `post.updated { title, body, ... }` |
| Command | Intencao de fazer algo | `send.email { to, template }` |

### Event Sourcing
- Estado = sequencia de eventos
- Vantagem: auditoria completa, replay, temporal queries
- Desvantagem: complexidade, eventual consistency

---

## CQRS (Command Query Responsibility Segregation)

```
Command Side (Write): Command → Handler → Aggregate → Event Store
Query Side (Read):    Query → Handler → Read Model (denormalized)
```

### Quando usar
- Diferentes modelos de leitura e escrita
- Performance differente entre reads e writes
- Equipes separadas para read e write

### Quando NAO usar
- CRUD simples sem complexidade
- Time pequeno que nao justifica a sobrecarga

---

## Hexagonal Architecture (Ports & Adapters)

```
         ┌──────────┐
  HTTP ─→│ Adapter  │
  CLI ──→│ (In)     │──→ Port (In) ─→ Core Logic ─→ Port (Out) ─→│ Adapter  │─→ DB
  Queue →│          │                (domain)                    │ (Out)    │─→ API
         └──────────┘                                            └──────────┘
```

- **Core**: regras de negocio PURAS (sem dependencias externas)
- **Ports**: interfaces que o core define
- **Adapters**: implementacoes das interfaces (HTTP, DB, Queue, etc.)

---

## Clean Architecture (Robert C. Martin)

```
Layers (inside → outside):
1. Entities: regras de negocio da empresa
2. Use Cases: regras de negocio da aplicacao
3. Interface Adapters: controllers, presenters, gateways
4. Frameworks & Drivers: DB, Web, UI, devices
```

### Dependency Rule
- Dependencias apontam **para dentro** (nunca para fora)
- Camadas internas nao sabem nada sobre camadas externas

---

## ADRs (Architecture Decision Records)

### Formato (yaml)
```yaml
---
title: "Usar Supabase como banco principal"
status: accepted  # proposed | accepted | deprecated | superseded
date: 2026-07-17
context: |
  Precisavamos de um banco com auth, storage e real-time...
decision: |
  Escolhemos Supabase por reduzir servicos externos...
consequences: |
  - Positivo: auth + banco + storage em um servico
  - Negativo: vendor lock-in com Supabase
---
```
