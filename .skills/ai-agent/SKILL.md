---
name: "ai-agent"
description: "Padrões de integração com LLMs, RAG, vector databases, LangGraph, MCP e multi-agent systems. Use ao implementar ou revisar funcionalidades baseadas em IA generativa. Gatilhos de ativação: skill ai/agent development — izanagi; arquiteturas de ia; stack recomendada (2026); prompt engineering."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill AI/Agent Development — izanagi

> Migrado deterministicamente de `skills/ai-agent/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Padrões de integração com LLMs, RAG, vector databases, LangGraph, MCP e multi-agent systems.
- **Ativar quando:** Use ao implementar ou revisar funcionalidades baseadas em IA generativa.
- **Escopo canônico:** Skill AI/Agent Development — izanagi
- **Seções do corpo original:** Arquiteturas de IA · Stack Recomendada (2026) · Prompt Engineering · Implementação no Projeto · Segurança em IA
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: RAG (Retrieval-Augmented Generation)

```
User Query → Embedding → Vector Search (similarity) → Context + Prompt → LLM Response
```

- **Embedding**: `text-embedding-3-small` / `text-embedding-ada-002`
- **Vector DB**: Supabase pgvector, Pinecone, Qdrant, Chroma
- **Chunking**: RecursiveCharacterTextSplitter (500-1000 tokens, 10% overlap)
- **Retrieval**: similarity search (cosine distance), hybrid search (keyword + vector)

### Passo 2 — Aplicar: Agentes Autônomos

```
Tool 1 ─┐
Tool 2 ──┤  LLM (ReAct loop) → Action → Observation → Next Action
Tool 3 ─┘
```

- **Framework**: LangGraph (preferido), CrewAI, AutoGen, Vercel AI SDK
- **Pattern**: ReAct (Reasoning + Acting), Plan-and-Execute, Reflection
- **Memory**: BufferWindowMemory, SummarizeMemory, VectorStoreMemory

### Passo 3 — Aplicar: MCP (Model Context Protocol)

```
Host (app) → MCP Client → MCP Server → Tool/Resource/Context
```

- Usar MCP para expor ferramentas internas ao LLM
- Cada MCP Server = 1 domínio (banco, API externa, sistema interno)

---

### Passo 4 — Aplicar: Stack Recomendada (2026)

| Componente | Sugestão |
|------------|----------|
| LLM API | OpenAI GPT-4o, Claude 4, Gemini 2.0 |
| Vector DB | Supabase pgvector (preferido) |
| Agent Framework | LangGraph |
| AI SDK | Vercel AI SDK (`ai`) |
| Embeddings | `openai` ou `cohere` |
| MCP | `@modelcontextprotocol/sdk` |

---

### Passo 5 — Aplicar: Estrutura de System Prompt

```
Role: [defina o papel do assistente]
Context: [contexto relevante]
Rules: [regras e constraints]
Tools: [ferramentas disponíveis]
Output Format: [formato esperado da resposta]
```

### Passo 6 — Aplicar: Anti-Padrões

- ❌ Prompts genéricos sem contexto específico do projeto
- ❌ Instruções contraditórias (ex: "seja conciso" + "explique detalhadamente")
- ❌ Prompt injection sem sanitização de input do usuário
- ❌ Expor system prompt em respostas ao usuário

---

### Passo 7 — Aplicar: Vercel AI SDK

```tsx
import { generateText, streamText } from "ai";
import { openai } from "@ai-sdk/openai";

const { text } = await generateText({
  model: openai("gpt-4o"),
  system: "Você é um assistente do Izanagi...",
  prompt: userQuery,
});
```

### Passo 8 — Aplicar: RAG com Supabase pgvector

```tsx
const { data: documents } = await supabase.rpc("match_documents", {
  query_embedding: embedding,
  match_threshold: 0.78,
  match_count: 5,
});
```

---

### Passo 9 — Aplicar: Segurança em IA

- **Guardrails**: validar output do LLM antes de exibir ao usuário
- **Rate limiting**: limitar chamadas por usuário/IP
- **Content filtering**: bloquear prompts maliciosos (injection, jailbreak)
- **Data privacy**: nunca enviar PII (CPF, RG) como contexto para o LLM
- **Audit logging**: logar todas as interações IA (anonimizadas)

### Passo 10 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:ai -->

- Avaliar o output contra critério/dataset definido antes da execução (não 'pareceu bom').
- Confirmar validação estrutural de todo output/tool call consumido pela skill.
- Verificar presença das salvaguardas: timeout, retry criterioso, budget e isolamento contra prompt injection.
- Registrar exemplos de entrada/saída e taxa de falha observada na amostra testada.

## Common Rationalizations

- **"Modelo moderno entende sozinho, prompt detalhado é desperdício."**
  - Verdade: Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.
- **"Resposta plausível, então tá correto."**
  - Verdade: Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.
- **"Embedding/recuperação ruim? Troco o modelo maior."**
  - Verdade: Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.
- **"Jogo tudo no contexto, janela hoje é gigante."**
  - Verdade: Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.
- **"Tool call retornou algo, sigo em frente."**
  - Verdade: Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.
- **"Prompt injection é teórico, meu caso é fechado."**
  - Verdade: Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.

## Red Flags

- Feature de LLM sem dataset/critério de avaliação (qualidade não medida).
- RAG respondendo sem citação/rastreabilidade da fonte recuperada.
- Tool/MCP exposto sem schema de entrada validado nem limite de escopo.
- Chamada de modelo sem timeout, retry criterioso ou budget de custo.
- Output do modelo parseado com confiança cega (sem validação estrutural).
- Instrução de sistema concatenada com input de usuário sem isolamento.
- Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.

## Legacy Reference (v1)

# Skill AI/Agent Development — izanagi

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
  system: "Você é um assistente do Izanagi...",
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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
