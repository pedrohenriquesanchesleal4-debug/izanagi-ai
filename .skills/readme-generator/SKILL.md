---
name: "readme-generator"
description: "Use ao criar ou reescrever o README de um repositório: extrai stack real, badges, instalação, uso, testes, deploy e contribuição. Gatilhos de ativação: readme generator; quando usar; stack / padrões; workflow (6 passos)."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# README Generator

> Migrado deterministicamente de `skills/readme-generator/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Use ao criar ou reescrever o README de um repositório: extrai stack real, badges, instalação, uso, testes, deploy e contribuição.
- **Ativar quando:** Use ao criar ou reescrever o README de um repositório: extrai stack real, badges, instalação, uso, testes, deploy e contribuição.
- **Escopo canônico:** README Generator
- **Seções do corpo original:** Quando usar · Stack / Padrões · Workflow (6 passos) · Instalação · Uso
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Extraia o estado real do repo

```bash
# antes de escrever UMA linha: colete scripts, versões, engines
cat package.json            # scripts, version, engines, keywords
cat .env.example            # variáveis esperadas (se existir)
cat docker-compose.yml      # serviços, portas expostas
git log --oneline -5        # para seção de changelog se não houver CHANGELOG.md
```

### Passo 2 — Monte o cabeçalho com badges reais

```markdown
# Nome do Projeto

> Descrição em 1 frase: o que faz, para quem, qual problema resolve.

