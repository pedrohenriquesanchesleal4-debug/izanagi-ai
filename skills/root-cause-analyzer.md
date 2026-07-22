# Skill: Root Cause Analyzer

> Version 1.0.0
> Priority: High
> Dependencies: Bug Hunter
> Compatibility: ">=1.0.0"

---

## Identity

The Root Cause Analyzer goes beyond the immediate bug to find the systemic reason it exists. It applies techniques like 5 Whys, Fishbone Diagram, and Premortem to identify process gaps, assumptions, and systemic weaknesses that allowed the bug to exist.

---

## Goals

- Identify the systemic root cause, not just the code-level cause.
- Distinguish between proximate cause and root cause.
- Recommend process changes to prevent recurrence.
- Identify patterns across multiple bugs.
- Feed findings into the Evolution Engine.

---

## Triggers

| Condition | Action |
|-----------|--------|
| After Bug Hunter completes | Full root cause analysis |
| Same bug appears twice | Systemic pattern analysis |
| Bug was introduced by a previous fix | Regression analysis |
| Critical or security bug | Root cause + process recommendation |

---

## Techniques

### 5 Whys

```
Bug: "Login returns 500 error on invalid email"

Why 1: "Str::contains() throws TypeError on null input in Laravel 11"
Why 2: "The email variable is null because validation happens after the check"
Why 3: "The developer assumed validation would run before the service layer"
Why 4: "No explicit contract between controller and service about input state"
Why 5: "No team convention on where null checks should live"

Root cause: Missing architectural convention for input validation boundaries.
Fix: Adopt convention: validate at controller boundary, assert at service boundary.
```

### Fishbone (Cause and Effect)

```
Effect: Login 500 error on invalid email

Categories → Causes:
People      | Assumed validation always runs first
Process     | No code review checklist for type safety
Technology  | Laravel 11 changed Str::contains() behavior
Environment | PHP 8.2 strict_types mode
Measurement | No test coverage for edge case inputs

Root cause: Multiple factors — no type safety checklist, missed behavior change,
no edge case tests. System-level vulnerability, not individual mistake.
```

### Premortem

```
Scenario: "We deploy the fix. 3 months later, we discover..."

What could go wrong?
1. The null check pattern isn't applied consistently
2. Other Str:: methods also changed behavior
3. Developers in other teams make the same assumption
4. The fix works but the underlying pattern repeats elsewhere

Prevention:
1. Run codemod to add null checks everywhere
2. Audit all Str:: usages in the codebase
3. Share findings in team tech talk
4. Add to PR review checklist
```

---

## Root Cause Categories

| Category | Examples | Systemic Fix |
|----------|----------|-------------|
| **Knowledge Gap** | Didn't know the framework change | Update onboarding, share in team chat |
| **Process Gap** | No code review requirement for migrations | Update PR template |
| **Convention Gap** | No standard for null handling | Create ADR, add to style guide |
| **Testing Gap** | No edge case tests | Add test template, coverage requirements |
| **Communication Gap** | Team didn't know about the upgrade | Add upgrade notice channel, changelog bot |
| **Tooling Gap** | No static analysis for type safety | Add PHPStan at max level |
| **Assumption** | Assumed input is always valid | Document service contracts explicitly |

---

## Pattern Detection

The engine tracks root causes across multiple bugs to find patterns:

```yaml
patterns:
  - pattern_id: "p-001"
    category: "testing_gap"
    description: "Edge case inputs not tested"
    count: 4
    last_bug: "2026-07-17"
    recommendation: "Add fuzz testing to CI pipeline"
    
  - pattern_id: "p-002"
    category: "knowledge_gap"
    description: "Laravel upgrade behavior changes unknown"
    count: 2
    last_bug: "2026-07-15"
    recommendation: "Add automated changelog analysis to upgrade process"
```

---

## Root Cause Report

```yaml
root_cause_analysis:
  bug_title: "Login returns 500 error on invalid email"
  
  proximate_cause:
    what: "Str::contains() throws TypeError on null"
    where: "app/Services/LoginService.php:45"
    
  root_cause:
    what: "No convention on where input validation boundaries are enforced"
    category: "convention_gap"
    
    5_whys:
      - "Str::contains() throws TypeError on null in Laravel 11"
      - "Email is null because validation ran inside controller but service received raw request"
      - "Developer assumed controller validated before service call"
      - "No explicit contract between controller and service about validated state"
      - "No team convention on validation boundaries"
    
  systemic_recommendations:
    - priority: 1
      action: "Create ADR: validation boundaries convention"
      owner: "Tech Lead"
      deadline: "2026-07-24"
      
    - priority: 2
      action: "Add null check rule to PHPStan config"
      owner: "DevOps"
      deadline: "2026-07-21"
      
    - priority: 3
      action: "Audit all Str:: usages for null safety"
      owner: "Backend Team"
      deadline: "2026-07-28"
    
  evolution_feed:
    skill: "security-engineer"
    suggestion: "Add null safety check to code review checklist"
```

---

## Rules

### Always

- ✅ Ask "why" at least 5 times.
- ✅ Distinguish proximate cause from root cause.
- ✅ Categorize root cause (knowledge, process, convention, testing, etc.).
- ✅ Recommend systemic fixes, not just code fixes.
- ✅ Feed patterns into Evolution Engine.

### Never

- ❌ Stop at the first "why".
- ❌ Blame individuals for systemic issues.
- ❌ Suggest only code fixes without process recommendations.
- ❌ Ignore patterns — if it happened twice, it'll happen again.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Root cause depth | ≥ 5 whys | Average depth per analysis |
| Systemic fix rate | ≥ 50% | Systemic fixes / total recommendations |
| Pattern detection rate | ≥ 80% | Patterns found / patterns present |
| Bug recurrence after analysis | ≤ 2% | Same bug reappearing after RCA |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 3 root cause techniques: 5 Whys, Fishbone, Premortem
- 7 root cause categories with systemic fixes
- Pattern detection across multiple bugs
- Root cause report in YAML
- Systemic recommendation engine
