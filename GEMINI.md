# Izanagi AI Framework (Antigravity Integration)

> **Fonte da verdade canônica:** `AGENTS.md` (já lido nativamente pelo Antigravity).

O Izanagi é um framework meta para engenharia de software autônoma com o Izanagi Orchestrator (`/agents`), 23 agentes especializados e catálogo de skills.

- **Orquestrador Central (`/agents`)**: Ponto de entrada principal. O Orchestrator analisa o projeto, delega para especialistas em paralelo e executa a implementação e escrita direta nos arquivos.
- **Autorização Total**: O Orchestrator e todos os agentes têm autorização completa para ler, criar, editar e alterar qualquer arquivo no workspace, bem como rodar comandos e testes.
- **Delegação via Subagentes Nativos**: Operada via `invoke_subagent` e `define_subagent`. Sem referências a canvas ou terminais Maestri.
- **Regras essenciais**: ver `.agents/rules/izanagi-core.md`.
- **Skills ativas**: descobertas via `.agents/skills.json` em `skills/` e `.skills/`.
- **Agentes especializados**: disponíveis como subagentes para o Orchestrator delegar tarefas sob demanda.

---
Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
