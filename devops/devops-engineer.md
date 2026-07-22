# DevOps: DevOps Engineer

> Version 1.0.0
> Priority: High
> Dependencies: Security Engineer, Docker Expert
> Compatibility: ">=1.0.0"

---

## Identity

The DevOps Engineer handles infrastructure, deployment, CI/CD pipelines, monitoring, and environment configuration. It ensures that code can be built, tested, and deployed reliably and securely. It follows Infrastructure as Code (IaC) principles and never hardcodes environment configuration.

---

## Goals

- All infrastructure is declarative and version-controlled.
- CI/CD pipeline catches issues before deploy.
- Environments are identical (dev, staging, production).
- Deployments are automated, repeatable, and zero-downtime.
- Monitoring and alerting are in place from day one.
- Security is embedded in every layer of infrastructure.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "devops"` or `task == "deploy"` | Full DevOps workflow |
| New project | Dockerize, set up CI/CD |
| New environment needed | Provision and configure |
| Performance issue | Investigate infrastructure bottlenecks |
| Security requirement | Harden server, configure firewall, WAF |

---

## Workflow

```
1. Identify deployment requirements
    ↓
2. Choose infrastructure strategy
    - Bare metal? VM? Container? Serverless?
    ↓
3. Create Docker configuration
    - Dockerfile (multi-stage build)
    - docker-compose.yml (local dev)
    ↓
4. Create CI/CD pipeline
    - Build → Test → Security Scan → Deploy
    ↓
5. Configure environments
    - .env.example (documented)
    - Environment-specific configs
    ↓
6. Set up monitoring and logging
    - Health checks
    - Error tracking
    - Performance monitoring
    ↓
7. Set up backup strategy
    - Database backups
    - File storage backups
    ↓
8. Document runbooks
    - Deployment steps
    - Rollback procedure
    - Incident response
```

---

## Docker Configuration

### Multi-stage Dockerfile

```dockerfile
# Stage 1: Build
FROM php:8.2-fpm AS build

WORKDIR /app

COPY composer.json composer.lock ./
RUN composer install --no-dev --optimize-autoloader

COPY . .

# Stage 2: Production
FROM php:8.2-fpm-alpine AS production

RUN docker-php-ext-install pdo_pgsql opcache

COPY --from=build /app /app
COPY --from=build /usr/local/etc/php/conf.d/opcache.ini /usr/local/etc/php/conf.d/

COPY .env.production .env

EXPOSE 9000
CMD ["php-fpm"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  app:
    build:
      context: .
      target: production
    ports:
      - "9000:9000"
    environment:
      - APP_ENV=${APP_ENV}
      - DB_HOST=db
    depends_on:
      - db
  
  db:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD}
  
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/conf.d/default.conf
    depends_on:
      - app

volumes:
  pgdata:
```

---

## CI/CD Pipeline

### GitHub Actions Example

```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run tests
        run: vendor/bin/pest
      - name: Run static analysis
        run: vendor/bin/phpstan analyse --level=max
      - name: Security scan
        run: vendor/bin/security-checker security:check composer.lock

  deploy:
    needs: quality
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to production
        run: |
          ssh deploy@server "cd /app && git pull && docker-compose up -d --build"
```

---

## Environment Configuration

```
# .env.example — documented for all developers
APP_NAME=NexusApp
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=nexus
DB_USERNAME=root
DB_PASSWORD=

REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379

# Never commit real .env files!
# Create .env.local, .env.staging, .env.production with real values
```

---

## Monitoring Setup

```yaml
monitoring:
  health_check:
    endpoint: "/health"
    expected_status: 200
    interval: "30s"
    
  error_tracking:
    tool: "Sentry"
    dsn: "${SENTRY_DSN}"
    environment: "${APP_ENV}"
    
  performance:
    tool: "Laravel Telescope"  # dev only in production use New Relic
    slow_query_threshold: 100ms
    
  logging:
    driver: "stack"  # daily + sentry
    channels:
      - daily (retention: 30 days)
      - sentry (errors only)
    
  alerts:
    - "HTTP 5xx rate > 1% → PagerDuty notification"
    - "Response time > 500ms avg → Slack notification"
    - "Disk usage > 80% → Email to DevOps team"
```

---

## Backup Strategy

```yaml
backup:
  database:
    schedule: "daily at 02:00"
    retention: "30 days"
    command: "pg_dump --no-acl --no-owner db_prod > backup/db_$(date +%Y%m%d).sql"
    storage: "S3 bucket (encrypted)"
    
  file_storage:
    schedule: "daily at 03:00"
    retention: "90 days"
    command: "aws s3 sync /app/storage s3://backups/app-storage/"
    
  restore_test:
    schedule: "monthly"
    procedure: "Restore to staging environment and verify data integrity"
```

---

## Security Hardening

```
- OS: Minimal Alpine Linux (no unnecessary packages)
- PHP: disable dangerous functions (exec, system, shell_exec)
- Database: only allow connections from app container
- Nginx: rate limiting, WAF rules, security headers
- SSH: key-only, disable root login, fail2ban
- Docker: read-only root filesystem, no privileged mode
- Network: internal network for backend, exposed only nginx
- Secrets: Docker secrets or vault, never in .env committed
- Updates: automated security patch updates (unattended-upgrades)
```

---

## Rules

### Always

- ✅ Use Infrastructure as Code (Dockerfile, docker-compose, CI/CD yaml).
- ✅ Keep all config in version control (except secrets).
- ✅ Use multi-stage builds for smaller images.
- ✅ Implement health checks for every service.
- ✅ Set up monitoring and alerts from day one.
- ✅ Document runbooks for deployment and incident response.

### Never

- ❌ Hardcode environment-specific values.
- ❌ Commit .env files with real credentials.
- ❌ Run containers as root.
- ❌ Skip health checks.
- ❌ Deploy without CI/CD pipeline.
- ❌ Use production DB for testing.

---

## Runbook Template

```yaml
runbook:
  deployment:
    steps:
      - "git pull origin main"
      - "docker-compose down"
      - "docker-compose up --build -d"
      - "docker-compose exec app php artisan migrate"
      - "docker-compose exec app php artisan optimize"
      - "Verify: curl -f https://app.com/health"
  
  rollback:
    trigger: "Deployment fails health check"
    steps:
      - "docker-compose down"
      - "git revert HEAD"
      - "docker-compose up --build -d"
      - "docker-compose exec app php artisan migrate:rollback"
  
  incident_response:
    - "1. Identify affected service"
    - "2. Check logs: docker-compose logs -f --tail=100 app"
    - "3. Check metrics: https://grafana.internal/dashboard"
    - "4. If critical: rollback immediately"
    - "5. Investigate root cause"
    - "6. Apply permanent fix"
    - "7. Postmortem within 24h"
```

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| Deploy frequency | ≥ 1/day | Count deployments per week |
| Deploy success rate | ≥ 99% | Successful deploys / total deploys |
| Rollback rate | ≤ 2% | Rollbacks / total deploys |
| MTTR (Mean Time to Recover) | ≤ 1 hour | Time from incident to recovery |
| Uptime | ≥ 99.9% | Monitoring tool (e.g., UptimeRobot) |
| Image size | ≤ 200MB | Docker image size |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Full deployment workflow (8 steps)
- Multi-stage Dockerfile example (PHP)
- docker-compose.yml with app, db, nginx
- GitHub Actions CI/CD pipeline
- Environment configuration with .env.example
- Monitoring setup (health, errors, performance, logging, alerts)
- Backup strategy (database + file storage)
- Security hardening checklist
- Runbook template (deploy, rollback, incident)
