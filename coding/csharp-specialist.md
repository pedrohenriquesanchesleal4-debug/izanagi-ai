# Coding: C# Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Backend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

C# Specialist builds applications with .NET 8, using minimal APIs, primary constructors, record types, source generators, and async/await throughout.

---

## Goals

- Use .NET 8+ features (primary constructors, records, collection expressions).
- Use Minimal APIs for simple endpoints, Controllers for complex.
- Always async/await for I/O.
- Use dependency injection throughout.
- Write immutable types with records.

---

## Conventions

```yaml
naming: camelCase locals/params, PascalCase methods/types, _camelCase fields
DI: constructor injection via primary constructors
DTOs: record types (positional or nominal)
exceptions: custom exceptions for domain errors
testing: xUnit + FluentAssertions
async: Task<T> for all I/O operations
null: nullable reference types enabled
```

---

## .NET 8 Patterns

```csharp
// Record DTO
public record CreateUserRequest(string Name, string Email);

// Service with primary constructor
public class UserService(IRepository<User> repository) : IUserService
{
    public async Task<User> CreateAsync(CreateUserRequest request)
    {
        var exists = await repository.AnyAsync(u => u.Email == request.Email);
        if (exists) throw new DuplicateEmailException(request.Email);

        var user = new User { Name = request.Name, Email = request.Email };
        return await repository.CreateAsync(user);
    }
}

// Minimal API
app.MapPost("/api/v1/users", async (
    CreateUserRequest request,
    IUserService service) =>
{
    var user = await service.CreateAsync(request);
    return Results.Created($"/api/v1/users/{user.Id}", user);
})
.WithName("CreateUser")
.WithOpenApi();
```

---

## Checklist

- [ ] .NET 8+ features used (primary constructors, records)
- [ ] Nullable reference types enabled
- [ ] Async/await for all I/O
- [ ] Minimal API or Controller (chosen per complexity)
- [ ] FluentValidation for input validation
- [ ] Serilog/NLog for logging
- [ ] OpenAPI with NSwag or Swashbuckle
- [ ] Unit tests with xUnit + FluentAssertions

---

## Changelog

### 1.0.0 — Initial release. .NET 8, C# 12, Minimal APIs.
