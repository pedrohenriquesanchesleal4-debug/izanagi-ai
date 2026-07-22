# Skill: Model Context Protocol (MCP) Server Development

**Versão:** 1.0.0  
**Domínio:** Integrations & Protocols  
**Budget de Tokens:** ~2500  

---

## Contexto & Objetivo
Esta skill orienta a criação de servidores compatíveis com a especificação Model Context Protocol (MCP) da Anthropic/open standards. Permite expor ferramentas (Tools), recursos (Resources) e prompts customizados para assistentes de IA.

---

## Estrutura Padrão de Servidor MCP
- **Tools**: Funções executáveis declaradas com schemas JSON Schema estritos.
- **Resources**: Dados contextuais expostos via URIs (`file:///`, `custom://`).
- **Prompts**: Modelos reutilizáveis de instrução pré-configurados.

---

## Workflow de Desenvolvimento
1. Definir o escopo de ferramentas e parâmetros de entrada com validação Zod/JSON Schema.
2. Tratar erros com mensagens claras sem derrubar o processo STDIO ou HTTP SSE.
3. Garantir sanitização de entradas para evitar Injeção de Comandos ou Directory Traversal.
4. Implementar suporte a transporte STDIO e SSE.

---

## Checklist de Qualidade
- [ ] Ferramentas possuem descrições claras e detalhadas para o LLM.
- [ ] Esquemas de entrada validam todos os parâmetros obrigatórios e opcionais.
- [ ] Erros retornam estrutura `{ isError: true, content: [...] }`.
- [ ] Sanitização aplicada em todos os argumentos de sistema de arquivos ou comandos.
