# Izanagi AI: Antigravity Core Rules

> Fonte da verdade: `AGENTS.md` (carregado nativamente pelo Antigravity).

## Princípios de Alta Engenharia

- **Orquestração e Execução Direta (/agents)**: O Izanagi Orchestrator é o ponto de entrada principal. Na IDE com Antigravity (`agy`) standalone, o Orchestrator **DEVE executar o trabalho e escrever o código diretamente na sessão principal** usando `read_file`, `write_file`, `edit_file` e `run_command`. NUNCA fique parado ou travado esperando uma fila sequencial de subagentes em background.
- **Autorização Total de Escrita e Execução na IDE**: O Orchestrator e todos os agentes possuem autorização irrestrita para ler, criar, editar e alterar qualquer arquivo no repositório (`write_file`, `edit_file`), bem como executar comandos e testes (`run_command`). É estritamente proibido agir como um chatbot passivo que só responde texto no chat sem modificar os arquivos reais.
- **Bloqueio Total do Maestri (Zero Maestri)**: Este ambiente roda no Antigravity CLI (`agy`) puro, SEM Maestri e SEM terminais auxiliares. É terminantemente **PROIBIDO** ler, ativar ou chamar qualquer skill da família `maestri` (`maestri`, `maestri-manager`, `maestri-chat`, `maestri-portal`, `maestri-routines`, `maestri-workspace`).
- **Delegação com Permissão de Escrita (`EnableWriteTools: true`)**: Use `invoke_subagent` apenas para frentes genuinamente paralelas. Sempre que definir um subagente via `define_subagent`, passe obrigatoriamente `EnableWriteTools: true` para que ele possa criar/editar arquivos na IDE.
- **Ativação Real e Obrigatória de Skills por Demanda**: As skills em `.skills/<nome>/SKILL.md` e `skills/<nome>/SKILL.md` não são decorativas. Antes de implementar qualquer código, você **DEVE usar `read_file` para ler o `SKILL.md` das skills pertinentes à demanda do usuário** (ex.: `impeccable`, `emil-kowalski`, `react-next-practices`, `frontend`, `ui-ux-pro-max`, `anti-ai-slop` para frontend; `software-architect`, `tdd`, `security-privacy` para backend) e aplicar suas regras e checklists no código.
- **High-Craft & Anti-Generic**: Toda interface deve ser intencional, moderna e sem visual genérico de IA (aplicar `impeccable`, `emil-kowalski` e `anti-ai-slop`).
- **Zero Stubs / Zero Lazy Code**: Todo código entregue deve ser funcional, completo, tipado e com tratamento real de erros. Proibido `// TODO: implement later`.
- **Token Economy**: Contexto seletivo, progressive disclosure lendo apenas as skills do domínio da tarefa atual.
- **TDD & Qualidade**: Validar comportamento com build e testes automatizados (`run_command`) e evidências reais de execução.
- **Memória Persistente**: Registrar decisões arquiteturais e soluções de erros em `.agents/memoria/`.

---
Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
