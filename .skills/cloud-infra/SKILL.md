---
name: "cloud-infra"
description: "Guia de infraestrutura cloud (AWS/GCP/Azure), Terraform/IaC, Docker, Kubernetes e CI/CD com boas práticas de segurança. Use para projetar, implantar ou revisar infraestrutura cloud. Gatilhos de ativação: skill cloud infrastructure — izanagi; provedores suportados; terraform / iac; docker."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill Cloud Infrastructure — Izanagi

> Migrado deterministicamente de `skills/cloud-infra/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Guia de infraestrutura cloud (AWS/GCP/Azure), Terraform/IaC, Docker, Kubernetes e CI/CD com boas práticas de segurança.
- **Ativar quando:** Use para projetar, implantar ou revisar infraestrutura cloud.
- **Escopo canônico:** Skill Cloud Infrastructure — Izanagi
- **Seções do corpo original:** Provedores Suportados · Terraform / IaC · Docker · CI/CD · Segurança em Cloud
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: AWS (Preferido)

| Serviço | Uso |
|---------|-----|
| VPC + Subnets | Isolamento de rede |
| ECS Fargate / EKS | Container orchestration |
| RDS (PostgreSQL) | Banco gerenciado |
| S3 + CloudFront | Static assets + CDN |
| Lambda | Serverless functions |
| Route 53 | DNS |
| WAF + Shield | Segurança |

### Passo 2 — Aplicar: GCP / Azure

- GCP: Cloud Run, Cloud SQL, Cloud Storage, GKE
- Azure: App Service, Azure SQL, Blob Storage, AKS

---

### Passo 3 — Aplicar: Estrutura de Módulos

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

### Passo 4 — Aplicar: Boas Práticas

- **Remote state**: S3 + DynamoDB lock (terraform.tfstate no S3)
- **Workspaces**: `terraform workspace select prod`
- **Tagging**: `Project=Izanagi`, `Environment=prod`, `ManagedBy=Terraform`
- **Secrets**: nunca hardcoded — usar SSM Parameter Store ou Secrets Manager
- **Modules**: módulos reutilizáveis, versionados

---

### Passo 5 — Aplicar: Docker

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

### Passo 6 — Aplicar: CI/CD

| Ferramenta | Uso |
|------------|-----|
| GitHub Actions | CI principal (lint, test, build, deploy) |
| Vercel | Deploy automático (branch main) |
| AWS CodePipeline | Deploy infraestrutura (Terraform) |

### Passo 7 — Aplicar: Pipeline Ideal

```
Lint → Test → Build → Image → Deploy Staging → E2E → Deploy Prod
```

---

### Passo 8 — Aplicar: Segurança em Cloud

- **IAM**: least privilege, roles específicas por serviço
- **Security Groups**: allow mínimos, deny por padrão
- **Encryption**: S3 SSE-S3, RDS encryption at rest, TLS in transit
- **Backup**: RDS automated backups (7-30 days retention)
- **Monitoring**: CloudWatch (AWS), alerts em CPU/memory/errors 4xx/5xx

### Passo 9 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:devops -->

- Provar o pipeline ponta a ponta em ambiente de teste antes de produção.
- Confirmar healthcheck, rollback e alertas acionáveis configurados para o que foi alterado.
- Verificar que nenhum secret aparece em logs/manifestos gerados.
- Registrar versão, timestamp de deploy e resultado dos checks (rastreabilidade).

## Common Rationalizations

- **"Funciona na minha máquina, o problema é o ambiente."**
  - Verdade: Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.
- **"Deploy manual hoje, pipeline depois que estabilizar."**
  - Verdade: Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.
- **"Monitoramento a gente implanta quando escalar."**
  - Verdade: Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.
- **"Rollback nunca precisamos, pra que testar?"**
  - Verdade: A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.
- **"CI tá lento, vou pular os checks só dessa vez."**
  - Verdade: 'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.
- **"Alerta demais incomoda, melhor só o essencial depois."**
  - Verdade: Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.

## Red Flags

- Pipeline sem etapa obrigatória de build+teste antes do deploy.
- Secrets impressos no log de CI (mesmo mascarados tardiamente).
- Serviço sem healthcheck/readiness probe configurado.
- Infra alterada direto no console, fora do código versionado (drift).
- Single point of failure sem redundância nem plano documentado.
- Backup existente mas nunca restaurado em teste.
- Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.

## Legacy Reference (v1)

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
