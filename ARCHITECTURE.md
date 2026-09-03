# Izanagi AI — Target Architecture

> Version: 3.10.0
> Status: Legacy runtime implemented; polyglot topology growing alongside it (Strangler Fig, ADR-001)
> Source of Truth: This document drives implementation · Canonical polyglot IPC contracts & ADRs: docs/POLYGLOT.md

---

## Architectural Vision

```
                    IZANAGI RUNTIME
                           |
             +-------------+-------------+
             |                           |
          PLANNER                     ROUTER
             |                           |
             +-------------+-------------+
                           |
                    EXECUTION GRAPH
                           |
             +-------------+-------------+
             |             |             |
          AGENTS        SKILLS         TOOLS
             |             |             |
             +-------------+-------------+
                           |
                       ARTIFACTS
                           |
                      EVALUATION
                           |
                  +--------+--------+
                  |                 |
                 PASS              FAIL
                  |                 |
                  ↓                 ↓
               MEMORY         SELF-HEALING
                  |                 |
                  +--------+--------+
                           |
                       HISTORY
                           |
                       LEARNING
                           |
                         ROUTER
```

**Closed-Loop Intelligence**: EXECUTION → OBSERVATION → EVALUATION → MEMORY → HISTORY → LEARNING → ROUTING → BETTER EXECUTION

---

## Module Structure (estado real do repositório)

```
src/
├── sdk.ts                           # izanagi.run() / izanagi.plan() (SDK programático)
└── runtime/
    ├── types.ts                     # Fonte única de tipos do runtime
    ├── orchestrator.ts              # Executor do grafo: papéis, verificação, healing, trace
    ├── execute.ts                   # Wiring compartilhado CLI ↔ SDK (plano, roteamento, producer)
    ├── contracts/
    │   ├── artifacts.ts             # Schemas de artefato + validateArtifact
    │   └── task-contract.ts         # Task Contract, modos de execução, papéis, critérios de aceite
    ├── orchestration/
    │   ├── commander.ts             # LEVEL 0: classifica, escolhe o modo, gera contratos, estima custo, replaneja
    │   ├── domains.ts               # Detecção bilíngue de domínio (fonte única)
    │   ├── planner.ts               # Templates de workflow por categoria
    │   ├── graph.ts                 # ExecutionGraph + Kahn + batches paralelos
    │   ├── concurrency.ts           # Pool com teto: ordem preservada, falha isolada
    │   ├── subgraph.ts              # Decomposição em EXECUÇÃO: orçamento do pai dividido, teto de largura
    │   ├── grounding.ts             # Nó `survey` na cabeça do grafo (lê o projeto antes de decidir)
    │   ├── delivery.ts              # Nó `deliver` no fim (grava a entrega, e a verificação confere)
    │   ├── context-resolver.ts      # Contexto mínimo por tarefa (insumos resumidos + referência)
    │   └── safe-eval.ts             # Avaliação de condição sem executar código arbitrário
    ├── registry/
    │   └── capabilities.ts          # Agent Capability Registry (quem sabe fazer isso?)
    ├── protocol/
    │   ├── messages.ts              # AgentMessage + crítica estruturada + correção mínima
    │   └── conversation.ts          # ConversationLog A2A: referência de artefato, nunca cópia de conteúdo
    ├── verification/
    │   ├── engine.ts                # Verification Engine 2.0: determinística, evidência, semântica
    │   └── judge.ts                 # Juiz semântico (papel worker); ilegível vira `inconclusive`, nunca reprovação
    ├── token/
    │   ├── budget.ts                # PhaseTokenBudget (tokens por fase)
    │   └── execution-budget.ts      # Budget Controller: custo, tetos, escada de degradação
    ├── cache/
    │   └── response-cache.ts        # Cache local determinístico de respostas (opt-in)
    ├── model/
    │   └── router.ts                # Catálogo, routeForRole por tier, escalada, custo em USD
    ├── llm/
    │   ├── client.ts                # 7 adapters (OpenAI-compatible, Anthropic, Google, locais)
    │   ├── prompt-cache.ts          # CAPC: prefixo estático cacheável
    │   └── session-diet.ts          # AgentDiet: observation masking determinístico
    ├── routing/                     # SkillResolver + CandidateScorer
    ├── evaluation/engine.ts         # EvaluationEngine (verdict ponderado)
    ├── artifacts/registry.ts        # Índice de artefatos: proveniência, versão, lineage, regressão
    ├── memory/                      # MemoryStore + DecisionJournal
    ├── recovery/                    # Healer + CheckpointStore + ApprovalStore
    ├── observability/               # Tracer + TraceStore + EventBus
    ├── security/                    # SkillScanner + PolicyEngine
    ├── tools/
    │   ├── registry.ts              # ToolRegistry (least privilege, policy no caminho, MCP-ready)
    │   ├── input-refs.ts            # Marcadores $artifact/$deliverable; code.execute recusa marcador
    │   ├── project-survey.ts        # Varredura determinística do projeto, com corte declarado
    │   └── code-sandbox.ts          # Processo isolado com Permission Model do Node (rede NÃO isolada)
    ├── notify/webhook.ts            # Fim de run para agendador: metadado, nunca conteúdo de artefato
    ├── evolution/
    │   ├── learning.ts              # LearningEngine
    │   └── trajectories.ts          # Trajetória recorrente (3 execuções verificadas) vira skill
    ├── research/evidence.ts         # EvidenceRegistry
    ├── factories/                   # AgentFactory + SkillFactory
    └── benchmarks/
        ├── registry.ts · runner.ts · definitions.ts   # Suíte de casos
        ├── arena.ts                 # Métricas de EXECUÇÃO real (verificação, recuperação, custo)
        ├── memory-benchmark.ts      # Busca e compressão, com limiar declarado no código
        └── token-benchmark.ts       # Legado vs Commander: chamadas, tokens, custo (mede PLANO)
```

