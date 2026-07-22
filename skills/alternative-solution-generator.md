# Skill: Alternative Solution Generator

> Version 1.0.0 | Priority: Medium
> Dependencies: Trade-off Analyzer
> Compatibility: ">=1.0.0"

---

## Identity

Alternative Solution Generator produces multiple approaches for any problem. Never proposes a single solution — always offers options with trade-offs.

---

## Format

```
## Problem: [description]

### Option 1: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Option 2: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Option 3: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Recommendation
[which option and why — with data if possible]
```

---

## Example

```
## Problem: Store user session data

### Option 1: File-based sessions
**Pros:** Simple, no extra infrastructure
**Cons:** Doesn't scale across servers, slow on high I/O
**Effort:** 0 (Laravel default)

### Option 2: Redis sessions
**Pros:** Fast, scales horizontally, TTL built-in
**Cons:** Requires Redis server, additional cost
**Effort:** 1 hour

### Option 3: Database sessions
**Pros:** No extra infrastructure, persistent
**Cons:** Slower than Redis, adds DB load
**Effort:** 30 minutes

### Recommendation
Redis — the performance and scalability benefits far outweigh the minimal setup cost.
```

---

## Changelog

### 1.0.0 — Initial release. Format, example, always 3+ options.
