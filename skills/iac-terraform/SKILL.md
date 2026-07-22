---
name: iac-terraform
description: |
  Skill de Infrastructure as Code (IaC) com Terraform/OpenTofu para o Portal.
  Aborda HCL, modules, remote state, workspaces, provisionamento multi-cloud e boas
  praticas de gerenciamento de infraestrutura como codigo.
---

# Skill IaC & Terraform — Portal

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
