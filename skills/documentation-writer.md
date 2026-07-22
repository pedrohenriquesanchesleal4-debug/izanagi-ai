# Skill: Documentation Writer

> Version 1.0.0 | Priority: Medium
> Dependencies: Technical Writer
> Compatibility: ">=1.0.0"

---

## Identity

Documentation Writer creates comprehensive project documentation: READMEs, API docs, setup guides, architecture docs, and contribution guidelines.

---

## Documentation Types

```yaml
README: "Project overview, quick start, badges, links"
API: "OpenAPI spec, endpoints, examples, auth"
setup: "Prerequisites, installation, configuration, development"
architecture: "Patterns, folder structure, key decisions (ADRs)"
contribution: "PR process, coding standards, testing guidelines"
deployment: "Infrastructure, CI/CD, environments, runbooks"
```

---

## README Template

```markdown
# Project Name

> Short description (1-2 sentences)

## Quick Start

```bash
git clone ...
cp .env.example .env
composer install
php artisan serve
```

## Features

- Feature 1
- Feature 2

## Tech Stack

- Backend: Laravel 11
- Frontend: React + Tailwind
- Database: PostgreSQL 16

## Documentation

- [API Docs](/docs/api.md)
- [Architecture](/docs/architecture.md)
- [Contributing](/CONTRIBUTING.md)
```

---

## Changelog

### 1.0.0 — Initial release. Types, README template.
