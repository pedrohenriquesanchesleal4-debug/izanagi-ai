---
name: ai-agent
description: |
  Skill de AI/Agent Development para o Portal. Contém padrões de integração com LLMs,
  RAG, vector databases, LangGraph, MCP, multi-agent systems e prompt engineering.
  Use esta skill para implementar ou revisar funcionalidades baseadas em IA generativa.
---

# Skill AI/Agent Development — Portal

## Arquiteturas de IA

### RAG (Retrieval-Augmented Generation)
```
User Query → Embedding → Vector Search (similarity) → Context + Prompt → LLM Response
```

- **Embedding**: `text-embedding-3-small` / `text-embedding-ada-002`
- **Vector DB**: Supabase pgvector, Pinecone, Qdrant, Chroma
- **Chunking**: RecursiveCharacterTextSplitter (500-1000 tokens, 10% overlap)
- **Retrieval**: similarity search (cosine distance), hybrid search (keyword + vector)

### Agentes Autônomos
```
Tool 1 ─┐
Tool 2 ──┤  LLM (ReAct loop) → Action → Observation → Next Action
Tool 3 ─┘
```

- **Framework**: LangGraph (preferido), CrewAI, AutoGen, Vercel AI SDK
- **Pattern**: ReAct (Reasoning + Acting), Plan-and-Execute, Reflection
- **Memory**: BufferWindowMemory, SummarizeMemory, VectorStoreMemory

### MCP (Model Context Protocol)
```
Host (app) → MCP Client → MCP Server → Tool/Resource/Context
```

- Usar MCP para expor ferramentas internas ao LLM
- Cada MCP Server = 1 domínio (banco, API externa, sistema interno)

---

## Stack Recomendada (2026)

| Componente | Sugestão |
|------------|----------|
| LLM API | OpenAI GPT-4o, Claude 4, Gemini 2.0 |
| Vector DB | Supabase pgvector (preferido) |
| Agent Framework | LangGraph |
| AI SDK | Vercel AI SDK (`ai`) |
| Embeddings | `openai` ou `cohere` |
| MCP | `@modelcontextprotocol/sdk` |

---

## Prompt Engineering

### Estrutura de System Prompt
```
Role: [defina o papel do assistente]
Context: [contexto relevante]
Rules: [regras e constraints]
Tools: [ferramentas disponíveis]
Output Format: [formato esperado da resposta]
```

### Anti-Padrões
- ❌ Prompts genéricos sem contexto específico do projeto
- ❌ Instruções contraditórias (ex: "seja conciso" + "explique detalhadamente")
- ❌ Prompt injection sem sanitização de input do usuário
- ❌ Expor system prompt em respostas ao usuário

---

## Implementação no Projeto

### Vercel AI SDK
```tsx
import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  system: "Você é um assistente do Portal...",
  prompt: userQuery,
});
```

### RAG com Supabase pgvector
```tsx
const { data: documents } = await supabase.rpc("match_documents", {
  query_embedding: embedding,
  match_threshold: 0.78,
  match_count: 5,
});
```

---

## Segurança em IA

- **Guardrails**: validar output do LLM antes de exibir ao usuário
- **Rate limiting**: limitar chamadas por usuário/IP
- **Content filtering**: bloquear prompts maliciosos (injection, jailbreak)
- **Data privacy**: nunca enviar PII (CPF, RG) como contexto para o LLM
- **Audit logging**: logar todas as interações IA (anonimizadas)
