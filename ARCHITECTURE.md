# Izanagi AI — Target Architecture

> Version: 2.11.0 (Target)
> Status: Being implemented across 19 phases
> Source of Truth: This document drives implementation

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

## Target Module Structure

```
src/runtime/
├── core/
│   ├── types.ts                 # Single source of truth (EXISTS)
│   └── runtime.ts               # Unified facade (NEW)
├── orchestration/
│   ├── graph.ts                 # ExecutionGraph + Builder (EXISTS)
│   ├── planner.ts               # Planner + templates (EXISTS)
│   └── scheduler.ts             # Async execution, cancellation, priority (NEW)
├── routing/
│   ├── resolver.ts              # SkillResolver (EXISTS)
│   ├── scorer.ts                # CandidateScorer + semanticRelevance (EXISTS)
│   ├── history.ts               # Routing history → learning feedback (NEW)
│   └── registry.ts              # AgentRegistry + SkillRegistry (NEW)
├── evaluation/
│   ├── engine.ts                # EvaluationEngine (EXISTS)
│   ├── graders.ts               # Per-metric graders (NEW)
│   └── regression.ts            # Automated regression detection (NEW)
├── artifacts/
│   ├── store.ts                 # ArtifactStore with versioning, lineage (NEW)
│   ├── registry.ts              # ArtifactTypeRegistry (NEW)
│   └── validator.ts             # validateArtifact + makeArtifact (EXISTS)
├── contracts/
│   └── artifacts.ts             # Schemas (EXISTS)
├── memory/
│   ├── store.ts                 # MemoryStore (EXISTS)
│   ├── failures.ts              # FailurePatternStore (EXISTS)
│   ├── decisions.ts             # DecisionJournal (ADR-lite) (NEW)
│   └── learnings.ts             # Consolidated learnings (NEW)
├── recovery/
│   ├── healing.ts               # Healer (EXISTS)
│   ├── checkpoint.ts            # Checkpoint + Resume (NEW)
│   └── state.ts                 # ExecutionState for resume (NEW)
├── observability/
│   ├── tracer.ts                # Tracer + TraceStore (EXISTS)
│   ├── metrics.ts               # Aggregated metrics (NEW)
│   └── events.ts                # Event bus for hooks (NEW)
├── model/
│   └── router.ts                # ModelRouter (EXISTS)
├── providers/
│   ├── llm-client.ts            # LLMClient + adapters (EXISTS)
│   └── config.ts                # ProviderConfig loader (NEW)
├── tools/
│   └── registry.ts              # ToolRegistry (EXISTS, MCP-ready)
├── security/
│   ├── skill-scanner.ts         # SkillScanner (EXISTS)
│   └── policy.ts                # PolicyEngine (NEW)
├── evolution/
│   ├── learning.ts              # LearningEngine (EXISTS)
│   ├── skill-lifecycle.ts       # SkillLifecycleManager (NEW)
│   ├── agent-lifecycle.ts       # AgentLifecycleManager (NEW)
│   └── promotion.ts             # A/B promotion logic (NEW)
├── research/
│   └── evidence.ts              # EvidenceRegistry (EXISTS)
├── factories/
│   ├── agent-factory.ts         # AgentFactory (EXISTS)
│   └── skill-factory.ts         # SkillFactory (EXISTS)
└── benchmarks/
    ├── registry.ts              # BenchmarkRegistry (EXISTS)
    ├── runner.ts                # BenchmarkRunner (EXISTS)
    └── definitions.ts           # Builtin cases (EXISTS)
```

---

## Key Primitives

### 1. Execution Graph (EXISTS → ENHANCE)
- Nodes with: id, kind, agent/skills, inputs/outputs, dependencies, conditions, retryPolicy, timeout, tokenBudget, validator
- Topological order + parallelBatches (Kahn's algorithm)
- Conditional branches, retries, timeouts, failure propagation
- Replan capability after failures

### 2. Adaptive Router (EXISTS → ENHANCE)
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

### 5. Artifact System (PARTIAL → COMPLETE)
- Trackable objects: id, type, version, producer, timestamp, content, hash, dependencies, validation status, evaluation
- Lineage: who created, modified, consumed, which decision generated, which evaluation validated

### 6. Decision Journal (NEW)
- Structured decisions: decision, alternatives, chosen, reason, evidence, confidence, agent, timestamp, related artifacts
- Enables "Why did Izanagi choose this?" queries

### 7. Self-Healing (EXISTS → ENHANCE)
- Classification: recoverable | non-recoverable | planning | tool | agent | validation | dependency
- Strategies: local_repair | replan | handoff | skill_replacement | retry | abort
- Hard limits: maxAttempts, maxTokens, maxTime, recovery budget
- Failure memory integration

### 8. Checkpoint + Resume (NEW)
- Persistent execution state at each node
- CLI: `izanagi resume <run-id>`
- Survives crashes, interruptions

### 9. Policy Engine (NEW)
- Granular permissions: tool access, fs, network, destructive ops, dependency install, production actions, agent/skill permissions
- Answers "is this allowed in this context?"

### 10. Human-in-the-Loop (NEW)
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

## CLI Commands (Target)

| Command | Purpose |
|---------|---------|
| `izanagi init` | Create project with skill packs |
| `izanagi run` | Execute task via adaptive runtime |
| `izanagi agent create/list/inspect` | Agent Factory + Genome |
| `izanagi skill create/list/search/inspect` | Skill Factory + Manifest |
| `izanagi workflow list/inspect` | Execution Graph templates |
| `izanagi trace` | Observability |
| `izanagi eval` | Evaluation Engine |
| `izanagi benchmark` | Benchmarks + regression |
| `izanagi memory` | Memory inspection |
| `izanagi doctor` | Integrity audit |
| `izanagi diagnose` | Deep runtime diagnosis |
| `izanagi explain` | Explain routing decisions |
| `izanagi resume` | Resume from checkpoint |
| `izanagi approve/reject` | Human-in-the-loop |
| `izanagi export` | Multi-CLI adapters |
| `izanagi compile` | Compile agent prompt |

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