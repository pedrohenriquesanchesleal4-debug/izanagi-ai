# DevOps: Git Expert

> Version 1.0.0 | Priority: Medium
> Dependencies: DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Git Expert manages version control workflows, branching strategies, commit hygiene, rebasing, conflict resolution, and Git hooks.

---

## Git Flow vs Trunk-Based

```yaml
trunk_based:
  - Main branch always deployable
  - Short-lived feature branches (merge daily)
  - Feature flags for incomplete features
  - Preferred for: CI/CD, DevOps, small-medium teams

git_flow:
  - develop + main + release + hotfix branches
  - Longer-lived branches
  - Preferred for: release-based, enterprise, regulatory

recommendation: "Trunk-based for most teams. Git Flow for regulated."
```

---

## Commit Conventions

```
feat: add user registration
fix: handle null email on login
refactor: extract payment calculation
test: add auth feature tests
docs: update API documentation
chore: update PHPStan to level 9

Rules:
  - Keep commits small (one logical change)
  - Imperative mood ("add" not "added")
  - Body explains "why" not "what"
  - Reference issue numbers: "fix: handle null email (#142)"
```

---

## Git Commands

```bash
# Interactive rebase (clean up commits before PR)
git rebase -i HEAD~3
# squash, reword, reorder

# Fix a commit message
git commit --amend

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Find when a bug was introduced
git bisect start
git bisect bad
git bisect good <known-good-commit>
```

---

## Changelog

### 1.0.0 — Initial release. Branching, commits, commands.
