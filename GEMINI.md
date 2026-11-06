# Izanagi AI Framework (Antigravity Integration)

> **Fonte da verdade canônica:** `AGENTS.md` (já lido nativamente pelo Antigravity).

O Izanagi é um framework meta para engenharia de software autônoma com o Izanagi Orchestrator (`/agents`), 23 agentes especializados e catálogo de skills em `.skills/` e `skills/`.

- **Execução e Escrita Direta na IDE (`/agents`)**: O Orchestrator e todos os agentes possuem autorização e dever de ler, criar e editar qualquer arquivo diretamente no workspace (`write_file`, `edit_file`) e rodar comandos/testes (`run_command`). NUNCA aja como um chatbot passivo e NUNCA fique parado esperando uma fila de subagentes sem produzir código.
- **Uso Real e Obrigatório das Skills por Demanda**: Antes de implementar qualquer tarefa, identifique as skills pertinentes em `.skills/<nome>/SKILL.md` (ex.: `impeccable`, `emil-kowalski`, `react-next-practices`, `frontend`, `ui-ux-pro-max`, `anti-ai-slop`, `tdd`, `software-architect`), **leia o arquivo `SKILL.md` com `read_file`** e aplique seus padrões no código escrito.
- **Ambiente Antigravity Standalone (Zero Maestri)**: Este workspace roda no `agy` puro sem terminais auxiliares do Maestri. É terminantemente **PROIBIDO** ler, ativar ou chamar qualquer skill `maestri-*` (`maestri`, `maestri-manager`, `maestri-chat`, `maestri-portal`, `maestri-routines`, `maestri-workspace`).
- **Subagentes Nativos com Escrita**: Se usar `define_subagent` + `invoke_subagent` para tarefas paralelas independentes, passe sempre `EnableWriteTools: true`.
- **Regras essenciais**: ver `.agents/rules/izanagi-core.md`.

---
Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
