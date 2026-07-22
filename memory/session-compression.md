# Memory: Session Compression

> Version 1.0.0
> Priority: Medium
> Dependencies: Memory Manager, Compression Engine
> Compatibility: ">=1.0.0"

---

## Identity

Session Compression reduces the entire conversation history into a dense, high-signal summary that preserves decisions, errors, action items, and key facts while removing all conversational overhead. It is activated at session end or when the context budget is critically low.

---

## Goals

- Compress an entire session (up to 10k tokens) into ≤ 200 tokens.
- Preserve 100% of decisions, errors, and action items.
- Preserve user preferences and level.
- Enable seamless session recovery on reconnect.

---

## Compression Ratio Targets

| Session Length | Compressed Size | Ratio |
|---------------|----------------|-------|
| 2,000 tokens | 100 tokens | 20:1 |
| 5,000 tokens | 150 tokens | 33:1 |
| 10,000 tokens | 200 tokens | 50:1 |

---

## Extraction Categories

Only the following categories are preserved. Everything else is discarded.

| Category | Priority | Preserve Format | Max Tokens |
|----------|----------|----------------|-----------|
| **Decisions** | Critical | Decision + reason | 50 |
| **Errors & Fixes** | Critical | Error + cause + fix | 50 |
| **Action Items** | High | Action + owner + status | 30 |
| **User Preferences** | High | Exact preference | 20 |
| **User Level** | High | Level + changes detected | 10 |
| **Architecture** | Medium | Pattern + key components | 20 |
| **Skill Updates** | Medium | Skill + change | 10 |
| **Patterns** | Low | Pattern description | 10 |

---

## Compression Algorithm

```
function compress_session(session):
    summary = {
        session_id: session.id,
        duration: session.duration,
        token_count: session.token_count,
        compressed_tokens: 0,
    }
    
    // Extract decisions
    decisions = extract_all(session.messages, pattern="decided|chose|selected")
    summary.decisions = deduplicate(decisions)
    
    // Extract errors
    errors = extract_all(session.messages, pattern="error|bug|fix|issue")
    summary.errors = deduplicate(errors)
    
    // Extract action items
    actions = extract_all(session.messages, pattern="next|todo|follow.up|need to")
    summary.action_items = deduplicate(actions)
    
    // Extract user data
    summary.user_preferences = session.user_preferences
    summary.user_level = session.user_level
    
    // Extract skill changes
    summary.skill_updates = session.evolution_log
    
    // Compress to fit budget
    while size(summary) > 200:
        summary.patterns = []  // Drop lowest priority
        if size(summary) > 200:
            summary.architecture = truncate(summary.architecture)
        if size(summary) > 200:
            summary.skill_updates = truncate(summary.skill_updates)
    
    return summary
```

---

## Compressed Session Format

```yaml
session_summary:
  session_id: "sess-abc123"
  duration: "45 min"
  tokens_saved: 4560
  
  decisions:
    - "Use JWT in httpOnly cookies (XSS protection)"
    - "Use PostgreSQL over MySQL (JSONB support needed)"
    - "Monolith for MVP, microservices later"
    
  errors_and_fixes:
    - "Str::contains() TypeError → null check added"
    - "N+1 on posts/index → eager loading added"
    
  action_items:
    - "Add rate limiting to auth endpoints"
    - "Write integration tests for payment flow"
    
  user:
    level: "intermediate"
    preferences:
      style: "concise"
      teaching: "examples_first"
    
  architecture:
    pattern: "Layered (Controller → Service → Repository)"
    stack: "Laravel 11, PostgreSQL 16, React + Tailwind"
```

---

## Session Recovery

When a user returns after a session break, the compressed summary is loaded into context:

```
"Welcome back. Last time we worked on the blog API. Here's where we left off:
- Architecture: Layered with Laravel 11 + React
- Completed: Auth system, Post CRUD
- Pending: Comments feature, rate limiting
- Open items: Add rate limiting to auth endpoints
- Your level: Intermediate (progressing well with Eloquent)
Would you like to continue where we left off or start something new?"
```

---

## Rules

### Always

- ✅ Compress at session end or when budget is critically low.
- ✅ Preserve all decisions, errors, and action items.
- ✅ Enable seamless session recovery.
- ✅ Track compression ratio and tokens saved.

### Never

- ❌ Preserve conversational filler or greetings.
- ❌ Preserve multiple expressions of the same decision.
- ❌ Preserve code examples (they are in project memory).
- ❌ Exceed 200 tokens for compressed session.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Compression ratio | ≥ 20:1 | Original / compressed |
| Decision preservation | 100% | Decisions in summary / decisions in session |
| Recovery quality | User can resume without re-explaining | Follow-up question rate after recovery |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 7 extraction categories with priority levels
- 200-token maximum summary size
- Compression algorithm with priority-based truncation
- Session recovery prompt format
- Decision, error, action item extraction patterns
