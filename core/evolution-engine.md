# Core: Evolution Engine

> Version 1.0.0
> Priority: High
> Dependencies: Reflection Engine, Memory Manager, Skill Registry
> Compatibility: ">=1.0.0"

---

## Identity

The Evolution Engine is the self-improvement mechanism of Nexus AI. It receives structured feedback from the Reflection Engine, detects recurring patterns, and automatically updates skill files, rules, and configurations to prevent repeated mistakes and improve over time.

---

## Goals

- Update skills automatically based on reflection data.
- Eliminate recurring mistakes within 3 occurrences.
- Track skill evolution history per version.
- Never introduce breaking changes without user approval.

---

## Workflow

```
Reflection Engine
    ↓
Evolution Trigger (pattern detected ≥ threshold)
    ↓
Load current skill file
    ↓
Generate diff (proposed change)
    ↓
Validate change (no breaking, no regression)
    ↓
Flag for user approval (if major) OR auto-apply (if minor)
    ↓
Update skill file
    ↓
Update changelog
    ↓
Log evolution event
```

---

## Change Types

| Type | Auto-apply | User Approval | Example |
|------|-----------|---------------|---------|
| **Patch** | ✅ Yes | ❌ No | Fix typo, update budget estimate |
| **Minor** | ❌ No | ✅ Yes | Add new rule, extend workflow |
| **Major** | ❌ No | ✅ Yes | Restructure skill, change dependencies |
| **Deprecation** | ❌ No | ✅ Yes | Remove obsolete skill or rule |

---

## Pattern → Action Mapping

```yaml
patterns:
  token_waste:
    threshold: 5 occurrences
    action: "Reduce token budget for skill by 10%"
    auto_apply: true
    
  misclassification:
    threshold: 3 occurrences
    action: "Update Decision Engine classification keywords"
    auto_apply: false
    
  security_gap:
    threshold: 1 occurrence
    action: "Immediate skill update — add security rule"
    auto_apply: false
    
  user_confusion:
    threshold: 3 occurrences
    action: "Add Professor Mode activation to skill chain"
    auto_apply: true
    
  missing_dependency:
    threshold: 2 occurrences
    action: "Add missing dependency to skill declaration"
    auto_apply: true
    
  budget_exceeded:
    threshold: 3 occurrences
    action: "Increase budget or compress skill output"
    auto_apply: true
```

---

## Evolution Log Format

```yaml
evolution:
  id: "evo-20260717-001"
  timestamp: "2026-07-17T12:00:00Z"
  
  source:
    reflection_ids: ["ref-001", "ref-005", "ref-012"]
    pattern: "token_waste"
    occurrences: 5
    
  change:
    type: "patch"
    target: "skills/backend-engineer.md"
    field: "token_budget"
    old_value: 800
    new_value: 720
    reason: "Recurring token waste in code examples"
    
  status: "auto_applied"
```

---

## Rules

### Always

- ✅ Log every evolution event with full traceability.
- ✅ Require user approval for minor and major changes.
- ✅ Validate changes before applying (no regressions).
- ✅ Update CHANGELOG.md for every evolution.
- ✅ Track which reflection triggered the change.

### Never

- ❌ Auto-apply changes that affect skill structure.
- ❌ Apply changes that break backward compatibility without user approval.
- ❌ Delete skill files without user confirmation.
- ❌ Ignore pattern thresholds (always act at threshold).

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Auto-apply accuracy | ≥ 95% | No user reverts of auto-applied changes |
| Recurring mistake elimination | ≤ 1 recurrence after fix | Track mistake IDs |
| Evolution events per week | ≥ 2 | Count logged events |
| User approval rate | ≥ 80% | Approved / requested changes |

---

## Quality Gates (Pre-Apply)

1. ✅ Change improves the system (not neutral or worse).
2. ✅ Change does not break existing dependencies.
3. ✅ Change is compatible with SYSTEM.md version.
4. ✅ Change is documented in CHANGELOG.md.

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- 6 pattern → action mappings
- 4 change types with auto-apply rules
- Full traceability from reflection to change
- Validation gate before any change
