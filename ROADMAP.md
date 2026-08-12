# Roadmap

> Estado atual e evolução planejada do **Izanagi AI — Adaptive Agent & Skill Runtime**.
> Legenda: ✅ Done · 🔧 In progress · 📋 Planned · 💡 Future idea

---

## Fase 1 — Foundation (v1.x) ✅

- [x] SYSTEM.md / RULES.md / README / AGENTS.md — identidade e operação
- [x] Decision Engine — classificação e roteamento de tarefas
- [x] Context Engine + Compression Engine — contexto enxuto e compactação
- [x] Token Manager — orçamento e monitoramento
- [x] Reflection Engine + Evolution Engine — autoavaliação pós-tarefa
- [x] Quality Gates — portões de validação de output
- [x] Planning Engine — decomposição e estimativa
- [x] Memory Manager — memória persistente 3 níveis + knowledge graph

## Fase 2 — Engine Layer (v2.0 → v2.8) ✅

- [x] 15 → 18 agentes especializados, cada um com chains compostas
- [x] Biblioteca de skills modulares (212) + Skill Composer
- [x] CLI executável publicado no npm (`izanagi-ai`) com `izanagi init/run/compile/chat/doctor`
- [x] Packs selecionáveis + export multi-CLI (claude, codex, cursor, copilot, kimi)
- [x] Multi-Agent Swarm Mode (execução paralela concorrente)
- [x] Memória persistente `.agents/memoria/` (contexto, decisões, erros, aprendizados)
- [x] Referências curadas por domínio (`references/`)
- [x] Blueprint Engine — gate de manifest de arquivos, zero stubs
- [x] Anti-AI-Slop, design-directions (Style Selector) e ui-ux-pro-max (BM25 offline)

## Fase 3 — Adaptive Runtime (v2.9 → v2.10) ✅

- [x] **Evaluation Engine** (`core/evaluation/` → `src/runtime/evaluation/`) — vereditos PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED / UNKNOWN, métricas ponderadas (correctness, security, architecture, performance, maintainability, artifact validity), confiança e regressões
- [x] **Execution Graph** (`src/runtime/orchestration/`) — grafo por tarefa com nós, dependências, condições, retry policy, timeout, token budget e validador; batches paralelos detectados; templates por categoria sem grafo gigante universal
- [x] **Adaptive Routing / Scoring** (`src/runtime/routing/`) — ranking de agentes e skills por relevância semântica + histórico + compatibilidade + custo + risco
- [x] **Agent Genome** — 13 campos formais nos 21 agentes (purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility)
- [x] **Skill Manifest** — frontmatter padronizado nas skills (name, version, triggers, dependencies, risk, tokenBudget...) + `izanagi skill inspect/search`
- [x] **Agent Factory & Skill Factory** (`src/runtime/factories/`) — geração de agentes e skills por lacuna real, com validação antes do registro
- [x] **Failure Memory** (`src/runtime/memory/`) — 7 categorias (episodic, semantic, procedural, decision, failure, skill, project); padrões de falha reutilizáveis buscados antes da execução
- [x] **Self-Healing** (`src/runtime/recovery/`) — classificação de falha (recoverable/non-recoverable/planning/tool/agent/validation/dependency) → local repair | replan | handoff | skill replacement | abort; limites maxAttempts/maxTokens/maxTime
- [x] **Contracts & Artifacts** (`src/runtime/contracts/`) — schemas programáticos (requirements, architecture, database-schema, api-contract, security-report, test-plan, implementation-plan, evaluation) com validação INVALID → REPAIR → RE-EVALUATE
- [x] **Adversarial Critic** — 18º/19º agente: caça bugs, segurança, architecture flaws, AI slop
- [x] **Model Router** (`src/runtime/model/`) — ModelProvider / ModelAdapter / ModelRouter por complexidade, risco, custo, latência e contexto
- [x] **Tracing / Observability** (`src/runtime/observability/`) — spans por decisão/agente/skill/tool/model + `izanagi trace` e `izanagi trace <run-id>`
- [x] **Tools Registry (MCP-ready)** (`src/runtime/tools/`) — discover → permission → compatibility → select → execute → validate, least privilege, path traversal bloqueado
- [x] **Skill Security Scanner** (`src/runtime/security/`) — prompt injection, instruções perigosas, scripts, permissões, requisitos de rede/fs; LOW/MEDIUM/HIGH/CRITICAL
- [x] **Benchmarks** (`benchmarks/` + `src/runtime/benchmarks/`) — 10 domínios, validators, expectativas de artefatos, `izanagi benchmark run/list/compare` com relatório comparável entre versões
- [x] **CLI runtime** — `izanagi agent list|inspect`, `skill list|search|inspect|create`, `workflow list|inspect`, `run`, `trace`, `eval`, `benchmark`, `memory inspect|search`, `doctor --deep`, `diagnose`
- [x] **Docotr expandido** — valida system/agents/skills/resolver/memória/providers/tools/contratos/avaliação/benchmarks
- [x] Testes node:test cobrindo resolver, scoring, contracts, evaluation, graph, parallel, retry, healing, memory, handoff, factories, model routing, CLI, tracer, scanner, tools, benchmarks, orchestrator

## Fase 4 — Evolução v2.11 (🔧 / 📋)

- [x] **Evidence System** (`src/runtime/research/`) — claims FACT / ASSUMPTION / INFERENCE / UNKNOWN com source, confidence, sourceType hierarquizado (official docs > source code > tests > package metadata > reliable tech > community) e relatório de claims críticas
- [x] **Token Budget 2.0** (`src/runtime/token/`) — orçamento por fase (planning / execution / evaluation / recovery) com tetos e abort de fase; distribuído automaticamente por complexidade e tier de modelo
- [x] **Product Reasoner** — Understanding: intenção vaga → requisitos com evidências e critérios BDD (entrada do ciclo)
- [x] **Agent Architect** — projeto de novos agentes (Genome + guardrails + avaliação) por lacuna real
- [x] **Skill Architect** — curadoria de skills com security scan e anti-duplicação por lacuna comprovada
- [x] **Benchmarks externos** — `benchmarks/*.json` carregados pelo registry sem duplicar IDs embutidos
- [ ] **Plugin System** — skills de terceiros com sandbox e cadeia de confiança (usa o security scanner como porta de entrada) 📋
- [ ] **Skill Marketplace** — compartilhar e instalar skills 📋
- [ ] **Izanagi API** — interface REST para interrogção do framework 💡
- [ ] **Web UI** — editor visual de skills e monitor de execuções 📋
- [ ] **Analytics Dashboard** — token usage, custo e evolução por execução 📋

---

## Critérios de aceite das próximas fases

Toda mudança no framework deve provar impacto em pelo menos uma dimensão:

```
reliability · adaptability · correctness · observability
token waste reduction · recovery · extensibility · developer experience
```

E deve passar o quality bar completo: `build` → `test` → `doctor --deep` → `benchmark run` → documentação.