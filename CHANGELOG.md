# Changelog

> All notable changes to the IZANAGI AI framework.

---

## [2.10.0] — 2026-08-11

### Added
- **Agent Genome (PHASE 7)**: os 18 agentes core agora declaram os 13 campos formais do genome (purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility) — base para scoring e roteamento adaptativo.
- **Agent Factory via CLI**: `izanagi agent create "<requisito>" [--name=slug] [--skills=a,b]` gera agentes com genome completo em `agents/generated/`, detecta lacuna vs. os 18 core (recusa lacuna já coberta) e é descoberto automaticamente por `loadAgent`/`agent list`.
- **Skill Factory via CLI**: `izanagi skill create <nome> --gap="..." [--force]` cria skills em `skills/generated/<nome>/SKILL.md` com frontmatter de manifesto, security scan pré-escrita (persiste só com severidade LOW) e recusa de lacuna já coberta; bug de sobrescrita entre skills corrigido (subdir por skill + mkdir do parent).
- **Tool Registry (MCP-ready)**: `src/runtime/tools/registry.ts` — tools builtin `fs.read`/`fs.write`/`fs.ls` com fluxo discover → permission → validate → execute, sandbox de zona (anti path-traversal) e permissões least-privilege.
- **Evaluation Engine — veredito UNKNOWN**: sem métricas mensuradas o runtime agora emite **UNKNOWN** com recomendação explícita de evidência (antes: nunca retornava o veredito).
- **Skill Scanner — DEFENSIVE_CONTEXT**: exemplos educativos/defensivos (não/evite/auditar...) deixaram de ser falsos positivos; `izanagi doctor --deep` passou a varrer as 212 skills sem falso positivo.
- **Testes**: 14 novos (factories: 6, tools: 7, scanner defensivo) — total 136 testes de runtime passando.

### Fixed
- **DNG-001**: regex `\/\b` nunca casava comandos destrutivos → padrão corrigido.
- **PER-001**: `Array.includes('*')` não detectava wildcards em permissões → `some(p => p.includes('*'))`.
- **SkillFactory**: todas as skills eram gravadas no mesmo arquivo e `writeFileSync` falhava sem subdir → subdir por skill + `mkdirSync` do parent.
- **Resolver/CLI**: `loadAgent` e `agent list` não enxergavam `agents/generated/` → agora varrem o diretório gerado.

### Documentation
- SYSTEM.md: novas seções (Execution Pipeline, Agent Factory & Skill Factory, Benchmarks & Regression, Model Router, Tool Registry, Doctor --deep) + tabela de módulos atualizada.
- README.md: tabela de comandos da CLI reescrita (agent create, skill create --gap, workflow, eval, benchmark, trace, memory, doctor --deep).

---
## [2.9.6] — 2026-08-11

### Fixed
- **Healing Engine**: skill_replacement agora aplica de fato a substituicao de skill no no (reescreve node.skills com a skill de fallback) em vez de apenas registrar a intencao; validacao usa validateArtifact em PT-BR com healing por artefato invalido.
- **Orchestrator**: avaliacao final consome o artefato test-results para reportar regressoes (testes falhando -> FAIL/BLOCKED com recomendacao); healing de validacao respeita retryNow com tentativas limitadas.
- **Skill Scanner**: regras reais funcionando — DNG-001 (comando destrutivo), PER-001 (permissoes wildcard), SCR-001 (scripts no frontmatter), NET-001/002, SEC-001, INJ-001/003, DNG-002/003/004.
- **LLM Executor**: adapters reais OpenAI/Anthropic/OpenRouter com validacao de env key, timeout e propagacao de erro HTTP (antes: stub inerte).
- **Memory/Trace**: agent stats persistidos e traces JSONL com load/list/retry de escrita.
- **Documentacao**: SYSTEM.md reescrito com a arquitetura real do runtime, AGENTS.md atualizado para 18 agentes / 212 skills / 15 composicoes, README.md reescrito.

