# Memory: Long-Term Project Memory

> Version 1.0.0 | Priority: Medium
> Dependencies: Memory Manager
> Compatibility: ">=1.0.0"

---

## Identity

Long-Term Project Memory persists project-specific information across sessions: architecture decisions, tech stack, conventions, error history, and development patterns.

---

## Stored Data

```yaml
project:
  type: "web_app"
  name: "Blog API"
  stack:
    backend: "Laravel 11"
    frontend: "React + Tailwind"
    database: "PostgreSQL 16"
    cache: "Redis"

decisions:
  - id: ADR-001
    decision: "JWT in httpOnly cookies"
    reason: "XSS protection vs localStorage"
    date: "2026-07-15"

conventions:
  php: "PSR-12, strict_types, readonly properties"
  js: "TypeScript strict, functional components"
  testing: "Pest for PHP, Jest for JS"

errors:
  - pattern: "N+1 queries"
    count: 3
    fix: "Eager loading with with()"
    last_seen: "2026-07-10"
```

---

## Benefits

- No need to re-explain project context each session
- Architecture decisions persist across sessions
- Error patterns detected and prevented
- Conventions applied consistently

---

## Changelog

### 1.0.0 — Initial release. Stored data, benefits.
