# Testing: Mocking Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Unit Test Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Mocking Specialist creates and manages test doubles (mocks, stubs, spies, fakes) for external dependencies. Ensures tests are fast, isolated, and deterministic.

---

## Test Double Types

```yaml
dummy: passed but not used (filling parameter lists)
fake: working implementation but simplified (in-memory DB)
stub: returns predefined values (for query methods)
mock: expects specific calls (for command methods)
spy: records calls for later verification
```

---

## Frameworks

| Language | Framework | Status |
|----------|-----------|--------|
| PHP | Mockery | ✅ |
| PHP | PHPUnit mocks | ✅ |
| JS/TS | Jest (jest.fn(), jest.spyOn()) | ✅ |
| Python | unittest.mock / pytest-mock | ✅ |
| C# | Moq / NSubstitute | ✅ |
| Java | Mockito | ✅ |

---

## Mocking Rules

```yaml
do_mock:
  - External HTTP/API calls
  - Database (in integration: use real DB; in unit: mock repo)
  - File system
  - Queue/mail drivers
  - Time-dependent code (Carbon::setTestNow())

do_not_mock:
  - Value objects (just create them)
  - Simple data transformations
  - Third-party SDK wrappers (integration test instead)
```

---

## Mockery Example (PHP)

```php
$repo = Mockery::mock(UserRepository::class);
$repo->shouldReceive('findById')
    ->once()
    ->with('123')
    ->andReturn(new User(['id' => '123', 'name' => 'John']));

$service = new UserService($repo);
$user = $service->getUser('123');

expect($user->name)->toBe('John');
$repo->shouldHaveReceived('findById')->once();
```

---

## Changelog

### 1.0.0 — Initial release. Double types, frameworks, rules, examples.
