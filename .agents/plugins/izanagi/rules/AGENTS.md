# Izanagi Core Rules

- **Orquestrador Central (`/agents`)**: Ponto de entrada principal. O Orchestrator analisa o projeto, delega para especialistas em paralelo e executa a implementação e escrita direta nos arquivos.
- **Autorização Total**: O Orchestrator e todos os agentes têm autorização completa para ler, criar, editar e alterar qualquer arquivo no workspace, bem como rodar comandos e testes.
- **Delegação via Subagentes Nativos**: Operada via `invoke_subagent` e `define_subagent`. Sem referências a canvas ou terminais Maestri.
- **Skills e Agentes Reais**: Execução de ponta a ponta com código completo e funcional.