### Added
- **122 testes de runtime** (node --test dist/runtime/tests/*.test.js): orchestrator (ciclo completo, retry, abort, skill_replacement, regressoes), evaluation, artifact contracts, resolver, scanner, memory, tracer, llm.
- **Frontmatter de metadados** (name, description, version, compatibility, triggers, token_budget) em 27 skills que nao declaravam.

### Enhanced
- Composicoes do resolver mapeadas por categoria de runtime (implementation, testing, debugging, database_design).
- .agents/memoria/ sincronizada com os aprendizados reais da sessao.

---
## [2.8.0] — 2026-08-10

### Added
- **14th Specialized Agent (`/qa`)**: QA & Test Automation Engineer (`agents/qa-agent.json` + `.opencode/agent/qa.md`) for automated unit testing, integration tests, E2E (Playwright), accessibility (WCAG), and quality gates.
- **Multi-Agent Swarm Default & Orchestrator Hardening**: Enforced parallel concurrent multi-agent delegation as default in Agents Orchestrator (`/agents`), forbidding monolithic single-agent execution on complex SaaS/application requests.
- **Advanced GitHub & AI Agent Curadoria**: Expanded `references/repos-ai-agents.md` with top open-source AI agent standards, prompt banks (grill-me, humanizer, websiteprompts), and modern UI component systems (21st.dev, Cult UI, Skiper UI, React Bits).
- **Persistent Memory Protection**: Automated persistent session checkpoints in `.agents/memoria/` to guarantee zero loss on hardware or application crashes.
- **New skill `design-directions`** (Style Selector): presents 3-5 BESPOKE design directions per industry (palette, typography, layout signature, motion signature) for the user to choose BEFORE any code — never a single template.
- **New skill `anti-ai-slop`**: full catalog of AI-generated design tells (Inter default, purple gradients, hero + 3 cards, rounded-2xl uniformity, "Build the future" copy) with detect/fix workflow and the identity test.
- **New skill references** for `design-directions` and `anti-ai-slop` (2026 curated sources: avoid-ai-design, Superdesign, 925studios, BSWEN/Anthropic grading).

### Enhanced
- **`economia-tokens` rewritten with real context engineering**: prompt caching (static first, dynamic last), lost-in-the-middle awareness (~32K), sliding window, model routing, output constraints, and a conscious exception (economy never sacrifices deliverable depth).
- **Agents Orchestrator rewritten as Supervisor + Swarm**: task decomposition, parallel dispatch with isolated context per agent, coordination via on-disk artifacts, aggregation, and mandatory Design Experience Flow (Style Selector → Anti AI-Slop → experience over speed).
- **Skill chains updated** (`web_cinematic`, `webgl_experience`, `fullstack_crud` + animation/senior-engineer/discovery agents) to include `design-directions` first and `anti-ai-slop` before QA.
- **RULES.md rules 13-16**: detailed anti-AI-slop catalog, dynamic industry-tailored design system, mandatory Style Selector, and AI-tells audit.
- **SYSTEM.md principles 13-15**: Style Selector, Anti AI-Slop, Token Economy.
- **Blueprint Engine & Materialization Contracts** synchronized across all 14 agents to enforce zero stubs, zero checklists, and full vertical-slice SaaS delivery (Landing Page + Auth + Dashboard + Backend + README + QA).
- **agents/INDEX.md** updated to 14 agents.

---

## [2.3.3] — 2026-08-03

### Fixed
- **Skill Resolver**: alias `learning` apontava para `skills/continuous-learning-engine` (inexistente — skill consolidada em `continuous-improvement`). Agora aponta para `skills/continuous-improvement/SKILL`.
- **`verify-build`**: `npm run verify` quebrava com `TypeError: selectedPackIds is not iterable` porque `installToProject` era chamado sem o segundo argumento. Agora passa todos os pack IDs no teste de instalação em sandbox.

### Removed
- **`skills/privacy-engineer`**: duplicata morta de `skills/security-privacy` (mesmo escopo LGPD/GDPR, marcada `disabled` no `.manifest`, sem uso em nenhuma chain). Removida skill + alias `privacy-engineer` do resolver.
- **`.manifest`**: catálogo estático obsoleto (versão 2.2.1, 55 paths quebrados, sem leitura em nenhum código). Removido do pacote e do repositório.

## [2.3.2] — 2026-08-02

### Added
- Portado `skills/tdd/references/writing-good-tests.md` (técnicas de escrita de testes de alta qualidade).
- Portado `skills/webapp-testing/examples/*.py` (4 exemplos Playwright: sandbox server, discovery de elementos, console logging, automação HTML estático) com paths adaptados para `outputs/`.

## [2.3.1] — 2026-08-02

### Added
- Portado `skills/ui-ux-pro-max/references/quick-reference.md` + `pro-rules.md` (regras UX da Apple/HIG de alto impacto em texto).

### Fixed
- URL `http://highscalability.com` → `https://highscalability.com` (mixed content).

## [2.3.0] — 2026-08-02

### Added
- **Discovery Agent** (`/discovery`): pré-produção completa antes de codar — entrevista, pesquisa web, preview e prompt de implementação.

## [2.2.1] — 2026-07-31

### Fixed
- /animation opencode agent: color: green era inválido no schema (só aceita hex ou tokens do tema) — agora color: "#22c55e" 

## [2.2.0] — 2026-07-31

### Changed
- **Package renamed back: `Izanagiai` → `izanagi-ai`** — o framework volta ao nome original Izanagi AI (repo GitHub `izanagi-ai`, site `SiteIzanagi`)
- **Bins renomeados**: `Izanagi`/`Izanagiai` → `izanagi`/`izanagi-ai` (comandos agora são `izanagi init`, `izanagi run`, etc.)
- CLI internamente renomeada: `Izanagi AI CLI`, config do projeto em `.izanagi/izanagi.config.json` (era `.Izanagi/Izanagi.config.json`)
- Documentação (AGENTS.md, README, CONTRIBUTING) atualizada para o novo nome/comandos

### Fixed
- `--help` imprimia "Unknown option" junto com a ajuda (caso `--help` compartilhava bloco com `default:`)

## [2.1.1] — 2026-07-31

### Added
- **Animation Engineer agent** (`agents/animation-agent.json`): sites cinematográficos — scrollytelling, scroll-driven animations, 3D WebGL e motion design
- **3 novas skills** (com `references.md` pesquisado em 2026):
  - `animation-web` — scroll image sequences estilo Apple, GSAP ScrollTrigger, Lenis, pinned sections, preloaders (referências: uiprompts.app, Skiper UI, KokonutUI, Apple product pages)
  - `webgl-3d` — Three.js / React Three Fiber, shaders, partículas, GLTF/Draco, perf budgets (referências: Bruno Simon, The Monolith, DeepSee, KINESIS)
  - `motion-design` — decisão de biblioteca GSAP vs Anime.js v4 vs Motion vs Lottie vs CSS, timing/easing/stagger
- **Agente opencode `/animation`** (`.opencode/agent/animation.md`): ativado digitando `/animation` no opencode; copiado automaticamente para projetos pelo `izanagi init`
- Classificação de tasks de animação/3D no `izanagi run` (ex: `izanagi run "site animado com 3d"` → Animation Engineer)

### Changed
- AGENTS.md atualizado: 11 agentes, skills ativas incluem animation-web/webgl-3d/motion-design

## [2.1.0] — 2026-07-31

### Added
- **Pack system** on `izanagi init`: interactive multi-select of skill packs (arrow keys, space, `a`/`n`) or `--packs a,b,c` flag. `core` is always included.
- `izanagi init <dir>` now creates the project directory if it doesn't exist, plus `.izanagi/izanagi.config.json` and `opencode.json` (auto-loads the framework in opencode)
- `izanagi run [agent] --task "<task>"`: run a specific agent (incl. custom ones created via `izanagi create`) with full skill chain resolution against `core/skill-resolver.json`
- Context resolution: CLI commands now prefer the project's `.agents/` (created by init) with fallback to the installed package
- Interactive pack selector with graceful fallback for non-TTY environments

### Changed
- **Package renamed `izanagi-ai` → `Izanagiai`** (bins `Izanagi`/`Izanagiai` unchanged) — reverted in 2.2.0
- `AGENTS.md` and `README.md` rewritten with the new CLI commands and pack system
- Commands `compile`, `list`, `doctor` now resolve agents/skills from project `.agents/`, cwd or installed package

### Removed
- **Postinstall auto-copy removed** — this was the cause of duplicated files (`.agents/` + package contents). `.agents/` is now created only by `izanagi init`

### Fixed
- `izanagi run "task"` (without `--task`) now works again alongside `run [agent] --task "..."`

## [2.0.8] — 2026-07-23

### Added
- `izanagi create <agent|skill> <name>` command to scaffold new agents and skills
- `coding/` directory (13 language/framework skills) to npm package and `izanagi init`

### Fixed
- `bin/izanagi.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

## [2.0.7] — 2026-07-23

### Changed
- Bump version to 2.0.7

### Fixed
- `bin/izanagi.js` import path fix (previously attempted, incomplete)

## [2.0.6] — 2026-07-23

- Bump version to 2.0.6

### Fixed
- `bin/izanagi.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

## [2.0.0] — 2026-07-22

### Changed
- Version bump to v2.0.0 (all Phases 1-6 implemented)
- Cleansed project-specific references for public release
- Fixed all broken paths in decision-engine skill chain matrix
- Registered 31 orphan skills in INDEX.md and skill-resolver.json
- Corrected count mismatches across INDEX.md, CHANGELOG.md, ROADMAP.md
- Updated ROADMAP.md to reflect actual implementation state

## [1.0.0] — 2026-07-17

### Added

#### Core
- `SYSTEM.md` — Foundation: identity, principles, architecture, token budget, quality gates, memory, evolution.
- `RULES.md` — 9 golden rules, skill declaration, communication, memory, quality, security, error recovery.
- `README.md` — Entry point, quick start, principles table.
- `decision-engine.md` — 15 category classification, skill chain matrix, keyword routing, 70% confidence threshold.
- `context-engine.md` — 4-section context window, load prioritization, compression algorithm, relevance scoring.
- `token-manager.md` — 4-tier budget, priority-based allocation, real-time monitor, compression triggers.
- `compression-engine.md` — 4 compression levels (lossless → emergency), 5 strategies, decision preservation.
- `reflection-engine.md` — Post-task self-review, 5-dimension scoring, pattern detection (50-task rolling window).
- `evolution-engine.md` — 6 pattern → action mappings, 4 change types, auto-apply rules, full traceability.
- `quality-gates.md` — 5 gates (security, style, clarity, conciseness, completeness), security is fatal.
- `planning-engine.md` — Atomic step decomposition, topological sort, effort estimation, circular dependency detection.

#### Memory (6)
- `memory-manager.md` — 3-tier (session/project/long-term), JSON storage, knowledge graph, recall engine.
- `session-compression.md` — 200-token session summary, decision/error/action preservation.
- `conversation-summarizer.md` — 68:1 compression, extraction priority, YAML summary format.
- `context-recovery.md` — Session recovery flow, recovery prompt template.
- `smart-recall.md` — Relevance scoring (keyword 0.4 + recency 0.3 + relation 0.3).
- `long-term-project-memory.md` — Persistent project context across sessions.

#### Optimization (3)
- `token-reducer.md` — 6 reduction techniques, format selection matrix (8 types).
- `prompt-optimizer.md` — 4 optimization passes (noise, implicit, ambiguity, structure).
- `cost-optimizer.md` — Token cost tracking, infrastructure optimization strategies.

#### Architecture (10)
- `clean-architecture.md` — Layers, directory structure, dependency rule.
- `hexagonal-architecture.md` — Ports & Adapters, testability, infrastructure swap.
- `cqrs-specialist.md` — Read/write separation, when to use/avoid.
- `event-driven-architect.md` — Events, brokers (RabbitMQ/Kafka/Redis), idempotency.
- `ddd-specialist.md` — Building blocks, ubiquitous language, aggregate example.
- `microservices-expert.md` — When to use/avoid, key patterns, service template.
- `monolith-expert.md` — Modular monolith, migration path to microservices.
- `repository-pattern.md` — Interface contract, implementation, rules.
- `unit-of-work.md` — Transactional consistency, commit/rollback, clear.

#### Coding (13)
- `backend-engineer.md` — Multi-language (PHP, Node, Python, C#), conventions, checklist.
- `frontend-engineer.md` — React + TS + Tailwind, state management (5 states), a11y, performance.
- `api-designer.md` — REST conventions, response envelope, auth decision tree, rate limiting, OpenAPI.
- `laravel-specialist.md` — Eloquent, Form Requests, Policies, conventions, patterns.
- `php-specialist.md` — PHP 8.x features, PSR-12, PHPStan level max config.
- `javascript-specialist.md` — ES2022+, functional patterns, checklist.
- `typescript-specialist.md` — Strict mode, discriminated unions, branded types, tsconfig.
- `python-specialist.md` — Python 3.11+, typing, dataclasses, async.
- `react-specialist.md` — Hooks, RSC, compound components, performance checklist.
- `vue-specialist.md` — Composition API, Pinia, TypeScript, conventions.
- `nodejs-specialist.md` — Express/Fastify, error handling, services, checklist.
- `java-specialist.md` — Java 17+, Spring Boot 3, records, virtual threads.
- `csharp-specialist.md` — .NET 8, Minimal APIs, primary constructors, records.

#### Security (3)
- `security-engineer.md` — OWASP Top 10, secrets detection (7 regex), security report.
- `owasp-auditor.md` — Full OWASP Top 10 audit, CVSS severity, CVE references.
- `pentest-reviewer.md` — 5 attack categories (IDOR, priv esc, mass assignment, SSRF), report format.

#### Quality (12)
- `senior-code-reviewer.md` — 6-dimension scoring, 4 severity levels, YAML report.
- `clean-code-validator.md` — 6 validation categories, function size heuristic, before/after examples.
- `solid-validator.md` — 5 principles with checklists, score, refactoring recommendations.
- `dry-kiss-yagni-validator.md` — 3 principles with checks and examples.
- `complexity-analyzer.md` — Cyclomatic complexity (McCabe), cognitive complexity, thresholds.
- `bug-prevention.md` — 4 prevention layers, 8 bug patterns with detection and prevention.
- `design-pattern-advisor.md` — Decision tree, pattern suggestions, anti-patterns.
- `refactoring-specialist.md` — 12 code smells, 3 techniques, safety checklist, plan template.
- `technical-debt-analyzer.md` — 6 debt categories, estimation formula, prioritized backlog.
- `breaking-change-detector.md` — API and database breaking changes, detection flow.
- `performance-optimizer.md` — Audit workflow, bottleneck types, caching strategy (4 levels).
- `scalability-expert.md` — 4 scaling dimensions, horizontal scaling checklist, sharding.

#### Testing (4)
- `unit-test-engineer.md` — Pest/Jest/pytest/xUnit, Arrange-Act-Assert, edge case checklist, naming convention.
- `integration-test-engineer.md` — Scope, Laravel/Pest example, database testing.
- `e2e-test-engineer.md` — Cypress/Playwright, critical journeys, example.
- `mocking-specialist.md` — 5 double types, frameworks (Mockery, Jest, Mockito, Moq), rules.

#### DevOps (8)
- `devops-engineer.md` — 8-step workflow, Docker, CI/CD, monitoring, backup, security hardening, runbook.
- `docker-expert.md` — Multi-stage, image optimization, compose for dev, security.
- `kubernetes-specialist.md` — Deployment template, resources (ConfigMap, Secret, Ingress, HPA).
- `git-expert.md` — Trunk-based vs Git Flow, commit conventions, useful commands.
- `git-flow-specialist.md` — Branch structure, workflow, commands.
- `ci-cd-specialist.md` — Pipeline stages, GitHub Actions example, quality gates.
- `linux-specialist.md` — Server hardening, performance tuning, commands.
- `windows-specialist.md` — IIS, PowerShell, Windows-specific config.

#### Database (6)
- `database-engineer.md` — Naming conventions, data types, index strategy, migration safety levels.
- `sql-optimizer.md` — EXPLAIN ANALYZE, index rules, sargable predicates, query rewrites.
- `postgresql-specialist.md` — JSONB, full-text search, partitioning, CTEs.
- `mysql-specialist.md` — InnoDB, EXPLAIN FORMAT=JSON, performance tuning.
- `sqlserver-specialist.md` — T-SQL, execution plans, indexed views.
- `redis-specialist.md` — Data structures (5 types), use cases, eviction policies.

#### Engineering Roles (4)
- `principal-engineer.md` — Technical vision, org-level standards, decision framework.
- `staff-engineer.md` — Deep technical excellence, large feature delivery, mentorship.
- `tech-lead.md` — Team leadership, daily rhythm, engineering-product bridge.
- `cto-advisor.md` — Strategic advice, stakeholder communication, budget and risk.

#### Debugging (3)
- `bug-hunter.md` — 8-step protocol, binary isolation, debugging decision tree, bug report format.
- `debug-specialist.md` — 6-step protocol, error pattern library (4 patterns), quick diagnostics CLI.
- `root-cause-analyzer.md` — 5 Whys, Fishbone, Premortem, 7 root cause categories, pattern detection.

#### Teaching (6)
- `professor-mode.md` — 4-level detection (beginner→expert), 4 teaching strategies, interactive exercises.
- `mentor-mode.md` — 4 guidance principles, Socratic questioning, learning roadmap generator.
- `code-explainer.md` — 4 explanation levels (overview→expert), YAML format, pattern highlighting.
- `interactive-teaching.md` — 6 exercise types, interaction flow with correction feedback.
- `adaptive-teaching.md` — Difficulty/pace/style adaptation rules based on performance.
- `learning-tracker.md` — Persistent learning record, confidence scoring, progress report.

#### Analysis (5)
- `requirement-analyzer.md` — Extraction process, functional/non-functional categorization, structured format.
- `risk-analyzer.md` — Probability × Impact matrix, risk register, mitigation planning.
- `dependency-analyzer.md` — Security, freshness, compatibility, license audit, report format.
- `tradeoff-analyzer.md` — 6 criteria with weights, weighted scoring, recommendation.
- `alternative-solution-generator.md` — 3+ options format with pros/cons/effort per option.

#### Documentation (6)
- `documentation-writer.md` — 5 documentation types, README template.
- `technical-writer.md` — Diátaxis framework (tutorials/how-to/reference/explanation), writing principles.
- `readme-generator.md` — Automated sections, badge generation, stack extraction.
- `uml-generator.md` — PlantUML + Mermaid class/component/use case diagrams.
- `sequence-diagram-builder.md` — PlantUML + Mermaid sequence diagrams with actor flow.
- `er-diagram-builder.md` — PlantUML + Mermaid ER diagrams from schema.

#### Project Management (3)
- `project-manager.md` — Milestones, sprint tracking, velocity, stakeholder communication.
- `task-planner.md` — Atomic task breakdown, estimation guidelines (1-8 points), acceptance criteria.
- `release-planner.md` — Version bump rules, release checklist, changelog entry format.

#### UX/Observability (5)
- `ux-reviewer.md` — 10 Nielsen heuristics, severity-graded report.
- `accessibility-reviewer.md` — WCAG 2.2 AA (perceivable/operable/understandable/robust), audit tools.
- `logging-expert.md` — Structured JSON logging, what to log/not log by level.
- `observability-expert.md` — 3 pillars (logs/metrics/traces), RED metrics, dashboard structure.
- `monitoring-specialist.md` — Alert rules (critical/warning), incident response (6 steps).

#### Self-Improvement (6)
- `self-correction.md` — Error detection, correction protocol (acknowledge/explain/correct/prevent/log).
- `self-critique.md` — 8 critique questions, proactive revision process.
- `continuous-improvement.md` — Improvement cycle, effectiveness tracking.
- `hallucination-detection.md` — 4 confidence levels (90%+ to <50%), detection patterns.
- `confidence-estimator.md` — Source reliability scoring, communication patterns per confidence level.
- `continuous-learning-engine.md` — 3 learning sources, knowledge gap detection.

#### Skills (1)
- `INDEX.md` — Complete registry of all 111 skills with status and file paths.

---

### Stats

| Category | Skills |
|----------|--------|
| Core | 8 |
| Architecture | 10 |
| Coding | 13 |
| Security | 3 |
| Quality | 12 |
| Testing | 4 |
| Database | 6 |
| DevOps | 8 |
| Engineering Roles | 4 |
| Debugging | 3 |
| Teaching | 6 |
| Memory | 6 |
| Optimization | 3 |
| Analysis | 5 |
| Documentation | 6 |
| Project Management | 3 |
| UX/Observability | 5 |
| Self-Improvement | 6 |
| **Total** | **111** |

