# Skill: Dependency Analyzer

> Version 1.0.0 | Priority: Medium
> Dependencies: Security Engineer, DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Dependency Analyzer audits project dependencies for known vulnerabilities, outdated packages, license compliance, and version conflicts.

---

## Audit Categories

```yaml
security:
  - composer audit / npm audit
  - CVE database (NVD, GitHub Advisory)
  - Severity: critical/high/medium/low

freshness:
  - Latest version vs installed
  - Major/minor/patch behind
  - Abandoned packages

compatibility:
  - PHP version requirements
  - Platform requirements (ext-*, lib-*)
  - Conflicting transitive dependencies

license:
  - MIT, Apache, GPL, AGPL, proprietary
  - Compatibility with project license
```

---

## Report

```yaml
dependency_report:
  total: 42
  
  security:
    critical: 0
    high: 1
    medium: 2
    low: 3
    
  freshness:
    up_to_date: 30
    minor_behind: 8
    major_behind: 4
    
  licenses:
    MIT: 35
    Apache: 5
    GPL: 2 (verify compatibility)
    
  actions:
    - priority: high
      package: "guzzlehttp/guzzle"
      issue: "CVE-2024-xxxxx (high)"
      action: "Update to 7.9+"
    
    - priority: medium
      package: "laravel/framework"
      issue: "3 minor versions behind"
      action: "Update to latest minor"
```

---

## Changelog

### 1.0.0 — Initial release. Audit categories, report format.
