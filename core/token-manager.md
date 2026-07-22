# Core: Token Manager

> Version 1.0.0
> Priority: Critical
> Dependencies: Context Engine, Compression Engine
> Compatibility: ">=1.0.0"

---

## Identity

The Token Manager monitors, budgets, and optimizes every token spent across the entire system. It enforces per-response limits, triggers compression when thresholds are breached, and logs token usage for cost analysis.

---

## Goals

- Never exceed the hard token limit per response.
- Trigger compression proactively at 70% usage.
- Provide real-time token accounting per skill.
- Log token usage for optimization and cost tracking.

---

## Budget Tiers

| Tier | Limit | When Applied |
|------|-------|-------------|
| Soft | 2048 tokens | Normal response |
| Hard | 4096 tokens | Complex response |
| Context | 8192 tokens | Full context window |
| Emergency | 512 tokens | Only for error recovery |

---

## Monitor

```
┌─────────────────────────────────────────────────┐
│                  TOKEN MONITOR                  │
│                                                 │
│  Current Usage: 1,234 / 2,048 (60%)            │
│  Budget Remaining: 814 tokens                  │
│  Status: ✅ Normal                              │
│                                                 │
│  ┌──────────────┬──────────┬──────────┐        │
│  │ Skill        │ Allocated│ Used     │        │
│  ├──────────────┼──────────┼──────────┤        │
│  │ Architect    │ 400      │ 380      │        │
│  │ Security     │ 300      │ 290      │        │
│  │ Backend      │ 800      │ 564      │        │
│  └──────────────┴──────────┴──────────┘        │
└─────────────────────────────────────────────────┘
```

---

## Triggers

| Condition | Action |
|-----------|--------|
| Usage > 70% of soft limit | Activate Compression Engine |
| Usage > 90% of soft limit | Force compression, reduce detail level |
| Usage > 100% of soft limit | Drop lowest priority section |
| Usage > 100% of hard limit | Emergency — truncate to essentials, notify Reflection |

---

## Allocation Algorithm

```
function allocate(skills, total_budget):
    sum_priority = sum(skills.priority for skills)
    
    for skill in skills:
        weight = skill.priority / sum_priority
        skill.budget = floor(total_budget * weight)
    
    return skills
```

Priority weights: critical = 0.4, high = 0.3, medium = 0.2, low = 0.1

---

## Accounting

Every response includes a token usage footer when debug mode is active:

```
---
Token Usage: 1,234
Budget: 2,048
Remaining: 814
Compression: none
Skills: Architect(380), Security(290), Backend(564)
---
```

---

## Savings Techniques

| Technique | Tokens Saved | Cost |
|-----------|-------------|------|
| Drop filler words | 5-10% | Zero |
| Use abbreviations | 3-5% | Low (clarity risk) |
| Summarize examples | 10-20% | Low |
| Remove code comments | 15-25% | Medium (context loss) |
| Use compact format | 20-30% | Low |
| Skip redundant validation | 5-10% | Medium |

---

## Rules

### Always

- ✅ Track every token in every response.
- ✅ Trigger compression proactively at 70%.
- ✅ Log token usage per skill.
- ✅ Respect hard limit unconditionally.

### Never

- ❌ Exceed hard limit.
- ❌ Skip compression when triggered.
- ❌ Compress security-critical information.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Soft limit compliance | 100% | Responses within soft limit |
| Hard limit breaches | 0 | Responses exceeding hard limit |
| Compression trigger rate | ≥ 90% | Triggers vs actual breaches |
| Average tokens per response | < 1500 | Running average |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 4-tier budget system
- Priority-based allocation algorithm
- Real-time monitoring with status tracking
- Compression triggers at 70% and 90%
- Emergency truncation at hard limit
