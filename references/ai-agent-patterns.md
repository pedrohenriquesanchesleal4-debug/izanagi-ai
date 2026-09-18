# Referências — AI Agent Patterns & Features de IA em Produto (2026)

Curadoria para o agente `ai-engineer` e para qualquer feature que orquestra/avalia LLM (RAG, tool-calling, agentes). URLs canônicas — **nunca invente URLs além destas**.

| Recurso | URL | O que extrair |
|---|---|---|
| Anthropic · Building Effective Agents | https://www.anthropic.com/engineering/building-effective-agents | Ensaio canônico: workflows vs agents, 5 padrões (prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer), ACI/tool design — vocabulário-base de arquitetura |
| Claude Platform docs | https://docs.claude.com | Tool use, agent patterns, structured outputs, prompt caching, guardrails — canônica para features de IA em produto |
| OpenAI Agents SDK | https://openai.github.io/openai-agents-python/ | SDK oficial Python: agents com tools, handoffs, guardrails, sessions, human-in-the-loop, MCP, tracing |
| LangGraph docs | https://docs.langchain.com/oss/python/langgraph/ | Runtime de orquestração low-level: StateGraph, durable execution, streaming, HITL, memória; mistura passos determinísticos e agentic no mesmo grafo |
| LlamaIndex | https://docs.llamaindex.ai/ | RAG e agents (context augmentation): ingestion/indexing, query engines, workflows event-driven, multi-agent patterns, MCP |
| Vercel AI SDK | https://ai-sdk.dev/ | SDK universal TS (React/Next.js/Node): generateText/streamText, tool calling, fallbacks multi-provider, AI Gateway — padrão para features de IA em produto web |

## Como usar no Izanagi

- **Before coding AI feature**: sempre consultar a cadeia da skill `ai-agent` (composição `ai_ml_feature` em `core/skill-resolver.json`): arquitetura de agente primeiro, LLM integrado por último.
- **RAG**: pipeline canônico = ingestão (LlamaIndex) → retrieval com embeddings → geração com guardrails (Claude docs / Vercel AI SDK) — Documentado em `ai_ml_feature`.
- **Anti-alucinação**: toda feature de IA precisa de structured outputs + ferramenta de avaliação; ver skill `hallucination-detection` ao revisar código gerado.
- **Orquestração**: o próprio Izanagi implementa o padrão orchestrator-workers e evaluator-optimizer (ver `src/runtime/orchestrator.ts` + gate `orchestrator-review`) — usar como referência de implementação real.