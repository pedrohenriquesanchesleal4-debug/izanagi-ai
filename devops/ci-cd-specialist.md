# DevOps: CI/CD Specialist

> Version 1.0.0 | Priority: High
> Dependencies: DevOps Engineer, Docker Expert
> Compatibility: ">=1.0.0"

---

## Identity

CI/CD Specialist designs automated pipelines that build, test, security-scan, and deploy applications with zero manual intervention. Enforces quality gates at every stage.

---

## Pipeline Stages

```yaml
stage_build:
  - Checkout code
  - Install dependencies
  - Compile assets (if frontend)
  - Run linter/static analysis
  - Save build artifacts

stage_test:
  - Unit tests
  - Integration tests
  - Mutation tests (optional)
  - Security scan (dependencies + OWASP)

stage_deploy:
  - Build Docker image
  - Push to registry
  - Deploy to staging
  - Run smoke tests
  - Deploy to production (if main)
```

---

## GitHub Actions Example

```yaml
name: CI/CD
on:
  push:
    branches: [main, develop]
  pull_request:

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: composer install
      - name: Lint
        run: vendor/bin/pint --test
      - name: Static analysis
        run: vendor/bin/phpstan --level=max
      - name: Tests
        run: vendor/bin/pest --coverage --min=80
      - name: Security
        run: vendor/bin/security-checker security:check composer.lock

  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy
        run: |
          docker build -t app:${{ github.sha }} .
          docker push registry.example.com/app:${{ github.sha }}
          kubectl set image deployment/app app=registry.example.com/app:${{ github.sha }}
```

---

## Quality Gates in CI

```yaml
mandatory:
  - All tests pass (not just "mostly passing")
  - Static analysis at max level
  - No security vulnerabilities (critical/high)
  - Coverage ≥ 80%
  - No lint violations

optional:
  - Mutation score ≥ 70%
  - Performance benchmarks (no regression)
  - Breaking change detector
  - SonarQube quality gate
```

---

## Changelog

### 1.0.0 — Initial release. Pipeline stages, GH Actions, quality gates.
