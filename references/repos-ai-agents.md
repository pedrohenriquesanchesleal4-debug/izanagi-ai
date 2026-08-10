# Referências — Repositórios & Fontes de Prompts/Componentes

Curadoria de repositórios GitHub, bancos de prompts e fontes de componentes de alta qualidade para o Discovery usar como vocabulário técnico-visual. URLs canônicas verificadas — **nunca invente URLs além destas**.

## Ecossistema de Skills & Frameworks (top GitHub 2026)

| Recurso | URL | O que extrair |
|---|---|---|
| obra/superpowers | https://github.com/obra/superpowers | 266K★ — maior framework de skills agentic (brainstorming, TDD, subagents, code review). Padrões canônicos: dispatching-parallel-agents, defense-in-depth, project-planner. Base conceitual das skills `parallel-agents` e `defense-in-depth` do Izanagi |
| addyosmani/agent-skills | https://github.com/addyosmani/agent-skills | 85K★ — production-grade engineering skills (repo analysis, web audits, coding). Estrutura com `.opencode/`, `skills/`, `AGENTS.md`, plugin.json — referência de organização |
| anthropics/skills | https://github.com/anthropics/skills | Skills oficiais da Anthropic (docs, PDF, PPTX) — padrão de documentação de skills enterprise |
| ComposioHQ/awesome-claude-skills | https://github.com/ComposioHQ/awesome-claude-skills | 1000+ Claude Skills curadas (índice awesome-claude-skills, 66K★) |
| VoltAgent/awesome-agent-skills | https://github.com/VoltAgent/awesome-agent-skills | 200+ skills curadas com foco em agente único agnóstico de CLI |
| alirezarezvani/claude-skills | https://github.com/alirezarezvani/claude-skills | 200+ skills cross-platform (Claude/Codex/Cursor) — mapas mentais e automação |
| sickn33/antigravity-awesome-skills | https://github.com/sickn33/antigravity-awesome-skills | 1200+ skills com bundler próprio |
| travisvn/awesome-claude-skills | https://github.com/travisvn/awesome-claude-skills | 14.5K★ — índice de skills Claude Code + listas por área |
| jeremylongshore/claude-code-plugins-plus-skills | https://github.com/jeremylongshore/claude-code-plugins-plus-skills | 471 plugins + 3069 skills + 347 agents — maior coleção agregada |
| Dicklesworthstone/claude_code_agent_farm | https://github.com/Dicklesworthstone/claude_code_agent_farm | 882★ — orquestração de 20+ agentes em paralelo com projetos descartáveis — base prática do padrão fan-out |
| yusufkaraaslan/Skill_Seekers | https://github.com/yusufkaraaslan/Skill_Seekers | 14.7K★ — converter documentação web em skills reutilizáveis |
| spences10/claude-skills-cli | https://github.com/spences10/claude-skills-cli | CLI para criar/gerenciar skills de forma padronizada |
| Zijian-Ni/awesome-ai-agents-2026 | https://github.com/Zijian-Ni/awesome-ai-agents-2026 | Lista curada 2026 de frameworks de agentes (LangGraph, CrewAI, AutoGen/AG2, MetaGPT, Swarms, OpenAI Swarm, ADK, A2A, MCP) |

## Bancos de Prompts & Workflows de IA

| Recurso | URL | O que extrair |
|---|---|---|
| grill-me (Matt Pocock) | https://github.com/mattpocock/skills (skills/productivity/grill-me) | Entrevista socrática implacável ("grill me") para afiar ideias/designs antes de implementar — base do estilo de entrevista do Discovery |
| Grill-me (engenharia) | https://github.com/TimothyVang/Grill-me | Skills para engenheiros: desafiar planos, arquitetura e código com perguntas duras |
| Humanizer (de-slop) | https://github.com/aihxp/humanizer | Remove marcas de texto gerado por IA (de-slop) — aplicável em copy, prompts ricos e docs para soar humano. Multi-CLI: Claude, Cursor, Codex, OpenCode, Copilot |
| WebsitesPrompts | https://github.com/openwarehq/websiteprompts | 30 prompts prontos de sites cinematográficos (cores, easing, z-index, vídeo de fundo hospedado) — copy-paste para scrollytelling premium |

## Componentes UI & Design Systems (copy-paste / CLI)

| Recurso | URL | O que extrair |
|---|---|---|
| shadcn/ui | https://ui.shadcn.com | Componentes copy-paste acessíveis (Radix + Tailwind) — base do estilo Izanagi |
| 21st.dev | https://21st.dev | Marketplace open-source de componentes shadcn/ui (hero sections, shaders, bento grids, AI chats) — instala via `npx shadcn add "https://21st.dev/r/<autor>/<componente>"` |
| Cult UI | https://www.cult-ui.com | Componentes premium para shadcn/ui (Dynamic Island, Pixel Heading, 3D Carousel) — Motion + Tailwind |
| Skiper UI | https://skiper-ui.com | "Un-common components" para shadcn/ui (106+): Spotlight, Typewriter, Bento Grid — instala via `npx shadcn add @skiper-ui/skiper40` |
| React Bits | https://reactbits.dev | 140+ componentes animados (backgrounds, text effects, animations) — Framer Motion + Tailwind, instala via shadcn/jsrepo |
| OriginKit | https://originkit.dev | Biblioteca grátis de componentes animados (interactive, gallery, text, background) para Framer/React — instala via MCP |
| Uiverse | https://uiverse.io | 4.4k+ elementos UI open-source em CSS/Tailwind — copiar e adaptar |
| Animista | https://animista.net | Gerador on-demand de animações CSS (keyframes prontos por categoria) |
| Phosphor Icons | https://phosphoricons.com | Família de ícones flexível (6 pesos, 2 estilos) — SVG + @phosphor-icons/react |

