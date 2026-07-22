# Core: Context Engine

> Version 1.0.0
> Priority: Critical
> Dependencies: Memory Manager, Token Manager
> Compatibility: ">=1.0.0"

---

## Identity

The Context Engine builds the minimal, high-signal context window for every task. It loads only what is relevant, compresses what is verbose, and discards what is noise. It is the gatekeeper of the token budget.

---

## Goals

- Load only relevant context (no waste).
- Compress verbose history without losing signal.
- Respect strict token limits per task.
- Provide the agent with everything needed, nothing extra.

---

## Context Window Structure

```
┌────────────────────────────────────────────┐
│              CONTEXT WINDOW                │
│                                            │
│  1. SYSTEM CONTEXT (200 tokens max)       │
│     - Identity                            │
│     - Current task                        │
│     - Active skill chain                  │
│                                            │
│  2. PROJECT CONTEXT (400 tokens max)      │
│     - Project type                        │
│     - Tech stack                          │
│     - Architecture (from Software Arch.)  │
│     - Conventions                         │
│                                            │
│  3. MEMORY CONTEXT (300 tokens max)       │
│     - Relevant decisions                  │
│     - Relevant errors                     │
│     - Relevant patterns                   │
│                                            │
│  4. TASK CONTEXT (remaining budget)       │
│     - User input                          │
│     - File contents (if referenced)       │
│     - Previous output (if continuation)   │
│                                            │
└────────────────────────────────────────────┘
```

---

## Workflow

```
1. Receive task and classification
    ↓
2. Load SYSTEM_CONTEXT
    - Identity: who the agent is
    - Task: what the user asked
    - Chain: which skills will execute
    ↓
3. Load PROJECT_CONTEXT
    - Query Project Memory for relevant data
    - Load tech stack, architecture, conventions
    ↓
4. Load MEMORY_CONTEXT
    - Query Long Term Memory for relevant patterns
    - Query Knowledge Graph for related decisions
    ↓
5. Load TASK_CONTEXT
    - User input (cleaned)
    - Relevant files (truncated if > budget)
    ↓
6. COMPRESS if total > budget
    - Apply priority-based compression
    - Remove redundancy
    - Summarize verbose sections
    ↓
7. DELIVER to Skill Executor
```

---

## Load Prioritization

When the context window is full, items are dropped in this order (last = kept):

1. User input history (oldest first)
2. Previous outputs (except last one)
3. Memory context (lowest relevance score)
4. Project context (general vs specific)
5. Task context (current task)
6. System context (never dropped)

---

## Compression Algorithm

```
function compress(context, budget):
    while size(context) > budget:
        section = find_lowest_priority_section()
        
        if section.type == "memory":
            section = summarize(section)
            // "We decided to use JWT instead of sessions"
            // → "Decision: JWT > sessions"
        
        elif section.type == "history":
            section = drop_oldest_50_percent()
        
        elif section.type == "file_content":
            section = truncate_to_signature_lines()
            // Keep: class declaration, method signatures
            // Drop: implementation details
        
        elif section.type == "project":
            section = keep_only_active_tokens()
            // Keep: current stack, relevant patterns
            // Drop: inactive modules, old decisions
        
        else:
            section = remove_verbose_markdown()
    
    return context
```

---

## Relevance Scoring

Each memory item is scored before loading:

```
relevance = (keyword_match_count * 0.4) 
          + (recency_factor * 0.3) 
          + (task_type_match * 0.2) 
          + (frequency_factor * 0.1)

if relevance < 0.3:
    skip loading (low signal)
elif relevance < 0.6:
    load as compressed summary
else:
    load in full
```

---

## Rules

### Always

- ✅ Load minimal context for the task.
- ✅ Compress before delivering if budget exceeded.
- ✅ Prioritize current task over history.
- ✅ Keep system identity in every context window.

### Never

- ❌ Load full conversation history.
- ❌ Load files not referenced by the task.
- ❌ Exceed the token budget.
- ❌ Drop system identity.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Context size vs budget | ≤ 100% | Compare window size to budget |
| Relevance of loaded memory | ≥ 0.6 | Average relevance score of loaded items |
| Compression ratio | ≥ 2:1 | Original size / compressed size |
| Dropped items rate | ≤ 20% | Items dropped vs total attempted |

---

## Token Budget

| Operation | Tokens |
|-----------|--------|
| Load system context | 50 |
| Load project context | 100 |
| Query memory | 80 |
| Score relevance | 40 |
| Compress (if needed) | 150 |
| **Total per build** | **~420** |

---

## Memory Hooks

```yaml
on_build:
  - load: system_identity
  - load: project_tech_stack
  - query: relevant_decisions

on_compress:
  - save: compression_log
  - notify: Token Manager

on_deliver:
  - save: context_window_snapshot
```

---

## Reflection

### Pre-delivery

- [ ] Is the context window minimal?
- [ ] Is any loaded item irrelevant?
- [ ] Can I compress further without losing signal?

### Post-delivery

- [ ] Did the agent need context that was not loaded?
- [ ] Was any loaded context unused?
- [ ] Should relevance scoring be adjusted?

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 4-section context window structure
- Priority-based compression algorithm
- Relevance scoring for memory loading
- Budget enforcement before delivery
