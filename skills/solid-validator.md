# Skill: SOLID Validator

> Version 1.0.0
> Priority: High
> Dependencies: Clean Code Validator, Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

The SOLID Validator checks every class and module against the five SOLID principles. It identifies violations, explains why they are problematic, and suggests specific refactoring techniques to resolve them.

---

## Goals

- Validate every class against all 5 SOLID principles.
- Identify violations with specific evidence.
- Explain why the violation is harmful.
- Suggest specific refactoring to resolve it.
- Track SOLID adherence over time.

---

## Triggers

| Condition | Action |
|-----------|--------|
| After any new class | SOLID validation |
| After code review | Deep SOLID pass |
| `task == "solid"` or `task == "validate"` | Full SOLID audit |
| Before refactoring | Baseline SOLID score |

---

## SRP — Single Responsibility Principle

> A class should have only one reason to change.

### Checks

- [ ] Class name describes a single responsibility
- [ ] Class has ≤ 3 public methods (if service/controller)
- [ ] All methods operate on the same level of abstraction
- [ ] No method mixes business logic with infrastructure concerns

### Violation Example

```php
// ❌ Violates SRP — Controller handles HTTP, business logic, and email
class UserController {
    public function store(Request $request) {
        $validated = $request->validate([...]);
        $user = User::create($validated);              // Business logic
        Mail::to($user)->send(new WelcomeEmail($user)); // Email logic
        Log::info('User created: ' . $user->id);        // Logging logic
        return response()->json($user, 201);            // HTTP logic
    }
}

// ✅ SRP Compliant
class UserController {
    public function __construct(
        private UserService $userService
    ) {}

    public function store(StoreUserRequest $request): JsonResponse {
        $user = $this->userService->create($request->validated());
        return response()->json($user, 201);
    }
}

// UserService handles business logic + coordination
class UserService {
    public function create(array $data): User {
        $user = User::create($data);
        Event::dispatch(new UserRegistered($user));
        return $user;
    }
}
```

---

## OCP — Open/Closed Principle

> Software entities should be open for extension but closed for modification.

### Checks

- [ ] New behavior is added via extension, not modification
- [ ] Switch/if-else chains use polymorphism instead
- [ ] Abstract classes or interfaces define extension points
- [ ] Strategy pattern used for varying behavior

### Violation Example

```php
// ❌ Violates OCP — adding new notification type requires modifying this class
class NotificationService {
    public function send(string $type, string $message): void {
        if ($type === 'email') { ... }
        elseif ($type === 'sms') { ... }
        elseif ($type === 'slack') { ... }
    }
}

// ✅ OCP Compliant
interface NotificationChannel {
    public function send(string $message): void;
}

class EmailChannel implements NotificationChannel { ... }
class SmsChannel implements NotificationChannel { ... }
class SlackChannel implements NotificationChannel { ... }

class NotificationService {
    public function __construct(
        /** @var NotificationChannel[] */
        private array $channels
    ) {}

    public function send(string $message): void {
        foreach ($this->channels as $channel) {
            $channel->send($message);
        }
    }
}
```

---

## LSP — Liskov Substitution Principle

> Subtypes must be substitutable for their base types.

### Checks

- [ ] Subclass does not weaken preconditions
- [ ] Subclass does not strengthen postconditions
- [ ] Subclass does not throw new exception types
- [ ] Subclass preserves invariants of parent
- [ ] No "is-a" violations (Square extends Rectangle)

### Violation Example

```php
// ❌ Violates LSP — Square changes behavior of setWidth/setHeight
class Rectangle {
    public function setWidth(int $w): void { $this->width = $w; }
    public function setHeight(int $h): void { $this->height = $h; }
    public function getArea(): int { return $this->width * $this->height; }
}

class Square extends Rectangle {
    public function setWidth(int $w): void {
        $this->width = $w;
        $this->height = $w;  // Violates LSP — changing height too
    }
}

// ✅ LSP Compliant — use a Shape interface instead
interface Shape {
    public function getArea(): int;
}
class Rectangle implements Shape { ... }
class Square implements Shape { ... }
```