### Fluxo de um run

```
                              USER
                                │
                                ▼
                      ┌───────────────────┐
                      │     COMMANDER     │  classifica (complexidade + domínios)
                      │  direct/assisted/ │  escolhe o modo
                      │ orchestrated/auto │  gera Task Contracts + critérios de aceite
                      └─────────┬─────────┘  estima custo e degrada se estourar o teto
                                │
                                ▼
                      ┌───────────────────┐
                      │   MODEL ROUTER    │  tier por PAPEL (commander/specialist/worker)
                      └─────────┬─────────┘
                                │
                                ▼
                      ┌───────────────────┐
                      │    TASK GRAPH     │  Kahn + batches paralelos
                      └─────────┬─────────┘
                                │
                     [survey]  nó de tool · fs:read · 0 token
                     lê o projeto de verdade antes de qualquer decisão
                                │
                 ┌──────────────┼──────────────┐
                 ▼              ▼              ▼
             Specialist     Specialist       Worker
                 │              │              │
                 └──────────────┼──────────────┘
                                ▼
                   CONTEXT RESOLVER (insumos resumidos, por referência)
                                ▼
                        ARTIFACT REGISTRY
                                ▼
                   VERIFICATION ENGINE 2.0
                     │           │          │
                 VERIFIED    UNVERIFIED   FAILED
                     │           │          │
                     ▼           ▼          ▼
                     │       reporta    DIAGNOSE → HEAL → REPLAN ──┐
                     │         como                                │
                     │     inconclusivo                            │
                     │                                             └──► TASK GRAPH
                     ▼
                 [deliver]  nó de tool · fs:write · 0 token
                 grava a entrega, e a verificação confere o arquivo escrito
                     │
                     ▼
                   DONE   (early stop dispensa tarefa opcional já desnecessária)

Ao redor: Budget Controller (custo/tempo/chamadas + degradação) · Response Cache ·
Memory · Decision Journal · Policy Engine · Tracer/EventBus · Telemetria de economia

Menor privilégio: `survey` e `deliver` são os ÚNICOS nós com permissão. Nenhum nó
de agente lê arquivo, escreve arquivo ou executa comando.
```

---

## Polyglot Topology (ADR-001: Strangler Fig)

The `src/runtime` tree above is the legacy npm runtime (CLI `izanagi`, the published package). New growth lives in a polyglot layer beside it, never inside it. Canonical reference for IPC contracts, error codes (`-32001..-32005`), environment variables and the full ADR index: **[`docs/POLYGLOT.md`](docs/POLYGLOT.md)**.

