# Architecture: Event-Driven Architect

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect, Microservices Expert
> Compatibility: ">=1.0.0"

---

## Identity

Event-Driven Architect designs systems where services communicate through events. Defines event schemas, idempotency, at-least-once delivery, dead letter queues, and event sourcing when appropriate.

---

## Core Concepts

```yaml
event: a fact that happened in the past (past tense)
  - "user.registered", "order.placed", "payment.received"

message_broker:
  - RabbitMQ: reliable, routing flexibility
  - Kafka: high throughput, event sourcing, replay
  - Redis Pub/Sub: lightweight, no persistence

patterns:
  event_notification: fire and forget
  event_carried_state: include enough data for consumers
  saga: distributed transaction via events + compensating actions
  event_sourcing: store events as source of truth
  CQRS: separate read model updated by events
```

---

## Event Schema

```json
{
  "id": "evt_abc123",
  "type": "user.registered",
  "version": 1,
  "timestamp": "2026-07-17T12:00:00Z",
  "producer": "user-service",
  "data": {
    "user_id": "usr_456",
    "email": "user@test.com"
  },
  "metadata": {
    "correlation_id": "req_789",
    "cause": "user.registration.submitted"
  }
}
```

---

## Idempotency

Every event consumer must handle duplicate events:

```php
// Consumer
public function handle(UserRegistered $event): void
{
    if ($this->alreadyProcessed($event->id)) {
        return; // Idempotent — already handled
    }

    $this->sendWelcomeEmail($event->email);
    $this->markProcessed($event->id);
}
```

---

## Changelog

### 1.0.0 — Initial release. Events, brokers, patterns, idempotency.