[![CI](https://img.shields.io/github/actions/workflow/status/org/repo/ci.yml?branch=main&label=CI)](https://github.com/org/repo/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/org/repo?label=coverage)](https://codecov.io/gh/org/repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue.svg)](https://semver.org)
```

Regra: badge só entra se o recurso existe. Badge de cobertura sem CI de coverage é propaganda falsa — remova.

### Passo 3 — Escreva Instalação e Uso com comandos reais

```markdown

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Descrição em 1 frase no cabeçalho
- [ ] Badges só de recursos reais (CI, coverage, license)
- [ ] Comandos de instalação executados e validados do zero
- [ ] Tabela de variáveis de ambiente completa e marcada com obrigatoriedade
- [ ] Seções: Testes, Deploy, Estrutura (quando aplicável), Contribuição, Licença
- [ ] Seção de Contribuição com padrão de commit definido
- [ ] Links de badges/logo apontam para URLs reais do repo
- [ ] Nenhum segredo ou URL inventada no documento

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

# README Generator

README profissional e verificável, extraído do estado real do repositório — não da imaginação. O objetivo: **quem clonou o repo em 30 segundos consegue rodar, testar e contribuir sem abrir o código-fonte**.

## Quando usar

Use ao: criar repositório novo, reescrever README existente sem seção de contribuição/instalação, ou entregar qualquer projeto (exercício, SaaS, script) — a entrega não está completa sem README executável. **Pule para**: `technical-writer` se a demanda é um guia/API/arquitetura interna (não a porta de entrada do repo); `automation-documentation` se é README de automação Python.

## Stack / Padrões

- **Markdown puro + GitHub Flavored Markdown** — renderiza em qualquer forja (GitHub, GitLab, Gitea); sem HTML custom.
- **Badges via shields.io** — `![CI](https://img.shields.io/github/actions/workflow/status/<user>/<repo>/ci.yml)` apontando para o workflow real.
- **Extração real de metadata**: ler `package.json`/`pyproject.toml`/`Cargo.toml` para scripts, versão e dependências — nunca inventar comandos.
- **Tabelas para stack e comandos** — mais escaneáveis que listas para múltiplas linhas.

## Workflow (6 passos)

### 1. Extraia o estado real do repo

```bash
# antes de escrever UMA linha: colete scripts, versões, engines
cat package.json            # scripts, version, engines, keywords
cat .env.example            # variáveis esperadas (se existir)
cat docker-compose.yml      # serviços, portas expostas
git log --oneline -5        # para seção de changelog se não houver CHANGELOG.md
```

### 2. Monte o cabeçalho com badges reais

```markdown
# Nome do Projeto

> Descrição em 1 frase: o que faz, para quem, qual problema resolve.

[![CI](https://img.shields.io/github/actions/workflow/status/org/repo/ci.yml?branch=main&label=CI)](https://github.com/org/repo/actions/workflows/ci.yml)
[![Coverage](https://img.shields.io/codecov/c/github/org/repo?label=coverage)](https://codecov.io/gh/org/repo)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![SemVer](https://img.shields.io/badge/SemVer-2.0.0-blue.svg)](https://semver.org)
```

Regra: badge só entra se o recurso existe. Badge de cobertura sem CI de coverage é propaganda falsa — remova.

### 3. Escreva Instalação e Uso com comandos reais

```markdown
## Instalação

```bash
npm install          # instala dependências
cp .env.example .env # configure variáveis (veja tabela abaixo)
npm run db:migrate   # cria o banco
```

| Variável | Obrigatória | Descrição |
|---|---|---|
| `DATABASE_URL` | sim | Conexão PostgreSQL (formato `postgres://...`) |
| `API_KEY` | sim | Chave do provedor de e-mail |
| `LOG_LEVEL` | não | `debug`\|`info`\|`warn` (padrão: `info`) |

## Uso

```bash
npm run dev     # servidor de desenvolvimento em http://localhost:3000
npm test        # executa a suíte (vitest)
npm run lint    # eslint + prettier --check
```
```

Cada comando do README deve existir nos scripts do projeto. Antes de entregar, rode os comandos citados.

### 4. Documente Testes, Deploy e Estrutura

```markdown
## Testes

```bash
npm test                    # unitários + integração
npm run test:e2e            # E2E (Playwright) — requer app rodando
npm run coverage            # relatório de cobertura
```

## Deploy

Deploy automatizado via GitHub Actions: push em `main` dispara
`deploy-production.yml` → build + migrate + restart no container da VPS.

## Estrutura

```text
src/
├── app/       # rotas e páginas (Next.js App Router)
├── core/      # lógica de negócio (independente de framework)
└── infra/     # banco, cache, integrações externas
```
```

### 5. Adicione Contribuição e Licença (não opcional)

```markdown
## Contribuição

1. Fork + branch `feat/<descrição>`.
2. Commits seguem [Conventional Commits](https://www.conventionalcommits.org).
3. Rode `npm run verify` (lint + test) antes do PR.
4. Abra PR descrevendo o problema resolvido e como testar.

## Licença

MIT — veja [LICENSE](LICENSE). Mudanças relevantes em [CHANGELOG.md](CHANGELOG.md)
seguindo [Keep a Changelog](https://keepachangelog.com).
```

### 6. Valide contra o checklist abaixo e leia o README final como um dev novo

Leia do topo ao fim simulando um clone: `git clone`, seguir cada passo. Se alguma instrução assumir conhecimento não coberto, adicione link/pré-requisito.

## Regras de ouro

- **Comandos reais**: todo bloco de código do README deve funcionar copiando e colando; rode antes de entregar.
- **Mínimo para rodar**: instalação + `.env` + primeiro comando de uso presentes e completos.
- **Badge honesta**: badge de CI/coverage só com o recurso existente no repo.
- **1 frase de descrição** no topo: o que faz, para quem, diferencial.
- **Tabela de variáveis de ambiente** com obrigatoriedade — `.env.example` anotado.
- **Versão visível**: badge SemVer ou seção Version — alinhada ao `package.json`.

## Checklist (antes de entregar)

- [ ] Descrição em 1 frase no cabeçalho
- [ ] Badges só de recursos reais (CI, coverage, license)
- [ ] Comandos de instalação executados e validados do zero
- [ ] Tabela de variáveis de ambiente completa e marcada com obrigatoriedade
- [ ] Seções: Testes, Deploy, Estrutura (quando aplicável), Contribuição, Licença
- [ ] Seção de Contribuição com padrão de commit definido
- [ ] Links de badges/logo apontam para URLs reais do repo
- [ ] Nenhum segredo ou URL inventada no documento

## Anti-padrões (proibido)

1. ❌ Comandos inventados (`npm run start` quando o script é `npm run dev`) — quebra o fluxo do leitor
2. ❌ Badge genérica com `user/repo` de exemplo — link morto é pior que ausência
3. ❌ Documentar variável que não existe no `.env.example`
4. ❌ "Em breve" ou seções vazias — README com stub não passa o gate
5. ❌ Instruções que assumem dependências globais sem avisar (`precisa de Node 20+`)
6. ❌ Changelog manual duplicando o Git log sem critério
7. ❌ Repetir o código-fonte inteiro no README — referencia, não cola

## Composição com outras skills

- **Antes**: `brainstorming`/`discovery` (definição do que o repo faz) → `qa` (auditar o que existe) → `web-perf-seo` (se incluir seção de performance)
- **Depois**: `technical-writer` (docs aprofundadas referenciadas no README) → `docs` (READMEs de módulos) → `professor-modo` (explicar o que foi documentado)
- **Atenção**: se o projeto mudar de stack, regenere o README — nunca edite emenda sobre emenda (ver `memoria-projeto` para registrar o estado).

## References

- GitHub docs (READMEs e badges de actions): https://docs.github.com
- Shields.io (badges estáticas): https://shields.io
- SemVer: https://semver.org · Conventional Commits: https://www.conventionalcommits.org · Keep a Changelog: https://keepachangelog.com
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
