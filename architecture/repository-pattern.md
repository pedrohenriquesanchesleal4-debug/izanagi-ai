# Architecture: Repository Pattern

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect, DDD Specialist
> Compatibility: ">=1.0.0"

---

## Identity

Repository Pattern mediates between domain and data mapping layers, acting like an in-memory collection of aggregate roots. It provides a clean separation between business logic and data access.

---

## Contract

```php
interface UserRepository
{
    public function findById(UserId $id): ?User;
    public function findByEmail(string $email): ?User;
    public function save(User $user): void;
    public function delete(UserId $id): void;
}
```

## Implementation

```php
class PostgresUserRepository implements UserRepository
{
    public function __construct(private Connection $db) {}

    public function findById(UserId $id): ?User
    {
        $row = $this->db->fetch('SELECT * FROM users WHERE id = ?', [$id->toString()]);
        return $row ? $this->hydrate($row) : null;
    }

    public function save(User $user): void
    {
        $this->db->upsert('users', [
            'id' => $user->getId()->toString(),
            'name' => $user->getName(),
            'email' => $user->getEmail(),
        ]);
    }

    private function hydrate(array $row): User
    {
        return new User(
            UserId::fromString($row['id']),
            $row['name'],
            $row['email'],
        );
    }
}
```

---

## Rules

- Repository per aggregate root (not per table).
- One `save()` method handles both insert and update.
- Repositories return domain objects, not arrays.
- Repositories hide the data source (SQL, API, file).

---

## Changelog

### 1.0.0 — Initial release. Contract, implementation, rules.