## Fontes de Inspiração em App Building & 3D

| Recurso | URL | O que extrair |
|---|---|---|
| 10x.app | https://www.10x.app | App builder AI (iOS/macOS SwiftUI) — inspiração de UX de ferramentas de geração de app |
| Three.js | https://threejs.org/examples | Exemplos canônicos 3D/WebGL (ver também references/webgl-3d.md) |

## Anti AI-Slop & Design de Alto Craft (2026)

| Recurso | URL | O que extrair |
|---|---|---|
| avoid-ai-design (funboy322) | https://github.com/funboy322/avoid-ai-design | Skill que audita frontend e reescreve removendo AI-slop (gradientes roxo, Inter, shadcn default). Base da skill `anti-ai-slop` do Izanagi; inclui catálogo `ai-tells-catalog.md` |
| Superdesign blog | https://superdesign.dev/blog/how-to-make-ai-ui-look-less-generic | 5 fixes para UI IA genérica: tipografia distinta, cor dominante + acento, layout assimétrico, motion proposital |
| 925studios — AI Slop Guide | https://www.925studios.co/blog/ai-slop-web-design-guide | Guia completo 2026: como identificar e corrigir sites genéricos; tipografia como sinal de marca |
| BSWEN — Anti-Patterns Guide | https://docs.bswen.com/blog/2026-03-20-ai-generated-ui-anti-patterns | Framework de penalidades/recompensas para avaliação de design (Anthropic): penalizar gradientes roxo, card grids, hero centralizado; recompensar composições inesperadas |
| Visily — Adopt/Avoid | https://www.visily.ai/blog/how-to-make-ai-designs-less-generic | Técnica adopt/avoid: listas explícitas de padrões a evitar em prompts de geração |
| Awwwards | https://www.awwwards.com | Galeria de sites premiados (SOTD) — vocabulário de layout/motion de elite |
| Muzli | https://muz.li | Feed de inspiração UI/UX atualizado (dark mode, dashboards, trends 2026) |

## Orquestração Multi-Agente (padrões de produção 2026)

| Recurso | URL | O que extrair |
|---|---|---|
| Fastio — Multi-Agent Patterns | https://fast.io/resources/multi-agent-orchestration-patterns | 4 padrões (Supervisor, Pipeline, Swarm, Hierarchical), quando usar cada um, coordenação por shared storage |
| AgentBrisk — Orchestration 2026 | https://agentbrisk.com/blog/multi-agent-orchestration-guide-2026/ | Por que single agent degrada; paralelização; isolamento de contexto por agente |
| Odea Works — Orchestration | https://odeaworks.com/blog/2026-04-05-llm-agent-orchestration-patterns/ | Fan-out paralelo, agregação (votação, weighted score, data fusion), custo vs qualidade |
| Anthropic — Building Effective Agents | https://www.anthropic.com/research/building-effective-agents | Padrão canônico: orchestrator delega a workers e sintetiza outputs |

## Otimização de Tokens & Context Engineering (2026)

| Recurso | URL | O que extrair |
|---|---|---|
| mem0 — Context Engineering | https://mem0.ai/blog/context-engineering-ai-agents-guide | Escrever seletivamente, comprimir, isolar por tipo de contexto |
| Redis — Context Window Management | https://redis.io/blog/context-window-management-llm-apps-developer-guide/ | Custo/latência vs tamanho de contexto; lost-in-the-middle (~32K tokens) |
| Fastio — Token Cost Optimization | https://fast.io/resources/ai-agent-token-cost-optimization | Prompt caching: estático primeiro, pesado no meio, dinâmico por último (cache hit) |
| Token Optimize — Strategies 2026 | https://www.tokenoptimize.dev/guides/llm-token-optimization-strategies | 7 estratégias: compressão, sliding window, model routing, caching, output constraints |
| AI University — Token Optimization | https://theaiuniversity.com/docs/cost-optimization/token-optimization | Redução de 70%: sliding window, o que sempre manter (system prompt, tarefa atual, últimos tool results) |
| Fastio — Orchestration Patterns | https://fast.io/resources/multi-agent-orchestration-patterns | 4 padrões de orquestração (ver seção acima) — base da composição `parallel_swarm` |
| opendatascience — Top 10 Frameworks | https://opendatascience.com/ai-agent-frameworks-top-10-list/ | Panorama 2026 dos frameworks de orquestração multi-agente e seus trade-offs |
| iterathon — LangGraph vs CrewAI vs AutoGen | https://iterathon.tech/ai-agent-guide-mastering-langgraph-crewai-and-autogen/ | Comparativo prático dos 3 frameworks dominantes — vocabulário de design de agentes |

## Como usar no Izanagi

- **Discovery (Fase 3 — pesquisa técnica)**: consultar `references/repos-ai-agents.md` para citar fontes de componentes reais no prompt rico (ex: "hero section no padrão 21st.dev + shaders; componentes de `shadcn add`; texto com easing do WebsitesPrompts").
- **Sempre-verificar**: URLs destes repositórios mudam nome de branch/estrutura — confirme via GitHub antes de citar path específico de arquivo (ex: `skills/productivity/grill-me` existe em `mattpocock/skills`).
- **Anti-colagem**: repositórios são vocabulário, nunca entregar colagem de componente pronto sem adaptar ao design system do projeto (padrão RULES.md anti-genérico).
- **grill-me & Humanizer**: aplicar como método — entrevista dura antes de implementar (Discovery) e revisão de tom em prompts ricos/copy (nunca copiar o prompt inteiro, adaptar ao contexto do projeto).
