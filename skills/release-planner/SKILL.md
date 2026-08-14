---
name: release-planner
description: "Use para planejar releases: versionamento semântico, checklist de release, changelog e coordenação de deploy."
version: 1.0.0
compatibility: ">= 1.0.0"
triggers: [release-planner]
token_budget: 2048
---

# Skill: Release Planner

> Version 1.0.0 | Priority: Medium
> Dependencies: Project Manager, Breaking Change Detector
> Compatibility: ">=1.0.0"

---

## Identity

Release Planner manages version bumps, changelog generation, release branches, and deployment coordination.

---

## Version Bump Rules

```yaml
major: breaking changes (API contract, DB schema, public API)
  format: "1.0.0 → 2.0.0"
  branch: "release/2.0.0"
  action: "Includes migration guide, sunset headers"

minor: new features, backward compatible
  format: "1.0.0 → 1.1.0"
  branch: "release/1.1.0"
  action: "Add deprecation notices for old APIs"

patch: bug fixes, no new features
  format: "1.0.0 → 1.0.1"
  branch: "main (direct commit/tag)"
  action: "Urgent: hotfix branch"
```

---

## Release Checklist

- [ ] All tests pass (CI green)
- [ ] Changelog.md updated
- [ ] Version bumped in config/app.php or package.json
- [ ] Migration scripts tested (up + down)
- [ ] Breaking changes documented in release notes
- [ ] Deployment playbook reviewed
- [ ] Rollback plan confirmed
- [ ] Stakeholders notified

---

## Changelog Entry

```markdown
## [1.2.0] — 2026-07-17

### Added
- Payment integration with Stripe
- Email notifications for payment confirmation

### Changed
- Upgrade Laravel from 10 to 11

### Fixed
- N+1 query on posts listing (#142)
- Null email handling in login (#138)
```

---

## Changelog

### 1.0.0 — Initial release. Version rules, checklist, changelog format.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
