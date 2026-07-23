# Changelog

> All notable changes to the Nexus AI framework.

---

## [2.0.8] — 2026-07-23

### Added
- `nexusai create <agent|skill> <name>` command to scaffold new agents and skills
- `coding/` directory (13 language/framework skills) to npm package and `nexusai init`

### Fixed
- `bin/nexus.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

## [2.0.7] — 2026-07-23

### Changed
- Bump version to 2.0.7

### Fixed
- `bin/nexus.js` import path fix (previously attempted, incomplete)

## [2.0.6] — 2026-07-23

- Bump version to 2.0.6

### Fixed
- `bin/nexus.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

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

