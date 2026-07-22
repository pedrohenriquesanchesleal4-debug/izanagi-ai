# Memory: Memory Manager

> Version 1.0.0
> Priority: Critical
> Dependencies: Context Engine, Compression Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Memory Manager is the persistent storage layer of Nexus AI. It maintains three tiers of memory — Session, Project, and Long Term — with automatic compression, relevance-based recall, and a knowledge graph for cross-session pattern detection.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                   MEMORY MANAGER                     │
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Session    │  │   Project    │  │  Long Term │ │
│  │   Memory     │  │   Memory     │  │   Memory   │ │
│  │  (volatile)  │  │ (persistent) │  │(persistent)│ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                │         │
│         └─────────────────┼────────────────┘         │
│                           │                          │
│                           ▼                          │
│              ┌────────────────────────┐              │
│              │    Knowledge Graph     │              │
│              │  (entities + edges)    │              │
│              └───────────┬────────────┘              │
│                          │                           │
│                          ▼                           │
│              ┌────────────────────────┐              │
│              │      Recall Engine     │              │
│              │  (query + relevance)   │              │
│              └────────────────────────┘              │
└──────────────────────────────────────────────────────┘
```

---

## Memory Tiers

### Session Memory

| Property | Value |
|----------|-------|
| Duration | Current conversation only |
| Persistence | None (lost on session end) |
| Max tokens | 1024 |
| Contains | Current task context, recent decisions, active errors |
| Compression | Auto at 80% capacity |

### Project Memory

| Property | Value |
|----------|-------|
| Duration | Across sessions for same project |
| Persistence | File-based (project-memory.json) |
| Max tokens | 4096 |
| Contains | Project type, tech stack, architecture decisions, conventions, recurring patterns |
| Compression | Auto at 70% capacity |

### Long Term Memory

| Property | Value |
|----------|-------|
| Duration | Across all projects and sessions |
| Persistence | File-based (long-term-memory.json) |
| Max tokens | 8192 |
| Contains | User preferences, communication style, recurring mistakes, skill evolution, learning progress |
| Compression | Auto at 60% capacity |

---

## Storage Format

### Session (volatile, in-context)

```json
{
  "session_id": "sess-abc123",
  "started_at": "2026-07-17T11:00:00Z",
  "tasks": [
    {
      "task_id": "task-001",
      "classification": "new_feature",
      "decisions": ["Use JWT over sessions", "Use PostgreSQL"],
      "errors": [],
      "patterns": []
    }
  ],
  "active_context": {
    "current_skill": "backend-engineer",
    "token_used": 1234,
    "compression_level": "none"
  }
}
```

### Project (persistent, file-based)

```json
{
  "project_id": "proj-xyz789",

  "type": "web_app",
  "tech_stack": {
    "backend": "Laravel 11",
    "frontend": "React + Tailwind",
    "database": "PostgreSQL 16",
    "cache": "Redis"
  },
  "architecture": {
    "pattern": "Layered (Controller → Service → Repository)",
    "decisions": [
      {
        "id": "adr-001",
        "decision": "Use JWT in httpOnly cookies",
        "reason": "XSS protection vs localStorage",
        "date": "2026-07-15"
      }
    ]
  },
  "conventions": {
    "naming": "camelCase for JS, snake_case for PHP",
    "testing": "Pest for unit, Cypress for E2E"
  },
  "error_history": [
    {
      "error": "SQL injection vector in UserController",
      "fix": "Use parameterized queries",
      "count": 2,
      "last_seen": "2026-07-16"
    }
  ],
  "last_updated": "2026-07-17T10:00:00Z"
}
```

### Long Term (persistent, file-based)

```json
{
  "user_id": "user-default",
  "preferences": {
    "communication_style": "concise",
    "teaching_level": "intermediate",
    "teaching_style": "examples_first"
  },
  "recurring_patterns": {
    "token_waste": {
      "count": 5,
      "last_skill": "backend-engineer",
      "resolved": false
    },
    "forget_security": {
      "count": 2,
      "last_skill": "software-architect",
      "resolved": true
    }
  },
  "skill_evolution": [
    {
      "skill": "backend-engineer",
      "version": "1.1.0",
      "changes": ["Reduced token budget by 10%"],
      "date": "2026-07-17"
    }
  ],
  "learning_progress": {
    "completed_lessons": ["SOLID", "Clean Architecture"],
    "current_lesson": "CQRS",
    "struggling_topics": ["Event Sourcing"]
  },
  "last_updated": "2026-07-17T12:00:00Z"
}
```

---

## Knowledge Graph

The Knowledge Graph stores entities and relationships extracted from project and long-term memory.

### Entity Types

- `decision` — architectural or technical decision
- `error` — bug or mistake with fix
- `pattern` — recurring structure or approach
- `technology` — tool, framework, library
- `concept` — design pattern, principle, methodology
- `user_preference` — user's explicit preferences

### Edge Types

- `led_to` — decision led to outcome
- `caused` — decision caused error
- `solved_by` — error solved by fix
- `related_to` — two entities are related
- `uses` — project uses technology
- `conflicts_with` — two decisions or technologies conflict

### Example

```
[Use JWT] ──led_to──> [XSS Protection]
    │                     │
    │                     ├──solved_by──> [httpOnly Cookies]
    │                     │
    └──caused──> [Frontend needs token refresh logic]
```

---

## Recall Engine

### Query Flow

```
1. Receive query from Context Engine
2. Tokenize query into keywords
3. Search all 3 tiers in order:
   a. Session memory (fastest)
   b. Project memory
   c. Long term memory
4. Score each result by relevance:
   score = keyword_match * 0.4 + recency * 0.3 + relation_depth * 0.3
5. If score > 0.5: return full entry
6. If score > 0.3: return compressed summary
7. If score < 0.3: skip
8. Limit results to budget
```

### Recall Budget

| Priority | Max Items | Max Tokens |
|----------|-----------|------------|
| Critical | 3 | 300 |
| High | 2 | 200 |
| Medium | 1 | 100 |
| Low | 0 | 0 |

---

## Compression Triggers

| Tier | Trigger | Strategy |
|------|---------|----------|
| Session | > 80% capacity | Remove oldest 30% of task history |
| Project | > 70% capacity | Summarize old decisions, keep active ones |
| Long Term | > 60% capacity | Archive patterns with count < 3 |

---

## Rules

### Always

- ✅ Save decisions immediately after they are made.
- ✅ Compress before storage if tier is near capacity.
- ✅ Log every read and write for traceability.
- ✅ Respect recall budgets strictly.

### Never

- ❌ Store raw conversation history in project or long term memory.
- ❌ Store secrets, passwords, or API keys.
- ❌ Exceed storage budget for any tier.
- ❌ Return irrelevant memory (score < 0.3).

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Recall precision | ≥ 80% | Relevant results / total results |
| Recall recall | ≥ 90% | Relevant results returned / relevant results available |
| Storage usage | ≤ 80% per tier | Current size / max size |
| Write latency | < 50ms | Time to store entry |
| Read latency | < 30ms | Time to retrieve entry |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 3-tier memory architecture
- JSON-based persistent storage
- Knowledge Graph with 6 entity types and 6 edge types
- Relevance-based recall engine with scoring algorithm
- Auto-compression at tier capacity thresholds
