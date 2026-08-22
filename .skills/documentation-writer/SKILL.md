---
name: "documentation-writer"
description: "Gera documentação de projeto — README, docs de API, guias de setup, arquitetura e contribuição — em templates prontos. Use ao documentar um projeto novo ou atualizar sua documentação existente. Gatilhos de ativação: skill: documentation writer; identity; documentation types; readme template."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Skill: Documentation Writer

> Migrado deterministicamente de `skills/documentation-writer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Gera documentação de projeto — README, docs de API, guias de setup, arquitetura e contribuição — em templates prontos.
- **Ativar quando:** Use ao documentar um projeto novo ou atualizar sua documentação existente.
- **Escopo canônico:** Skill: Documentation Writer
- **Seções do corpo original:** Identity · Documentation Types · README Template · Quick Start · Features
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Documentation Writer creates comprehensive project documentation:

Documentation Writer creates comprehensive project documentation: READMEs, API docs, setup guides, architecture docs, and contribution guidelines.

### Passo 2 — git clone ...

git clone ...
cp .env.example .env
composer install
php artisan serve

### Passo 3 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:docs -->

- Executar literalmente cada comando documentado e confirmar que funciona como escrito (zero falsificação).
- Conferir que instalação, configuração (.env.example), execução e limitações estão presentes e corretas.
- Verificar que nenhuma referência foi citada sem verificação de URL/conteúdo.
- Pedir a uma pessoa externa (ou sessão fresca) que siga o documento e registre onde travou.

## Common Rationalizations

- **"Código limpo se auto-documenta, comentário é redundância."**
  - Verdade: Código mostra o COMO, nunca o PORQUÊ nem o contrato de uso. README com instalação/execução/configuração é parte da entrega, não cortesia.
- **"README eu escrevo antes do publish."**
  - Verdade: Antes do publish é depois do esquecimento. Documentação escrita junto à implementação captura decisões que em 3 dias já não estão mais na memória.
- **"Doc envelhece rápido, então melhor nem escrever."**
  - Verdade: Doc desatualizada é corrigível; doc ausente é institucionalizada ignorância. O framework exige limitações conhecidas documentadas — honestidade sobre o que falta é conteúdo, não fraqueza.
- **"Só eu uso esse projeto, documento é overhead."**
  - Verdade: 'Eu daqui a 6 meses' também é outro desenvolvedor. Handoff sem documentação transforma toda manutenção futura em arqueologia.
- **"Coloquei um exemplo genérico no README, serve."**
  - Verdade: Exemplo que não roda é pior que nenhum: ensina errado com autoridade. Todo comando documentado precisa ter sido executado de fato (zero falsificação).
- **"Referência eu completo depois, agora é só chute razoável."**
  - Verdade: URL inventada é alucinação documentada. Nunca entregue referência não verificada — pesquise ou declare explicitamente que não verificou.

## Red Flags

- README sem comando exato de instalação e execução testado.
- `.env.example` ausente num projeto que exige configuração.
- Documentação divergente do comportamento real do código.
- Seção 'Limitações' vazia ou omitida (finge completude).
- Link/referência citada sem verificação (risco de alucinação).
- Termo de domínio usado sem definição numa base nova.

## Legacy Reference (v1)

# Skill: Documentation Writer

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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