| Component | Language | Responsibility |
|-----------|----------|----------------|
| `crates/izanagi_core` | Rust | Quality engine: 7 anti-slop heuristics over TS/Python/Go; NDJSON stdin/stdout protocol (`validate`/`rules`/`version`, `scan-rationalizations`); WASM bindings feature-gated |
| `crates/izanagi_mcp` | Rust | MCP client (JSON-RPC 2.0 over stdio): discovery + point invocation |
| `go-services/swarm_orchestrator` | Go | Swarm orchestrator (Uber Fx): architect→engineer→qa→security pipeline via JSON-RPC 2.0 over UDS with event push |
| `python-engine/ast_analyzer` | Python ≥3.10 | Multilingual semantic AST analysis: symbols, cyclomatic complexity, imports (tree-sitter + structural fallback) |
| `packages/sdk` | TypeScript | `@izanagi/sdk`: typed clients for the 4 native cores + skill catalog (zero runtime deps) |
| `packages/cli` | TypeScript | `izanagi-next`: 4-phase run with auto-heal (N=2) and anti-rationalization gate |
| `packages/skill-migrator` · `agent-migrator` | Node ESM | Deterministic idempotent migrations: skills v1→v2 and agents JSON→YAML |

Derived artifacts are generated, never hand-edited: skills catalog v2 in `.skills/<name>/SKILL.md` (106 modules) comes from the legacy `skills/` via `skill-migrator`; agent YAMLs in `.agents/agents/*.yaml` come from `agents/*.json` via `agent-migrator`.

---

## Key Primitives

