---
name: dry-kiss-yagni-validator
description: "Verifica código contra DRY, KISS e YAGNI: duplicação, over-engineering e abstrações/parâmetros não usados, com exemplos de antes/depois. Use ao revisar ou refatorar código para simplicidade."
---

# Skill: DRY / KISS / YAGNI Validator

## Identity

Ensures code follows three fundamental principles: Don't Repeat Yourself (DRY), Keep It Simple Stupid (KISS), and You Ain't Gonna Need It (YAGNI).

---

## DRY — Don't Repeat Yourself

### Checks

- [ ] No duplicated logic across methods/classes
- [ ] No copy-pasted code blocks
- [ ] Repeated patterns extracted into functions/classes
- [ ] Business rules defined once
- [ ] Configuration externalized (not hardcoded)

### Examples

```php
// ❌ Violation
$total = $price + $tax;
$finalTotal = $price + $tax + $shipping;
$discountedTotal = ($price + $tax) * 0.9;

// ✅ DRY
function calculateSubtotal(float $price, float $tax): float {
    return $price + $tax;
}
$total = calculateSubtotal($price, $tax);
$finalTotal = calculateSubtotal($price, $tax) + $shipping;
```

---

## KISS — Keep It Simple

### Checks

- [ ] Simplest solution that works
- [ ] No over-engineered abstractions
- [ ] No design patterns applied where not needed
- [ ] Code is readable at first glance
- [ ] No premature optimization

### Signs of Over-Engineering

```
- FactoryFactory pattern
- Strategy pattern for a single if-else
- Abstract base class with one concrete implementation
- Event system when a simple function call works
- Microservice for a CRUD module
```

---

## YAGNI — You Ain't Gonna Need It

### Checks

- [ ] No unused parameters, methods, or classes
- [ ] No commented-out "future" code
- [ ] No "we might need this later" abstractions
- [ ] No unused dependencies in composer.json
- [ ] No unused imports

### Examples

```php
// ❌ YAGNI violation — building for hypothetical future
class PaymentProcessor
{
    public function process(
        PaymentMethod $method,
        ?bool $useCrypto = null,  // might need later?
        ?string $fallbackCurrency = null,  // for future expansion?
    ) { ... }
}

// ✅ YAGNI — only what's needed now
class PaymentProcessor
{
    public function process(PaymentMethod $method): void { ... }
}
```

---

## Score

```yaml
dry_score: 4/5
kiss_score: 5/5
yagni_score: 3/5

violations:
  - principle: yagni
    location: "UserService.php:22"
    detail: "Unused method getHistory that calls an API that doesn't exist yet"
```

---

## Changelog

### 1.0.0 — Initial release. DRY, KISS, YAGNI checks with examples.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

> Gerado pelo Izanagi AI — cópia fiel de `skills/dry-kiss-yagni-validator/SKILL.md` (fonte da verdade).
