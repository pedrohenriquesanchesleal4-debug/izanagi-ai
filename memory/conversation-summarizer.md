# Memory: Conversation Summarizer

> Version 1.0.0 | Priority: Medium
> Dependencies: Session Compression, Memory Manager
> Compatibility: ">=1.0.0"

---

## Identity

Conversation Summarizer condenses long conversations into dense summaries while preserving all decisions, action items, errors, and key facts.

---

## Extraction Priority

```yaml
preserve:
  - ALL: decisions, action items, errors + fixes, user preferences
  - MOST: architecture decisions, tech stack changes, key facts
  - SOME: patterns detected, skill updates, progress made

discard:
  - Greetings ("hey", "thanks", "you're welcome")
  - Filler questions ("can you help me?", "do you understand?")
  - Multiple rephrasings of the same question
  - Code snippets (stored in project memory)
  - Error messages (only keep cause + fix)
```

---

## Summary Format

```yaml
conversation_summary:
  duration: "1h 23m"
  messages: 47
  tokens_compressed: "12,340 → 180 (68:1)"
  
  decisions:
    - "Use JWT in httpOnly cookies (not localStorage)"
    - "PostgreSQL over MySQL (JSONB support)"
  
  errors:
    - "Str::contains() TypeError → null check added"
  
  action_items:
    - "Add rate limiting to login endpoint"
    - "Write Stripe integration tests"
  
  user:
    level: "intermediate"
    preferred_style: "code examples first"
  
  architecture:
    pattern: "Layered (Controller → Service → Repository)"
    stack: "Laravel 11, PostgreSQL 16, React + Tailwind"
```

---

## Changelog

### 1.0.0 — Initial release. Priority, format, 68:1 compression.
