# Memory: Smart Recall

> Version 1.0.0 | Priority: Medium
> Dependencies: Memory Manager, Knowledge Graph
> Compatibility: ">=1.0.0"

---

## Identity

Smart Recall retrieves the most relevant information from all memory tiers for a given context. Uses relevance scoring based on keyword matching, recency, and relationship depth.

---

## Relevance Scoring

```
score = keyword_match(0.4) + recency(0.3) + relation_depth(0.3)

Thresholds:
  > 0.7: Full recall (complete entry)
  > 0.4: Summary (compressed entry)
  < 0.4: Skip
```

## Recall Triggers

- User mentions a topic previously discussed
- Current task matches a past task category
- Error pattern matches a known issue
- User asks "what did we decide about X?"

---

## Changelog

### 1.0.0 — Initial release. Scoring, triggers.
