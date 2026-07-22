# Architecture: Unit of Work

> Version 1.0.0 | Priority: Medium
> Dependencies: Repository Pattern
> Compatibility: ">=1.0.0"

---

## Identity

Unit of Work maintains a list of objects affected by a business transaction and coordinates writing changes as a single atomic unit. Ensures all changes succeed or fail together.

---

## Implementation

```php
class UnitOfWork
{
    private array $new = [];
    private array $dirty = [];
    private array $deleted = [];

    public function registerNew(object $entity): void
    {
        $this->new[] = $entity;
    }

    public function registerDirty(object $entity): void
    {
        if (!in_array($entity, $this->dirty, true)) {
            $this->dirty[] = $entity;
        }
    }

    public function registerDeleted(object $entity): void
    {
        $this->deleted[] = $entity;
    }

    public function commit(): void
    {
        $this->beginTransaction();
        try {
            foreach ($this->new as $entity) { $this->insert($entity); }
            foreach ($this->dirty as $entity) { $this->update($entity); }
            foreach ($this->deleted as $entity) { $this->delete($entity); }
            $this->commitTransaction();
            $this->clear();
        } catch (\Exception $e) {
            $this->rollbackTransaction();
            throw $e;
        }
    }

    public function clear(): void
    {
        $this->new = [];
        $this->dirty = [];
        $this->deleted = [];
    }
}
```

---

## Usage with Repository

```php
class OrderService
{
    public function __construct(
        private UnitOfWork $uow,
        private OrderRepository $repo,
        private EventDispatcher $events,
    ) {}

    public function placeOrder(Cart $cart): void
    {
        $order = Order::place($cart);
        $this->repo->add($order);  // registers in UoW
        // More changes...
        $this->uow->commit();      // all or nothing
    }
}
```

---

## Changelog

### 1.0.0 — Initial release. Implementation, usage pattern.
