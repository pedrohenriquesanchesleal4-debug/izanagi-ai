---
name: cloud-infra
description: "Guia de infraestrutura cloud (AWS/GCP/Azure), Terraform/IaC, Docker, Kubernetes e CI/CD com boas práticas de segurança. Use para projetar, implantar ou revisar infraestrutura cloud."
---

# Skill Cloud Infrastructure — Izanagi

## Provedores Suportados

### AWS (Preferido)
| Serviço | Uso |
|---------|-----|
| VPC + Subnets | Isolamento de rede |
| ECS Fargate / EKS | Container orchestration |
| RDS (PostgreSQL) | Banco gerenciado |
| S3 + CloudFront | Static assets + CDN |
| Lambda | Serverless functions |
| Route 53 | DNS |
| WAF + Shield | Segurança |

### GCP / Azure
- GCP: Cloud Run, Cloud SQL, Cloud Storage, GKE
- Azure: App Service, Azure SQL, Blob Storage, AKS

---

## Terraform / IaC

### Estrutura de Módulos
```
terraform/
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/
│   ├── compute/
│   ├── database/
│   └── monitoring/
└── main.tf
```

### Boas Práticas
- **Remote state**: S3 + DynamoDB lock (terraform.tfstate no S3)
- **Workspaces**: `terraform workspace select prod`
- **Tagging**: `Project=Izanagi`, `Environment=prod`, `ManagedBy=Terraform`
- **Secrets**: nunca hardcoded — usar SSM Parameter Store ou Secrets Manager
- **Modules**: módulos reutilizáveis, versionados

---

## Docker

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
RUN npm ci --production
EXPOSE 3000
CMD ["npm", "start"]
```

---

## CI/CD

| Ferramenta | Uso |
|------------|-----|
| GitHub Actions | CI principal (lint, test, build, deploy) |
| Vercel | Deploy automático (branch main) |
| AWS CodePipeline | Deploy infraestrutura (Terraform) |

### Pipeline Ideal
```
Lint → Test → Build → Image → Deploy Staging → E2E → Deploy Prod
```

---

## Segurança em Cloud

- **IAM**: least privilege, roles específicas por serviço
- **Security Groups**: allow mínimos, deny por padrão
- **Encryption**: S3 SSE-S3, RDS encryption at rest, TLS in transit
- **Backup**: RDS automated backups (7-30 days retention)
- **Monitoring**: CloudWatch (AWS), alerts em CPU/memory/errors 4xx/5xx

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

> Gerado pelo Izanagi AI: cópia fiel de `skills/cloud-infra/SKILL.md` (fonte da verdade).
