---
name: setup-recommender
description: "Analisa o projeto e o ambiente do agente e recomenda o setup mínimo que rende: quais agentes e skills do Izanagi ligar, quais hooks, MCPs e plugins valem para esta stack, e quais plugins globais estão só ocupando contexto. Use ao instalar o Izanagi num projeto, quando o agente parecer lento, caro ou ignorando skills, ou quando o usuário perguntar o que instalar."
triggers:
  - "o que instalar neste projeto"
  - "agente gastando muito token / ignorando skills"
  - "muitos plugins instalados"
  - "configurar Claude Code / Antigravity / Codex para este repo"
capabilities:
  - "stack-detection"
  - "context-budget-audit"
  - "setup-recommendation"
---

# Setup Recommender: o setup mínimo que rende

Mais skills e plugins não é mais capacidade. Toda skill instalada coloca nome e descrição no contexto de toda sessão; acima do orçamento, as excedentes aparecem só com o nome e o agente para de escolhê-las. Esta skill mede o que está instalado contra o que o projeto usa.

## Quando usar

Na instalação do Izanagi, quando o usuário reclamar de custo ou de skills ignoradas, ou antes de adicionar mais plugins.

## Passo 1: detectar a stack (sem ler o código inteiro)

`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Dockerfile`, pastas de teste, framework de UI, banco (prisma/drizzle/migrations), CI. Saída: 5 a 10 linhas.

## Passo 2: medir o orçamento de contexto

| CLI | Onde contar |
|---|---|
| Claude Code | `.claude/skills/*/SKILL.md`, `~/.claude/skills`, plugins em `~/.claude/plugins` |
| Antigravity | `agy agents`, `.agents/skills`, `.agents/skills.json`, `~/.gemini/config/plugins/*` |
| Codex / OpenCode | `.codex/`, `.opencode/agent`, configs globais |

Conte skills totais e duplicadas (mesmo nome em lugares diferentes). Acima de ~150 skills visíveis, há corte; acima de ~300, as do projeto quase certamente somem. No Antigravity dá para confirmar perguntando ao agente se a skill aparece na lista "excluded due to context budget".

## Passo 3: recomendar

Três listas, cada item com uma linha de motivo:

1. **Ligar**: agentes e skills do Izanagi que casam com a stack (ex.: Next.js + Prisma → `senior-engineer`, `database`, `react-next-practices`, `data-engineering`, `site-launch-checklist`).
2. **Desligar ou não instalar**: plugins/skills globais sem relação com a stack ou que duplicam skills do Izanagi (ex.: três coleções diferentes de "code review").
3. **Considerar**: hooks e MCPs com ganho claro para este repo (filtro de saída de terminal, mapa do código, MCP do banco ou do Figma), com custo e risco.

## Regras

- Recomende; **não desinstale nem desative** nada global sem o usuário pedir. Plugins globais afetam todos os projetos dele.
- Prefira desativar a desinstalar (é reversível): `agy plugin disable <nome>`, `/plugin` no Claude Code.
- Reavalie após mudança grande de stack.
