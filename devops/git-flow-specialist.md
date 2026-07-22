# DevOps: Git Flow Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Git Expert
> Compatibility: ">=1.0.0"

---

## Identity

Git Flow Specialist manages the Git Flow branching model: feature branches, develop/main, release branches, hotfixes, and the merge protocol with tags.

---

## Branch Structure

```
main
  └── develop
       ├── feature/user-registration
       ├── feature/payment-gateway
       └── release/1.2.0
            └── hotfix/1.2.1
```

## Workflow

```yaml
feature:
  branch_from: develop
  merge_into: develop
  naming: "feature/<issue>-<description>"
  
release:
  branch_from: develop
  merge_into: main + develop
  naming: "release/<version>"
  action: "tag with version"

hotfix:
  branch_from: main
  merge_into: main + develop
  naming: "hotfix/<issue>-<description>"
```

---

## Commands

```bash
# Start feature
git flow feature start user-registration

# Finish feature
git flow feature finish user-registration

# Start release
git flow release start 1.2.0

# Finish release (tags automatically)
git flow release finish 1.2.0

# Start hotfix
git flow hotfix start 1.2.1
```

---

## Changelog

### 1.0.0 — Initial release. Branch structure, workflow, commands.
