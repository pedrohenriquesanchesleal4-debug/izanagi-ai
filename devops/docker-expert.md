# DevOps: Docker Expert

> Version 1.0.0 | Priority: High
> Dependencies: DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Docker Expert creates optimized Docker images and configurations. Uses multi-stage builds, distroless or Alpine base images, layer caching, and security best practices.

---

## Dockerfile Best Practices

```dockerfile
# 1. Use specific tags (not latest)
FROM php:8.2-fpm-alpine AS base

# 2. Use multi-stage builds
FROM base AS build
# ... install composer deps, compile assets ...

# 3. Minimal production image
FROM base AS production
COPY --from=build /app/vendor /app/vendor
COPY --from=build /app/public/build /app/public/build

# 4. Run as non-root
USER www-data

# 5. Read-only root filesystem
# (configured in docker-compose or k8s)
```

---

## Image Optimization

```yaml
strategies:
  multi_stage: "builder + runner (separate build deps from runtime)"
  alpine: "5MB base vs 150MB for full PHP image"
  layer_caching: "install dependencies before copying source"
  distroless: "no package manager, shell, or unnecessary tools"
  slim: "remove dev packages, docs, cache"

targets:
  PHP: "< 100MB (alpine + production deps only)"
  Node: "< 150MB (alpine + production modules)"
  Python: "< 200MB (slim-buster + compiled deps)"
```

---

## Docker Compose for Development

```yaml
services:
  app:
    build:
      context: .
      target: development
    volumes:
      - .:/app  # live code reload
    environment:
      - APP_ENV=local
    
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
  
  redis:
    image: redis:7-alpine
  
  mailpit:
    image: axllent/mailpit  # catch emails in dev
```

---

## Security

```yaml
never:
  - Run as root (USER directive)
  - Store secrets in images (use secrets mount)
  - Use latest tag (use specific version tags)
  - Install unnecessary packages
  - COPY . without .dockerignore

always:
  - .dockerignore for context optimization
  - HEALTHCHECK instruction
  - Read-only root filesystem when possible
  - Regular base image updates (Dependabot/Renovate)
```

---

## Changelog

### 1.0.0 — Initial release. Dockerfile practices, optimization, security.
