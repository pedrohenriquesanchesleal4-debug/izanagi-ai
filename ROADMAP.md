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
- [x] **Plugin System (base)** — trust tiers (builtin/generated/community) no Skill Scanner com bloqueio escalonado + Policy Engine para permissão contextual; ainda falta sandbox de execução isolada para skills de terceiros 🔧
- [ ] **Skill Marketplace** — compartilhar e instalar skills 📋
- [ ] **Izanagi API** — interface REST para interrogção do framework 💡
- [ ] **Web UI** — editor visual de skills e monitor de execuções 📋
- [ ] **Analytics Dashboard** — token usage, custo e evolução por execução 📋

## Fase 5 — Runtime de Produção v2.11 ✅

Auditoria completa do framework + consolidação arquitetural (unificação de caminhos de execução, eliminação de duplicações) + as primitives que faltavam para o runtime ser "production-grade" pelos critérios de mercado 2026 (checkpoint/resume, observabilidade de decisão, rastreabilidade de artefato, human-in-the-loop real).

- [x] **`izanagi run` unificado** — Adaptive Runtime (graph + routing + evaluation + trace + healing + memória) é o único caminho de execução, por padrão; eliminado o modo estático paralelo que só imprimia um plano sem executar. `--prompt-only` preserva a geração de prompt para colar em outra ferramenta.
- [x] **Safe Expression Evaluator** (`src/runtime/orchestration/safe-eval.ts`) — substitui `new Function()`/eval sobre `GraphNode.condition` e `BenchmarkValidator.check`, que podiam vir de dados de terceiros (benchmarks externos).
- [x] **Model Router com histórico e extensibilidade real** — `historicalPerformance` (antes um campo morto) agora é preenchido via `MemoryStore.recordModelRun`; `IZANAGI_MODEL` (override manual) e `.izanagi/izanagi.config.json → models` (catálogo por projeto) implementados.
- [x] **Policy Engine** (`src/runtime/security/policy.ts`) — permissão CONTEXTUAL (ambiente dev/ci/produção, trust tier), distinta do Security Scanner (detecção de conteúdo perigoso). Wired em `ToolRegistry`.
- [x] **Trust tiers no Skill Scanner** — builtin/generated/community com bloqueio escalonado por origem.
- [x] **Checkpoint/Resume real** (`src/runtime/recovery/checkpoint.ts`) — progresso salvo a cada rodada de batches; `izanagi resume <run-id>` continua sem replanejar nem reexecutar nós concluídos, restaurando budget/artefatos/modelo.
- [x] **Decision Journal** (`src/runtime/memory/decisions.ts`) — decisão + alternativas realmente consideradas + razão + confiança, para model-routing e agent-routing.
- [x] **Artifact Registry** (`src/runtime/artifacts/registry.ts`) — artefatos rastreáveis (produtor, hash, dependências, versão em retry/replan).
- [x] **Human-in-the-loop real** — `GraphNode.kind: 'approval'` pausa a execução (não é falha) até `izanagi approve`/`izanagi reject`, retomando via checkpoint.
- [x] **CLI**: `izanagi resume`, `izanagi approve`, `izanagi reject`, `izanagi explain`.
- [x] **Skill Lifecycle** — `discovered → draft → validated → active → deprecated → archived`; skills geradas pela Factory nascem `draft` (nunca "Generate → Automatically trust").
- [x] **`doctor`/`diagnose` sem duplicação** — checks compartilhados (`src/cli/checks.ts`) computados uma vez, cada comando decide o que exibir.
- [x] **Confirmado**: as 102 skills em `skills/*/SKILL.md` são 100% compliant com o padrão aberto agentskills.io (frontmatter `name`+`description`) — portáveis para ~40 ferramentas de mercado (Cursor, Copilot, Codex, VS Code...) sem modificação.
- [ ] **Consolidação dos packs de skills legados** (`architecture/`, `coding/`, `security/`... vs. `skills/`) — depreciação com apontamento para o equivalente novo, em andamento 🔧

---

## Critérios de aceite das próximas fases

Toda mudança no framework deve provar impacto em pelo menos uma dimensão:

```
reliability · adaptability · correctness · observability
token waste reduction · recovery · extensibility · developer experience
```

E deve passar o quality bar completo: `build` → `test` → `doctor --deep` → `benchmark run` → documentação.