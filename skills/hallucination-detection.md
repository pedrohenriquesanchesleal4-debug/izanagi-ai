# Skill: Hallucination Detection

> Version 1.0.0 | Priority: High (Future)
> Dependencies: Reflection Engine
> Compatibility: ">=1.0.0"

---

## Identity

Hallucination Detection estimates confidence in statements the agent makes. Flags low-confidence statements and qualifies them. Detects contradictions and unverifiable claims.

---

## Confidence Levels

```yaml
high (90%+): 
  - "Laravel is a PHP framework" (established fact)
  - Code from project context (verifiable)

medium (70-90%): 
  - "This pattern is commonly used for..." (general knowledge)
  - Recommendations based on best practices

low (50-70%): 
  - "This might be the best approach for your case" (opinion)
  - Estimating effort without full context

flag (< 50%): 
  - "I'm not certain, but..." (clearly uncertain)
  - Should ask user for clarification
```

## Detection Patterns

```
- Vague or unspecific statements ("someone said", "I think")
- Conflicting statements within same response
- Claims without evidence or reasoning
- Made-up libraries, methods, or versions
- Incorrect API usage
```

---

## Changelog

### 1.0.0 — Initial release. Confidence levels, detection patterns.
