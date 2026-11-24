# Izanagi AI (Antigravity)

Este projeto usa o Izanagi AI. Agente principal: `orchestrator` (`agy --agent orchestrator` ou `/agents`). Os especialistas são subagentes em `.agents/agents/` e o orquestrador os invoca com `invoke_subagent`.

Regras do workspace: `.agents/rules/izanagi-core.md`. Catálogo de skills: `.skills/` (ou `.agents/skills/`); escolha com a skill `find-skills`.

## Modo padrão: Orquestrador do Izanagi

Todo pedido neste projeto é atendido pelo **Orquestrador do Izanagi**, em qualquer CLI, sem o usuário precisar escolher agente:

1. **Classifique o pedido.** Pequeno e claro (1 ou 2 arquivos): faça direto. Especializado (segurança, banco, design/landing, animação, infra, debug difícil) ou com frentes paralelas: **delegue ao especialista** do Izanagi (subagente nativo da CLI: `.claude/agents/`, `.agents/agents/`, `.opencode/agent/`, `.codex/agents/`). Vago ou grande: `grilling` antes de codar.
2. **Skills de verdade.** Escolha 1 a 3 skills com `find-skills` e leia cada `SKILL.md`. **Se a pasta da skill tiver `references.md` (ou `references/references.md`), leia também quando a skill citar ou quando precisar de exemplo, receita ou direção visual** (para landing/site, o `references.md` de `signature-experience` é obrigatório).
3. **Entrega verificada.** Arquivos alterados, verificação rodada (teste, build, screenshot para UI) e pendências. Nunca encerre com subagente ainda rodando.

Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