### 1. Execution Graph (EXISTS → ENHANCE)
- Nodes with: id, kind, agent/skills, inputs/outputs, dependencies, conditions, retryPolicy, timeout, tokenBudget, validator
- Topological order + parallelBatches (Kahn's algorithm)
- Conditional branches, retries, timeouts, failure propagation
- Replan capability after failures

### 2. Adaptive Router (DONE: routeForRole por papel + escalada + custo em USD)
- Candidate scoring: relevance + historicalSuccess + compatibility + risk + cost + latency
- Routing history persisted → influences future decisions
- Model routing: provider-agnostic, cost/latency/reasoning aware

### 3. Evaluation Engine (EXISTS → ENHANCE)
- 8 metrics with weights: correctness(0.3), testResults(0.2), requirementCoverage(0.15), architecture(0.1), security(0.1), performance(0.05), maintainability(0.05), artifactValidity(0.05)
- 5 verdicts: PASS, PASS_WITH_WARNINGS, FAIL, BLOCKED, UNKNOWN
- UNKNOWN when no measurable evidence
- Regression detection

### 4. Evidence System (EXISTS)
- Claims: FACT | ASSUMPTION | INFERENCE | UNKNOWN
- Source hierarchy: official-docs > source-code > tests > package-metadata > reliable-tech > community
- Confidence scoring, verification tracking

### 5. Artifact System (DONE: registry com proveniência, versão, lineage e regressão)
- Trackable objects: id, type, version, producer, timestamp, content, hash, dependencies, validation status, evaluation
- Lineage: who created, modified, consumed, which decision generated, which evaluation validated

### 6. Decision Journal (DONE)
- Structured decisions: decision, alternatives, chosen, reason, evidence, confidence, agent, timestamp, related artifacts
- Enables "Why did Izanagi choose this?" queries

### 7. Self-Healing (EXISTS → ENHANCE)
- Classification: recoverable | non-recoverable | planning | tool | agent | validation | dependency
- Strategies: local_repair | replan | handoff | skill_replacement | retry | abort
- Hard limits: maxAttempts, maxTokens, maxTime, recovery budget
- Failure memory integration

### 8. Checkpoint + Resume (DONE)
- Persistent execution state at each node
- CLI: `izanagi resume <run-id>`
- Survives crashes, interruptions

### 9. Policy Engine (DONE)
- Granular permissions: tool access, fs, network, destructive ops, dependency install, production actions, agent/skill permissions
- Answers "is this allowed in this context?"

### 10. Human-in-the-Loop (DONE)
- Approval gates for: production deploy, destructive fs, schema migration, security exceptions, large arch changes
- CLI: `izanagi approve <run-id>`, `izanagi reject <run-id>`

### 11. Observability (EXISTS → ENHANCE)
- Structured traces: run, graph, node, agent, skill, tool, model, tokens, latency, retries, failures, decisions, artifacts, evaluation, recovery
- Metrics aggregation for dashboards
- Explainability: `izanagi explain <run-id>`

### 12. Skill Lifecycle (NEW)
- States: DISCOVERED → DRAFT → VALIDATED → ACTIVE → DEPRECATED → ARCHIVED
- Track: version, quality, usage, success rate, failure rate, evaluation history, last evaluation

### 13. Agent Performance History (NEW)
- Per-agent: runs, successes, failures, avgScore, avgTokens, lastRunAt
- Influences router scoring

### 14. A/B Testing Framework (NEW)
- Compare: Agent A vs B, Skill A vs B, Prompt A vs B, Model A vs B
- Statistical comparison, automatic promotion

### 15. Token Budget 2.0 (EXISTS)
- Phases: planning | execution | evaluation | recovery
- Per-phase ceilings, abort on exhaustion
- Recovery phase for retries (not execution)

---

### 16. Commander (DONE)

`runtime/orchestration/commander.ts`. Classifica complexidade (1 a 5) e domínios, escolhe o modo de execução, gera um Task Contract por tarefa com critérios de aceite derivados do schema real do artefato, estima o custo do plano e degrada o modo quando o teto de `--max-cost` seria estourado. Determinístico: nenhuma chamada de modelo para planejar. Uma decomposição externa (LLM ou plugin) pode ser injetada, mas passa por validação estrutural e cai no template quando não conforma.

### 17. Task Contract (DONE)

`runtime/contracts/task-contract.ts`. Objetivo, papel, insumos por referência, restrições, saída esperada, dependências, prioridade, orçamento (tokens/tempo/tool calls/custo), política de verificação e critérios de aceite. Anexado ao nó em `metadata.contract`: grafos sem contrato seguem pelo caminho legado.

### 18. Context Resolver (DONE)

`runtime/orchestration/context-resolver.ts`. Cada tarefa recebe objetivo, restrições e SOMENTE os artefatos dos quais depende, resumidos com preservação de começo e fim e referenciados por id. Corrigiu uma lacuna real: antes, nós dependentes nunca recebiam a saída dos predecessores, então o grafo tinha dependência topológica sem transferência de informação.

### 19. Agent Capability Registry (DONE)

`runtime/registry/capabilities.ts`. Descoberta em disco (`agents/*.json`, `.agents/agents/`, `agents/generated/`) com capacidades, skills, chains, classe de custo, papel e domínios. Substitui a lista fixa de agentes que vivia dentro do orchestrator. O matching é bilíngue: domínio detectado no objetivo cruza com domínio detectado na descrição do agente.

### 20. Agent-to-Agent Protocol (DONE)

`runtime/protocol/messages.ts`. Mensagens tipadas com referência de artefato em vez de cópia de texto, e crítica estruturada com parsing tolerante. Saída de crítico não parseável vira `needs_revision`, nunca aprovação silenciosa. `formatCorrection` devolve só os problemas bloqueantes, sem reenviar histórico.

### 21. Budget Controller (DONE)

`runtime/token/execution-budget.ts`. Compõe o `PhaseTokenBudget` e acrescenta custo em USD, tetos de tool call, agente e retry, tempo de parede e a escada de degradação (reduzir contexto → reduzir saída → baixar modelo → reduzir paralelismo → cortar tarefas opcionais → pedir aprovação humana). Gasto que estouraria um teto é recusado sem ser contabilizado.

### 22. Verification Engine 2.0 (DONE)

`runtime/verification/engine.ts`. Três camadas: determinística (schema, tamanho, presença/ausência, regex, campo JSON, existência de arquivo dentro da raiz), evidência (artefato declarado existe e é válido) e semântica (juiz injetável). Sem juiz, o critério semântico fica `UNVERIFIED` e o run NUNCA declara conclusão: ausência de verificação não é aprovação.

### 23. Response Cache (DONE)

`runtime/cache/response-cache.ts`. Cache local por hash de (provider, modelo, system, mensagens, teto, temperatura), com TTL, eviction e versão de esquema na chave. Opt-in por `--cache` ou `IZANAGI_CACHE=1`: cachear resposta de modelo é decisão do usuário, não default silencioso.

## Data Flow

```
Task Input
    ↓
Classifier → Category + Primary Agent
    ↓
Planner → Execution Graph (template + dynamic)
    ↓
Router → Score Agents/Skills/Models (history-aware)
    ↓
Scheduler → Execute Batches (parallel + serial)
    ↓
Produce → Validate Artifacts (contracts)
    ↓
Evaluate → Verdict + Score + Recommendations
    ↓
  PASS → Learn → Memory → History → Better Routing
    ↓
  FAIL → Heal (classify → strategy → retry/replan) → Re-evaluate
    ↓
  ABORT → Record Failure Pattern → Memory
```

---

## CLI Commands

```bash
izanagi run "<objetivo>"                      # Commander decide o modo
izanagi run "<objetivo>" --mode autonomous    # força o modo
izanagi run "<objetivo>" --budget 10000       # teto de tokens
izanagi run "<objetivo>" --max-cost 0.50      # teto de custo (degrada o plano se estourar)
izanagi run "<objetivo>" --model <id>         # fixa o modelo em todos os papéis
izanagi run "<objetivo>" --local              # só providers locais
izanagi run "<objetivo>" --cache              # cache local de respostas
izanagi run "<objetivo>" --no-commander       # planejamento legado por categoria

izanagi models [--json]                       # catálogo + roteamento por papel + custo
izanagi budget [run-id] [--json]              # para onde foi o orçamento daquele run
izanagi trace [run-id]                        # spans, healing, graph, avaliação
izanagi explain <run-id>                      # decisões, healing, veredito
izanagi benchmark tokens [--json]             # legado vs Commander (chamadas, tokens, custo)
izanagi agents · izanagi skills · izanagi doctor --deep
izanagi resume|approve|reject <run-id>        # checkpoint e human-in-the-loop
```

---

## Quality Gates (Every Output)

1. **Security Gate** — no secrets, skill-scanner passes
2. **Validation Gate** — artifacts valid per schema
3. **Evaluation Gate** — verdict PASS/PASS_WITH_WARNINGS
4. **Token Phase Gate** — no phase budget exhausted
5. **Style Gate** — anti-AI-slop, design directions
6. **Clarity Gate** — no fluff, every sentence adds value
7. **Completeness Gate** — full vertical slice for SaaS

---

## Non-Goals (Explicit)

- ❌ Marketplace (before core loop solid)
- ❌ Dashboard UI (before observability primitives)
- ❌ Dozens of new skills/agents (quality > quantity)
- ❌ Breaking changes without migration path
- ❌ Mocks pretending features work

---

## Implementation Phases

| Phase | Focus | Key Deliverables |
|-------|-------|------------------|
| 1 | Architecture | ARCHITECTURE.md, clean skill-resolver.json |
| 2 | Core Runtime | runtime.ts, unified registry |
| 3 | Execution Graph | scheduler.ts, cancellation |
| 4 | Evaluation | graders.ts, regression.ts |
| 5 | Evidence + Artifacts | artifact store, decision journal |
| 6 | Routing + History | routing history, agent/skill registry |
| 7 | Memory + Failures | skill lifecycle, unified state |
| 8 | Self-Healing + Checkpoint | checkpoint.ts, resume CLI |
| 9 | Policy + Security | policy.ts, human-in-loop |
| 10 | Observability | metrics.ts, explain CLI |
| 11 | Evolution | promotion.ts, A/B framework |
| 12 | Factories | Integration with new systems |
| 13 | Benchmarks | External JSON, regression detect |
| 14 | CLI | Refactor run.ts, new commands |
| 15 | Agents + Skills | Clean JSONs, frontmatter validation |
| 16 | Tests | Full integration suite |
| 17 | Documentation | SYSTEM/RULES/ROADMAP sync |
| 18 | Site/Manifest | Public manifest generation |
| 19 | Final Audit | Build, test, verify, doctor, benchmark |