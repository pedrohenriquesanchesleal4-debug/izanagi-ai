# References — Context Engineering & Economia de Tokens

> Curadoria (2026) de referências canônicas para redução de consumo de tokens e engenharia de contexto em agentes de IA.

## Docs canônicas

- [Anthropic: Effective Context Engineering for AI Agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents) — paper fundacional sobre context engineering para agentes (set/2025)
- [Anthropic/Claude: Prompt Caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching) — documentação oficial de `cache_control`, breakpoints, TTL de 5min/1h e limites mínimos de prefixo cacheável
- [Anthropic: Writing Effective Tools for AI Agents](https://www.anthropic.com/engineering/writing-tools-for-agents) — paginação, range selection, filtering e truncation para respostas de tools que consomem muito contexto
- [OpenAI: Prompt Caching](https://platform.openai.com/docs/guides/prompt-caching) — documentação oficial de prefix caching automático
- [OpenAI Tokenizer](https://platform.openai.com/tokenizer) — visualize quantos tokens cada texto custa
- [Claude Code: Manage Claude's memory](https://docs.claude.com/en/docs/claude-code/memory) — guidelines oficiais para manter CLAUDE.md enxuto e eficiente

## Papers & Pesquisa

- [Lost in the Middle (Stanford, arxiv:2307.03172)](https://arxiv.org/abs/2307.03172) — paper seminal sobre degradação de atenção no meio do contexto
- [LLMLingua: Prompt Compression](https://github.com/microsoft/LLMLingua) — compressão de prompt sem perda semântica (Microsoft Research)
- [Mem0: Memory Layer for AI Agents](https://github.com/mem0ai/mem0) — memória persistente com extração single-pass para agentes

## Frameworks & Ferramentas

- [LangChain: Context Engineering](https://blog.langchain.dev/context-engineering/) — blog post sobre engenharia de contexto no LangChain
- [TokenCost (AgentOps-AI)](https://github.com/AgentOps-AI/tokencost) — biblioteca de custo por modelo/provider para benchmarking
- [GPTCache](https://github.com/zilliztech/GPTCache) — semantic caching para respostas de LLM (bypass do modelo em queries similares)
- [vLLM](https://github.com/vllm-project/vllm) — prefix caching automático para self-hosted inference

## Práticas de produção

- [Simon Willison: writing on LLMs](https://simonwillison.net/) — artigos práticos sobre custo e janelas de contexto
- [ClaudeLog: What Is Claude Code Auto-Compact](https://claudelog.com/faqs/what-is-claude-code-auto-compact/) — mecânica real de compactação automática (~95% da janela, o que sobrevive e o que é descartado)
- [Anthropic: Claude Code Best Practices](https://www.anthropic.com/engineering/claude-code-best-practices) — práticas de codificação agentic, incluindo gestão de contexto e sub-agentes
