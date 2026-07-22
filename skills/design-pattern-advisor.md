# Skill: Design Pattern Advisor

> Version 1.0.0 | Priority: Medium
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

Design Pattern Advisor recommends the right design pattern for a given problem. Explains trade-offs, provides implementation sketches, and warns against over-engineering.

---

## Pattern Decision Tree

```
if you need to create objects:
  → Factory Method (simple)
  → Abstract Factory (families of objects)
  → Builder (complex objects with many configs)

if you need to structure objects:
  → Adapter (incompatible interfaces)
  → Decorator (add behavior without subclassing)
  → Facade (simplify complex subsystem)
  → Composite (tree structure)

if you need to manage behavior:
  → Strategy (swappable algorithms)
  → Observer (event notification)
  → Command (parameterize operations)
  → Chain of Responsibility (request pipeline)
  → State (state-dependent behavior)

if you're dealing with data:
  → Repository (data access abstraction)
  → Unit of Work (transactional consistency)
  → Active Record (simple CRUD, Laravel Eloquent)
  → Data Mapper (complex domain, Doctrine)
```

---

## Pattern Suggestions

```
Problem: "Need different shipping cost calculations"
Pattern: Strategy
// Strategy interface + implementation per carrier (FedEx, UPS, Correios)

Problem: "Need to log, cache, and time every API call"
Pattern: Decorator (with middleware)
// Middleware pipeline: LogMiddleware → CacheMiddleware → TimingMiddleware

Problem: "Complex object construction with many optional parts"
Pattern: Builder
// new QueryBuilder()->select(...)->from(...)->where(...)->get()
```

---

## Anti-Patterns to Avoid

```
- Singleton overuse (hidden global state)
- God class (one class does everything)
- Spaghetti code (no structure)
- Golden hammer (using your favorite pattern for everything)
- Copy-paste programming (DRY violation)
- Premature abstraction (YAGNI violation)
```

---

## Changelog

### 1.0.0 — Initial release. Decision tree, suggestions, anti-patterns.
