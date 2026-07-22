# Architecture: DDD Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

DDD Specialist applies Domain-Driven Design: ubiquitous language, bounded contexts, aggregates, entities, value objects, domain events, and repositories. Ensures the codebase speaks the language of the business.

---

## DDD Building Blocks

```yaml
entity: has identity (id), mutable, tracked through lifecycle
  - User, Order, Product

value_object: immutable, defined by attributes, no identity
  - Address, Money, Email

aggregate: cluster of entities/VOs treated as a unit
  - Order (with OrderItems), consistency boundary

repository: collection-like interface for aggregates
  - OrderRepository, UserRepository

domain_event: something that happened (past tense)
  - OrderPlaced, PaymentReceived

domain_service: stateless operation that doesn't fit an entity
  - DiscountCalculator, ShippingCostService
```

---

## Ubiquitous Language

```yaml
business_term: "Order"
code: App\Domain\Order\Order.php

business_term: "Place Order"
code: App\Domain\Order\Commands\PlaceOrder.php

business_term: "Order Placed"
code: App\Domain\Order\Events\OrderPlaced.php

business_term: "Order Total"
code: App\Domain\Order\ValueObjects\OrderTotal.php
```

---

## Aggregate Example

```php
class Order extends AggregateRoot
{
    private function __construct(
        private readonly OrderId $id,
        private readonly Cart $cart,
        private OrderStatus $status,
        private \DateTimeImmutable $placedAt,
    ) {}

    public static function place(Cart $cart, CustomerId $customerId): self
    {
        if ($cart->isEmpty()) {
            throw new CannotPlaceEmptyOrder($cart->getId());
        }

        $order = new self(
            OrderId::generate(),
            $cart,
            OrderStatus::Pending,
            new \DateTimeImmutable()
        );

        $order->recordEvent(new OrderPlaced(
            orderId: $order->id,
            customerId: $customerId,
            total: $cart->total(),
        ));

        return $order;
    }
}
```

---

## Changelog

### 1.0.0 — Initial release. Building blocks, language, aggregate example.
