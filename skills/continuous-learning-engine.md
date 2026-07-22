# Skill: Continuous Learning Engine

> Version 1.0.0 | Priority: High (Future)
> Dependencies: Evolution Engine, Reflection Engine, Memory Manager
> Compatibility: ">=1.0.0"

---

## Identity

Continuous Learning Engine drives long-term improvement across all skills. Identifies knowledge gaps, seeks new information, integrates learnings, and measures growth.

---

## Learning Sources

```yaml
sources:
  interactions:
    - User corrections (what they corrected me on)
    - User preferences (their preferred approach)
    - New topics user introduces
    
  reflections:
    - Mistakes made (logged in reflection)
    - Patterns detected across tasks
    
  external:
    - Documentation updates (Laravel releases, PHP versions)
    - Security advisories (new CVEs)
    - Community best practices
```

## Knowledge Gap Detection

```yaml
gaps:
  - topic: "Laravel 11 new features"
    reason: "User asked about Laravel 11 and I gave incomplete info"
    action: "Refresh knowledge on Laravel 11 upgrade guide"
    
  - topic: "React Server Components"
    reason: "Couldn't explain RCS data fetching patterns clearly"
    action: "Study RCS patterns, add to Frontend Engineer skill"
```

---

## Changelog

### 1.0.0 — Initial release. Sources, gap detection.