---

## ISP — Interface Segregation Principle

> Clients should not be forced to depend on interfaces they do not use.

### Checks

- [ ] Interfaces are small and focused
- [ ] No "fat" interfaces with unrelated methods
- [ ] Classes don't implement methods they don't need
- [ ] Multiple specific interfaces over one general interface

### Violation Example

```php
// ❌ Violates ISP — UserService must implement sendEmail
interface UserOperations {
    public function create(array $data): User;
    public function update(int $id, array $data): User;
    public function sendEmail(int $userId, string $template): void;
    public function exportCsv(): string;
}

// ✅ ISP Compliant
interface UserRepository {
    public function create(array $data): User;
    public function update(int $id, array $data): User;
}

interface EmailService {
    public function send(int $userId, string $template): void;
}

interface ExportService {
    public function exportCsv(): string;
}
```

---

## DIP — Dependency Inversion Principle

> Depend on abstractions, not concretions.

### Checks

- [ ] High-level modules don't depend on low-level modules
- [ ] Both depend on abstractions (interfaces/abstract classes)
- [ ] No `new` keyword in constructors (inject dependencies)
- [ ] No static method calls to concrete classes
- [ ] Dependency injection used throughout

### Violation Example

```php
// ❌ Violates DIP — depends on concrete MySQLRepository
class UserService {
    private MySQLRepository $repo;

    public function __construct() {
        $this->repo = new MySQLRepository();  // Tight coupling
    }
}

// ✅ DIP Compliant
class UserService {
    public function __construct(
        private UserRepositoryInterface $repo  // Depends on abstraction
    ) {}
}

// Binding in service provider
$this->app->bind(UserRepositoryInterface::class, MySQLRepository::class);
```

---

## SOLID Score

```yaml
solid_report:
  class: "app/Services/OrderService.php"
  overall_score: 3.8 / 5.0
  
  principles:
    srp:
      score: 3 / 5
      violations: ["Mixes validation, pricing, and notification"]
      passed_checks: 2 / 4
      
    ocp:
      score: 5 / 5
      violations: []
      passed_checks: 4 / 4
      
    lsp:
      score: 5 / 5
      violations: []
      passed_checks: 4 / 4
      
    isp:
      score: 3 / 5
      violations: ["UserService implements EmailNotifiableInterface"]
      passed_checks: 3 / 4
      
    dip:
      score: 3 / 5
      violations: ["New MySQLRepository() in constructor"]
      passed_checks: 3 / 5
  
  recommendations:
    - principle: srp
      action: "Extract OrderValidator, OrderPricing, OrderNotification classes"
      effort: "medium"
    - principle: dip
      action: "Inject UserRepositoryInterface instead of instantiating MySQLRepository"
      effort: "low"
```

---

## Rules

### Always

- ✅ Check all 5 principles on every class.
- ✅ Explain why each violation is harmful.
- ✅ Suggest specific refactoring for each violation.
- ✅ Score each principle individually.
- ✅ Prioritize SRP and DIP (most commonly violated).

### Never

- ❌ Claim SOLID compliance without checking all 5.
- ❌ Suggest refactoring that introduces new violations.
- ❌ Ignore violations because "it works fine now".
- ❌ Apply SOLID dogmatically when it adds accidental complexity.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Average SOLID score | ≥ 4.0 / 5 | Score per class, average |
| SRP compliance | ≥ 80% | Classes with single responsibility |
| DIP compliance | ≥ 90% | Classes using DI / total classes |
| Violations per class | ≤ 1 | Average violations per class |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- All 5 SOLID principles with checklists
- Before/after examples for each principle
- SOLID score report in YAML
- Violation explanations with "why harmful"
- Refactoring recommendations per violation
