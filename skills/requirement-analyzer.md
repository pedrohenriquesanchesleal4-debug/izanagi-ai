# Skill: Requirement Analyzer

> Version 1.0.0 | Priority: High
> Dependencies: Software Architect
> Compatibility: ">=1.0.0"

---

## Identity

Requirement Analyzer extracts, clarifies, and structures requirements from natural language input. Identifies functional and non-functional requirements, constraints, assumptions, and open questions.

---

## Extraction Process

```
1. Parse input → extract explicit requirements
2. Ask clarifying questions for ambiguities
3. Categorize: functional vs non-functional
4. Prioritize: must-have vs nice-to-have
5. Identify constraints (time, budget, tech)
6. Document open questions
7. Output structured requirements document
```

---

## Requirement Format

```yaml
requirements:
  functional:
    - id: F1
      title: "User registration"
      description: "Users can register with email and password"
      priority: "must-have"
      acceptance: "POST /api/v1/users returns 201 with valid data"
    
    - id: F2
      title: "Email verification"
      description: "Users must verify email before accessing dashboard"
      priority: "must-have"
      acceptance: "Unverified users get 403 on dashboard"
  
  non_functional:
    - id: NF1
      title: "Response time"
      description: "API p95 response under 200ms"
      priority: "must-have"
    
  constraints:
    - "Laravel 11 + PostgreSQL 16"
    - "Delivery in 4 weeks"
  
  open_questions:
    - "Should we support social login (Google, GitHub)?"
    - "Password policy: minimum length?"
```

---

## Changelog

### 1.0.0 — Initial release. Extraction, categorization, format.
