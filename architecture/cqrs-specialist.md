# Architecture: CQRS Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect, Event-Driven Architect
> Compatibility: ">=1.0.0"

---

## Identity

CQRS Specialist separates read and write models. Commands change state, queries read state. Read models can be optimized for queries (denormalized, different DB), write models enforce domain invariants.

---

## When to Use CQRS

```yaml
use:
  - Complex domain with different read/write shapes
  - High read volume (reads scale independently)
  - Event sourcing (events write, projections read)
  - Reporting needs (read models optimized for queries)

avoid:
  - Simple CRUD (overhead without benefit)
  - Single database (no need for separate models yet)
  - Small team (complexity tax)
```

---

## Structure

```
Commands:
  POST /orders/place
  Body: { cartId, customerId }
  → Command: PlaceOrderCommand
  → Handler: PlaceOrderHandler
  → Event: OrderPlaced

Queries:
  GET /orders/active
  → Query: GetActiveOrdersQuery
  → Handler: GetActiveOrdersHandler
  → Returns: ReadModel (denormalized)
```

---

## Implementation

```php
// Command
class PlaceOrderCommand
{
    public function __construct(
        public readonly string $cartId,
        public readonly string $customerId,
    ) {}
}

// Command Handler (write model)
class PlaceOrderHandler
{
    public function __construct(
        private OrderRepository $repository,
        private EventDispatcher $dispatcher,
    ) {}

    public function handle(PlaceOrderCommand $command): void
    {
        $order = Order::place(
            CartId::fromString($command->cartId),
            CustomerId::fromString($command->customerId),
        );
        $this->repository->save($order);
        $this->dispatcher->dispatch(new OrderPlaced($order->getId()));
    }
}

// Query Handler (read model — optimized for queries)
class GetActiveOrdersHandler
{
    public function __construct(
        private OrderReadModel $readModel,  // Separate from write repo
    ) {}

    public function handle(GetActiveOrdersQuery $query): array
    {
        return $this->readModel->getActiveOrders(
            $query->customerId,
        );
    }
}
```

---

## Changelog

### 1.0.0 — Initial release. When to use, structure, implementation.
