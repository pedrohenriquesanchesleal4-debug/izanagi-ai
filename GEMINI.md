# Izanagi AI (Antigravity)

Este projeto usa o Izanagi AI. Agente principal: `orchestrator` (`agy --agent orchestrator` ou `/agents`). Os especialistas são subagentes em `.agents/agents/` e o orquestrador os invoca com `invoke_subagent`.

Regras do workspace: `.agents/rules/izanagi-core.md`. Catálogo de skills: `.skills/` (ou `.agents/skills/`); escolha com a skill `find-skills`.

Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
