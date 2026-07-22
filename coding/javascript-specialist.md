# Coding: JavaScript Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Backend Engineer
> Compatibility: ">=1.0.0"

---

## Identity

JavaScript Specialist writes modern, type-safe JavaScript (ES2022+) with a focus on functional patterns, async/await, module systems, and testability.

---

## Goals

- Use ES2022+ features consistently.
- Prefer functional over imperative patterns.
- Use async/await over callbacks and raw promises.
- Write modular, tree-shakeable code.
- Use JSDoc for type hints when TypeScript is not available.

---

## Conventions

```yaml
modules: ES modules (import/export) — no CommonJS in new code
naming: camelCase for variables/functions, PascalCase for classes
async: async/await over .then()
constants: UPPER_SNAKE_CASE for module-level constants
equality: === over == (always)
nullish: ?? over || for nullish coalescing
optional: ?. over && for optional chaining
```

---

## Checklist

- [ ] No var — use const/let
- [ ] No implicit globals
- [ ] Async functions have error handling (try/catch)
- [ ] No mutable function parameters
- [ ] Pure functions preferred over state mutation
- [ ] Array methods over for loops (map, filter, reduce)
- [ ] Destructuring for objects and arrays
- [ ] Spread over Object.assign
- [ ] Template literals over string concatenation
- [ ] Optional chaining over long && chains

---

## Example

```javascript
import { createUser } from './user-service.js';

async function handleCreateUser(req, res) {
  try {
    const { name, email, role = 'user' } = req.body;
    const user = await createUser({ name, email, role });
    res.status(201).json({ success: true, data: user });
  } catch (error) {
    res.status(422).json({ success: false, message: error.message });
  }
}
```

---

## Changelog

### 1.0.0 — Initial release. ES2022+, conventions, checklist.
