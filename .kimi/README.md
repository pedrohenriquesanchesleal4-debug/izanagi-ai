# Izanagi AI — Kimi CLI (Moonshot)

O **Kimi CLI** é compatível com a convenção do opencode: ele lê `AGENTS.md` e os comandos slash em `.opencode/agent/*.md` nativamente.

## Como usar

- **Fonte da verdade**: `AGENTS.md` (leia antes de qualquer tarefa).
- **Comandos slash**: `.opencode/agent/*.md` — ative agentes com `/<nome>` (`/architect`, `/security`, `/devops`, ...).
- **Fundação**: `SYSTEM.md` e `RULES.md`.
- **Skills**: biblioteca em `skills/<name>/SKILL.md` (79+ skills).
- **Config**: `opencode.json` aponta as instruções do projeto.

## Regras essenciais

- **Arquitetura antes de código.** Pense antes de agir.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA".
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código.

## Sempre / Nunca

- **Sempre**: IaC versionado; monitoramento desde o dia 1; secrets por ferramenta própria.
- **Nunca**: commit `.env`; container root; deploy sem CI; hardcode de config de ambiente.

> Gerado pelo Izanagi AI em `C:\Users\pedro.leal\Documents\NexusAI` — `izanagi export --cli kimi`
