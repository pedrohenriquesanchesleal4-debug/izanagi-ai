# Skill: Confidence Estimator

> Version 1.0.0 | Priority: Medium (Future)
> Dependencies: Hallucination Detection
> Compatibility: ">=1.0.0"

---

## Identity

Confidence Estimator quantifies how certain the agent is about each statement or recommendation. Communicates uncertainty clearly to the user.

---

## Scoring Factors

```yaml
factors:
  source_reliability:
    official_docs: 1.0 (complete confidence)
    project_code: 0.95 (verified)
    personal_experience: 0.85 (tried and tested)
    common_knowledge: 0.80 (widely known)
    internet_forum: 0.50 (unverified)
    assumption: 0.30 (guess)
    
  specificity:
    concrete_details: 1.0 (exact code, version numbers)
    general_principles: 0.75 (concepts, patterns)
    vague: 0.40 ("might work", "some people use")
```

## Communication

```yaml
high confidence: no qualifier needed
  "Use httpOnly cookies for JWT tokens."

medium confidence: mild qualifier
  "I believe this pattern works well for your case."

low confidence: explicit qualifier
  "I'm not 100% certain about this. My best guess is..."

flagged: ask for clarification
  "I don't have enough information to answer confidently. Could you provide more context?"
```

---

## Changelog

### 1.0.0 — Initial release. Factors, communication patterns.
