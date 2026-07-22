# Architecture: Hexagonal Architecture (Ports & Adapters)

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

Hexagonal Architecture (Ports & Adapters) isolates the core application from external concerns through ports (interfaces) and adapters (implementations). The core has no dependency on frameworks, databases, or delivery mechanisms.

---

## Structure

```
       ┌─────────────┐
       │   Adapter   │  (Inbound: Controller, CLI, Queue Consumer)
       │  (Delivery) │
       └──────┬──────┘
              │ Port (inbound interface)
       ┌──────▼──────┐
       │   CORE      │  (Application + Domain)
       │  (no deps)  │
       └──────┬──────┘
              │ Port (outbound interface)
       ┌──────▼──────┐
       │   Adapter   │  (Outbound: PostgreSQL, Redis, Mail, HTTP)
       │ (Infra)     │
       └─────────────┘
```

---

## Ports & Adapters

```php
// Port (outbound interface)
interface OrderRepository
{
    public function save(Order $order): void;
    public function findById(OrderId $id): ?Order;
}

// Adapter (outbound implementation)
class PostgresOrderRepository implements OrderRepository
{
    public function __construct(private Connection $db) {}
    
    public function save(Order $order): void
    {
        $this->db->insert('orders', [
            'id' => $order->getId()->toString(),
            'total' => $order->getTotal()->toCents(),
            'status' => $order->getStatus()->value,
        ]);
    }
    
    public function findById(OrderId $id): ?Order
    {
        $row = $this->db->fetch('SELECT * FROM orders WHERE id = ?', [$id->toString()]);
        return $row ? $this->hydrate($row) : null;
    }
}
```

---

## Key Benefit

Swap infrastructure without touching core:

```php
// Test adapter (instead of PostgresOrderRepository)
class InMemoryOrderRepository implements OrderRepository
{
    private array $orders = [];

    public function save(Order $order): void
    {
        $this->orders[$order->getId()->toString()] = $order;
    }

    public function findById(OrderId $id): ?Order
    {
        return $this->orders[$id->toString()] ?? null;
    }
}
```

---

## Changelog

### 1.0.0 — Initial release. Ports & Adapters, example, testability.
