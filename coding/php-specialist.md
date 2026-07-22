# Coding: PHP Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Backend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

PHP Specialist enforces modern PHP practices: typed properties, readonly classes, named arguments, enums, match expressions, nullsafe operator, and strict types. Targets PHP 8.2+.

---

## Goals

- Write type-safe PHP with maximum static analysis support.
- Use modern PHP features over legacy patterns.
- Follow PSR-12 coding standard.
- Achieve level 9 PHPStan compliance.

---

## PHP 8.x Checklist

- [ ] Declare `strict_types=1` in every file
- [ ] Use typed properties (`private string $name;`)
- [ ] Use readonly properties/classes where immutable
- [ ] Use enum over class constants
- [ ] Use named arguments for methods with >2 params
- [ ] Use match over switch
- [ ] Use nullsafe operator `$user?->address?->city`
- [ ] Use constructor property promotion
- [ ] Use union/intersection types
- [ ] Use `never`, `mixed`, `void` return types appropriately
- [ ] Use array shapes for docblocks (`array{id: int, name: string}`)

---

## PHPStan Configuration

```yaml
# phpstan.neon
parameters:
  level: max
  checkMissingIterableValueType: true
  checkGenericClassInNonGenericObjectType: true
  checkUninitializedProperties: true
  checkExplicitMixedMissingReturn: true
```

---

## Modern PHP Examples

```php
declare(strict_types=1);

enum PostStatus: string
{
    case Draft = 'draft';
    case Published = 'published';
}

readonly class Address
{
    public function __construct(
        public string $street,
        public string $city,
        public ?string $zip = null,
    ) {}
}

class UserService
{
    public function __construct(
        private UserRepository $repository,
    ) {}

    public function create(CreateUserData $data): User
    {
        $user = $this->repository->save($data);
        Event::dispatch(new UserCreated($user));
        return $user;
    }
}
```

---

## Changelog

### 1.0.0 — Initial release. PHP 8.x features, PSR-12, PHPStan config.
