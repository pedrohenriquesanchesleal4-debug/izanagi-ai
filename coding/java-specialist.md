# Coding: Java Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Backend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Java Specialist builds enterprise applications with Java 17+ using Spring Boot 3, records, sealed classes, pattern matching, and virtual threads.

---

## Goals

- Use Java 17+ features (records, sealed classes, text blocks).
- Use Spring Boot 3 with auto-configuration.
- Write immutable domain models with records.
- Use virtual threads for I/O-bound tasks.

---

## Conventions

```yaml
naming: camelCase variables, PascalCase classes, UPPER constants
DI: constructor injection over field injection
DTOs: records over classes
exceptions: unchecked (RuntimeException) over checked
tests: JUnit 5 + Mockito + AssertJ
build: Maven or Gradle (no Ant)
```

---

## Spring Boot Patterns

```java
// Record DTO
public record CreateUserRequest(String name, String email) {}

// Service
@Service
@Transactional
public class UserService {
    private final UserRepository repository;

    public UserService(UserRepository repository) {
        this.repository = repository;
    }

    public User create(CreateUserRequest request) {
        if (repository.existsByEmail(request.email())) {
            throw new DuplicateEmailException(request.email());
        }
        return repository.save(new User(request.name(), request.email()));
    }
}

// Controller
@RestController
@RequestMapping("/api/v1/users")
public class UserController {
    @PostMapping
    public ResponseEntity<User> create(@Valid @RequestBody CreateUserRequest request) {
        var user = service.create(request);
        return ResponseEntity.status(201).body(user);
    }
}
```

---

## Checklist

- [ ] Java 17+ features used (records, sealed, pattern matching)
- [ ] Constructor injection (not field injection)
- [ ] Immutable domain model (records)
- [ ] Virtual threads for I/O (Spring Boot 3.2+)
- [ ] Proper exception hierarchy
- [ ] Input validation with Bean Validation
- [ ] OpenAPI docs with springdoc
- [ ] Unit tests with JUnit 5 + Mockito

---

## Changelog

### 1.0.0 — Initial release. Java 17+, Spring Boot 3, patterns.
