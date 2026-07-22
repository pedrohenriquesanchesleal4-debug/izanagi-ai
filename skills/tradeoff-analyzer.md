# Skill: Trade-off Analyzer

> Version 1.0.0 | Priority: Medium
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

Trade-off Analyzer evaluates multiple approaches against defined criteria. Produces a structured comparison to help make informed decisions.

---

## Comparison Criteria

```yaml
criteria:
  complexity:
    description: "How complex is the implementation?"
    weight: 3
    
  maintainability:
    description: "How easy to maintain over time?"
    weight: 4
    
  performance:
    description: "How fast is it?"
    weight: 3
    
  scalability:
    description: "How well does it scale?"
    weight: 2
    
  cost:
    description: "Development + operational cost"
    weight: 2
    
  risk:
    description: "Probability of issues"
    weight: 4
```

---

## Example Comparison

```yaml
decision: "Should we use REST or GraphQL for the API?"

options:
  - name: "REST"
    scores:
      complexity: 5 (simple, well-known pattern)
      maintainability: 4 (clear endpoints)
      performance: 4 (caching, pagination)
      scalability: 3 (multiple requests)
      cost: 5 (no new tools)
      risk: 5 (proven, well-understood)
    weighted_total: 4.4
  
  - name: "GraphQL"
    scores:
      complexity: 2 (new patterns, resolvers, N+1 risk)
      maintainability: 3 (flexible but complex)
      performance: 3 (batching, dataloader needed)
      scalability: 4 (single endpoint, precise queries)
      cost: 3 (new tools: Apollo/graphql-php)
      risk: 3 (N+1, no HTTP caching)
    weighted_total: 3.1

recommendation: "Use REST for the public API. Consider GraphQL for internal admin dashboard."
```

---

## Changelog

### 1.0.0 — Initial release. Criteria, scoring, example.
