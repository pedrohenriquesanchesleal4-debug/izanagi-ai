# Deep Research — Referências

Curadoria de agentes e padrões de pesquisa profunda.

## Fontes principais

- **OpenAI Deep Research** — https://chatgpt.com/deep-research (agente de pesquisa multi-etapas da OpenAI)
- **dzhng/deep-research** — https://github.com/dzhng/deep-research (open-source, MIT; inspirado no agente da OpenAI; plano → queries paralelas → síntese)
- **langchain-ai/open_deep_research** — https://github.com/langchain-ai/open_deep_research (versão LangGraph; pesquisa com feedback do usuário entre iterações)
- **ComposioHQ/awesome-claude-skills** — https://github.com/ComposioHQ/awesome-claude-skills (índice curado com categoria Research; referência de skills de pesquisa)

## Padrões essenciais

1. **Plan-first**: montar lista de queries por ângulo antes de executar.
2. **Multi-fonte**: primárias > secundárias; verificar data em informação volátil.
3. **Síntese com citação**: toda afirmação ligada a URL; distinção fato/opinião/inferência.
4. **Confiança explícita**: ALTA/MÉDIA/BAIXA com justificativa — nunca relatório sem qualificação.

## Arquitetura multi-agente (Anthropic, 2026)

- **Fonte**: [anthropic.com/engineering/multi-agent-research-system](https://www.anthropic.com/engineering/multi-agent-research-system) — "How we built our multi-agent research system" (base do recurso Claude Research).
- **Padrão**: orchestrator-worker — um agente líder ("Lead Researcher") decompõe a pergunta, cria subagentes com mandatos de pesquisa específicos; cada subagente tem contexto/ferramentas/trajetória próprios e roda em paralelo.
- **Resultado interno da Anthropic**: Opus 4 como líder + Sonnet 4 como subagentes superou setup de agente único em >90% nas avaliações internas — ganho correlacionado com uso de token e paralelização de contexto.
- **Custo**: sistemas multi-agente consomem ~15x mais tokens que chat padrão — só compensa quando o valor do resultado supera o custo. Aplicável ao Izanagi mesmo sem múltiplos agentes reais: decompor a pergunta em sub-investigações antes de sintetizar já captura boa parte do ganho.

## Avaliação de qualidade de relatórios de pesquisa (2026)

- **Deep-Research Eval** (mdpi.com/2076-3417/16/5/2546) — framework automatizado com 3 eixos: Information Recall, Analysis, Presentation; usa Paged-RAG contra base de referência para verificar fatos.
- **DeepResearch Bench II** (arxiv.org/abs/2601.08536, fev/2026) — diagnóstico de agentes de deep research; achado-chave: melhores sistemas atingem só ~65% de qualidade de citação e ~68% de precisão factual; quando 3-13% das URLs citadas são fabricadas, métricas de citação superestimam confiabilidade.
- Implicação prática: nunca tratar uma citação gerada por IA (própria ou de fonte terceira) como verificada sem abrir o link.

## Galerias de referências visuais (para Discovery)

- **Awwwards** — https://awwwards.com (sites premiados por nicho; SOTD, collections)
- **Godly** — https://godly.website (galeria por stack/efeito: GSAP, Three.js, WebGL, Lenis)
- **Land-book** — https://land-book.com (landing pages por categoria)
- **Lapa Ninja** — https://lapa.ninja (melhores landing pages por ano)
- **uiprompt** — https://uiprompt.app (UI cinematográficas geradas por prompt com vídeo-fonte)
- **Mobbin** — https://mobbin.com (biblioteca de UI de apps reais por fluxo)
- **Dribbble** — https://dribbble.com (moodboards de UI por tag)

## Benchmarking de código/stack

- **GitHub topics** — https://github.com/topics (ex.: `web-animation`, `nextjs-template`)
- **npm trends** — https://npmtrends.com (comparativo de downloads)
- **Bundlephobia** — https://bundlephobia.com (custo real de pacote em kB/gzip)