# Memory: Context Recovery

> Version 1.0.0 | Priority: Medium
> Dependencies: Conversation Summarizer, Memory Manager
> Compatibility: ">=1.0.0"

---

## Identity

Context Recovery restores the full context of a previous session from a compressed summary. Loads relevant project memory, architecture decisions, and user context.

---

## Recovery Flow

```
1. User returns after session break
2. Load compressed summary from last session
3. Load project memory (architecture, stack, decisions)
4. Load user preferences (level, communication style)
5. Generate recovery prompt
6. Present to user for confirmation
```

---

## Recovery Prompt

```
"Welcome back! Last session we worked on the blog API.

Progress:
- Completed: User auth (JWT), Post CRUD
- Pending: Comments feature, rate limiting

Open items:
- Add rate limiting to login endpoint
- Write Stripe integration tests

Shall we continue with the comments feature, or do you want to
start something new?"
```

---

## Changelog

### 1.0.0 — Initial release. Recovery flow, prompt template.
