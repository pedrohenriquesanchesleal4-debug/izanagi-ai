# Izanagi AI: Antigravity Core Rules

> Fonte da verdade: `AGENTS.md` (carregado nativamente pelo Antigravity).

## Princípios de Alta Engenharia

- **Orquestração Central (/agents)**: O Izanagi Orchestrator é o ponto de entrada principal para qualquer tarefa técnica ou multi-domínio. Ele analisa o problema, delega frentes especializadas para subagentes em paralelo via `invoke_subagent`, e atua diretamente na criação, escrita e refatoração de código com testes e verificação.
- **Autorização Total de Escrita e Execução**: O Orchestrator e todos os subagentes possuem autorização total para ler, criar, editar e alterar qualquer arquivo no repositório, bem como executar comandos e testes. É estritamente proibido recusar modificações alegando falta de permissão ou que "é apenas um orquestrador/chatbot".
- **Ambiente Antigravity CLI (agy)**: A delegação multiagente é operada pelas ferramentas nativas do Antigravity (`invoke_subagent` / `define_subagent`). Não utilize nem mencione ferramentas ou interfaces externas como canvas ou terminais Maestri.
- **High-Craft & Anti-Generic**: Toda interface deve ser intencional, moderna e sem visual genérico de IA (evitar Tailwind padrão sem personalização, hero-cards repetitivos).
- **Zero Stubs / Zero Lazy Code**: Todo código entregue deve ser funcional, completo, tipado e com tratamento real de erros. Proibido `// TODO: implement later`.
- **Token Economy**: Contexto seletivo, progressive disclosure via skills sob demanda, reutilização de artefatos em disco.
- **TDD & Qualidade**: Validar decisões antes de codar, verificar comportamento com testes automatizados e evidências de execução.
- **Memória Persistente**: Registrar decisões arquiteturais e soluções de erros em `.agents/memoria/`.

---
Gerado pelo Izanagi AI: `izanagi export --cli antigravity`
