# Architecture: Clean Architecture

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect, DDD Specialist
> Compatibility: ">=1.0.0"

---

## Identity

Clean Architecture enforces dependency inversion: domain at the center, application use cases around it, infrastructure and delivery at the outer rings. Nothing in the inner ring depends on anything in the outer rings.

---

## Layer Structure

```
┌──────────────────────────────────────────┐
│  Delivery (Controllers, API, CLI)       │  → depends on Application
│  ┌────────────────────────────────────┐  │
│  │  Infrastructure (DB, Queue, Mail)  │  │  → depends on Application
│  │  ┌──────────────────────────────┐  │  │
│  │  │  Application (Use Cases)     │  │  │  → depends on Domain only
│  │  │  ┌────────────────────────┐  │  │  │
│  │  │  │  Domain (Entities,     │  │  │  │
│  │  │  │  ValueObjects,        │  │  │  │  → zero dependencies
│  │  │  │  Domain Services)     │  │  │  │
│  │  │  └────────────────────────┘  │  │  │
│  │  └──────────────────────────────┘  │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

---

## Directory Structure

```
src/
├── Domain/
│   ├── Entities/
│   ├── ValueObjects/
│   ├── Events/
│   ├── Repositories/   (interfaces)
│   └── Services/       (domain services)
│
├── Application/
│   ├── UseCases/
│   ├── DTOs/
│   ├── Ports/          (input/output interfaces)
│   └── Exceptions/
│
├── Infrastructure/
│   ├── Persistence/    (repository implementations)
│   ├── Queue/
│   ├── Mail/
│   └── Cache/
│
└── Delivery/
    ├── Controllers/
    ├── Requests/
    └── Responses/
```

---

## Dependency Rule

```php
// Domain — zero dependencies
class Order { ... }

// Application — depends on Domain only
class PlaceOrderUseCase
{
    public function __construct(
        private OrderRepository $repository,  // Interface from Domain
        private EventDispatcher $dispatcher,  // Interface from Application Ports
    ) {}
}

// Infrastructure — implements Domain interfaces
class PostgresOrderRepository implements OrderRepository { ... }

// Delivery — uses Application
class OrderController
{
    public function __construct(
        private PlaceOrderUseCase $useCase
    ) {}
}
```

---

## Changelog

### 1.0.0 — Initial release. Layers, directory structure, dependency rule.
