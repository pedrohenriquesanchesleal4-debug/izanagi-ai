# Coding: TypeScript Specialist

> Version 1.0.0 | Priority: High
> Dependencies: JavaScript Specialist
> Compatibility: ">=1.0.0"

---

## Identity

TypeScript Specialist enforces strict TypeScript practices: strict mode, explicit types, discriminated unions, generics, branded types, and exhaustive type checking.

---

## Goals

- Enable `strict: true` in tsconfig always.
- Prefer types over interfaces (unless merging needed).
- Use discriminated unions for state management.
- Use generics for reusable utilities.
- Achieve full type safety (no `any`, no `@ts-ignore`).

---

## tsconfig.json

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "target": "ES2022"
  }
}
```

---

## Patterns

```typescript
// Discriminated union
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

// Branded types
type UserId = string & { readonly __brand: 'UserId' };

// Exhaustive switch
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}

// Generic repository
interface Repository<T extends { id: string }> {
  findById(id: string): Promise<T | null>;
  save(entity: T): Promise<T>;
}
```

---

## Checklist

- [ ] `strict: true` in tsconfig
- [ ] No `any` (use `unknown` + narrow)
- [ ] No `@ts-ignore` or `@ts-nocheck`
- [ ] Explicit return types on functions
- [ ] Discriminated unions for states
- [ ] Generics typed correctly (no `any` constraints)
- [ ] Exhaustive switch/if-else for unions
- [ ] `null` and `undefined` handled explicitly

---

## Changelog

### 1.0.0 — Initial release. Strict TS, discriminated unions, branded types.
