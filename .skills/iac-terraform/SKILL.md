---
name: "iac-terraform"
description: "Padrões de Infrastructure as Code com Terraform/OpenTofu: módulos, remote state, workspaces e provisionamento multi-cloud. Use ao criar ou revisar infraestrutura como código. Gatilhos de ativação: skill iac & terraform — izanagi; terraform vs opentofu; estrutura de projeto; remote state."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill IaC & Terraform — Izanagi

> Migrado deterministicamente de `skills/iac-terraform/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Padrões de Infrastructure as Code com Terraform/OpenTofu: módulos, remote state, workspaces e provisionamento multi-cloud.
- **Ativar quando:** Use ao criar ou revisar infraestrutura como código.
- **Escopo canônico:** Skill IaC & Terraform — Izanagi
- **Seções do corpo original:** Terraform vs OpenTofu · Estrutura de Projeto · Remote State · Modulos · Boas Praticas
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Terraform vs OpenTofu

| Aspecto | Terraform | OpenTofu |
|---------|-----------|----------|
| Licenca | BSL (BUSL) | MPL 2.0 (open source) |
| CLI | `terraform` | `tofu` |
| Compatibilidade | HCL v2 | HCL v2 (compativel) |
| Estado | TF Cloud / S3 | S3 / Local |
| Providers | HashiCorp Registry | OpenTofu Registry |
| **Escolha** | Se ja usa TF Cloud | Se prefere open-source |

---

### Passo 2 — Aplicar: Estrutura de Projeto

```
infra/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   └── ...
│   └── prod/
│       └── ...
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   └── database/
└── global/
    └── iam/
```

---

### Passo 3 — Aplicar: Remote State

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "project-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

---

### Passo 4 — Aplicar: Module Structure

```hcl
# modules/networking/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  tags                 = var.tags
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  map_public_ip_on_launch = true
}
```

---

### Passo 5 — Aplicar: Boas Praticas

| Pratica | Descricao |
|---------|-----------|
| State locking | DynamoDB (S3) ou PG backend |
| Version constraints | `required_version = "~> 1.5"` |
| Tagging | `Project`, `Environment`, `ManagedBy`, `CostCenter` |
| Secrets | `aws_ssm_parameter` ou `aws_secretsmanager_secret` |
| Plan review | Sempre revisar `terraform plan` antes de `apply` |
| Pre-commit hooks | `terraform fmt`, `terraform validate` |
| CI/CD | `terraform plan` no PR, `terraform apply` no merge |

### Passo 6 — Aplicar: References

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

# Skill IaC & Terraform — Izanagi

## Terraform vs OpenTofu

| Aspecto | Terraform | OpenTofu |
|---------|-----------|----------|
| Licenca | BSL (BUSL) | MPL 2.0 (open source) |
| CLI | `terraform` | `tofu` |
| Compatibilidade | HCL v2 | HCL v2 (compativel) |
| Estado | TF Cloud / S3 | S3 / Local |
| Providers | HashiCorp Registry | OpenTofu Registry |
| **Escolha** | Se ja usa TF Cloud | Se prefere open-source |

---

## Estrutura de Projeto

```
infra/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   │   └── ...
│   └── prod/
│       └── ...
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   └── database/
└── global/
    └── iam/
```

---

## Remote State

```hcl
# backend.tf
terraform {
  backend "s3" {
    bucket         = "project-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-state-lock"
    encrypt        = true
  }
}
```

---

## Modulos

### Module Structure
```hcl
# modules/networking/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.cidr_block
  enable_dns_hostnames = true
  tags                 = var.tags
}

resource "aws_subnet" "public" {
  count                   = length(var.public_subnets)
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnets[count.index]
  map_public_ip_on_launch = true
}
```

---

## Boas Praticas

| Pratica | Descricao |
|---------|-----------|
| State locking | DynamoDB (S3) ou PG backend |
| Version constraints | `required_version = "~> 1.5"` |
| Tagging | `Project`, `Environment`, `ManagedBy`, `CostCenter` |
| Secrets | `aws_ssm_parameter` ou `aws_secretsmanager_secret` |
| Plan review | Sempre revisar `terraform plan` antes de `apply` |
| Pre-commit hooks | `terraform fmt`, `terraform validate` |
| CI/CD | `terraform plan` no PR, `terraform apply` no merge |

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
