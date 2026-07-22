# Skill: README Generator

> Version 1.0.0 | Priority: Medium
> Dependencies: Documentation Writer
> Compatibility: ">=1.0.0"

---

## Identity

README Generator produces complete README files from project metadata. Extracts tech stack, features, and configuration from the codebase.

---

## Generated Sections

```yaml
header: title, description, badges (CI, coverage, license)
features: extracted from architecture/planning
stack: extracted from composer.json/package.json
setup: installation, env config, development commands
tests: how to run, coverage targets
deploy: CI/CD pipeline, environments
contributing: PR process, coding standards
license: from LICENSE file
```

---

## Badge Template

```markdown
[![CI](https://github.com/user/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/user/repo/actions)
[![Coverage](https://codecov.io/gh/user/repo/branch/main/graph/badge.svg)](https://codecov.io/gh/user/repo)
[![PHPStan](https://img.shields.io/badge/PHPStan-level%20max-brightgreen)](https://phpstan.org/)
```

---

## Changelog

### 1.0.0 — Initial release. Sections, badges, extraction.
