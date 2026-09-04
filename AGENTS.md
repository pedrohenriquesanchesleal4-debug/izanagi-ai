# AGENTS.md: Izanagi AI Framework Reference

> Version 3.19.0
> Modular Skill-Oriented AI Prompt & Agent Framework for Autonomous Software Engineering
> Multi-CLI: Opencode · Claude Code · Codex · Cursor · Copilot · Kimi (Smart Auto-Detection & Selective Generation)

---

## 1. Visão Geral do Framework

Izanagi AI é um **framework meta** para engenharia de software autônoma orientada a agentes: arquitetura em camadas (Routing → Orchestration → Evaluation → Healing → Memory), biblioteca de skills especializadas (catálogo v2 em `.skills/` convivendo com o legado `skills/`), **Skill Composer** (16 composições de skills encadeadas por domínio), **22 agentes especializados core + gerados**, **Memória Persistente Anti-Repetição** (`.agents/memoria/`), **Curadoria de Referências** (`references/`), **Checkpoint & Self-Healing Swarm Engine**, uma **CLI executável (`izanagi`)** publicada no npm (`izanagi-ai`) e uma **topologia poliglota** (Rust · Go · Python · TS — seção 3). Este repositório É o framework (não um app que o usa).

---

## 2. Os 22 Agentes Especializados & Comandos Opencode (`/`)

O framework conta com **22 agentes especializados** em `agents/*.json` + orquestrador `/agents` (`.opencode/agent/agents.md`). Tarefas complexas ativam o **Multi-Agent Swarm Mode** (execução paralela concorrente de múltiplos especialistas com isolamento de contexto).

| Comando | Arquivo | Papel & Especialidade |
|---|---|---|
| `/agents` | `.opencode/agent/agents.md` | Orquestrador Multi-Agente (Swarm Mode padrão / Paralelo) |
| `/discovery` | `agents/discovery-agent.json` | Pré-produção: entrevista condicional, pesquisa web, preview, prompt rico ⭐ |
| `/product-reasoner` | `agents/product-reasoner-agent.json` | Entendimento: requisitos com evidências (FACT/ASSUMPTION/UNKNOWN), critérios BDD |
| `/animation` | `agents/animation-agent.json` | Scrollytelling, 3D WebGL, motion signature |
| `/architect` | `agents/architect-agent.json` | System design, Clean Arch, DDD, CQRS, ADRs |
| `/senior-engineer` | `agents/senior-engineer-agent.json` | Full-stack dev, refactoring, código limpo/testável |
| `/ai-engineer` | `agents/ai-engineer-agent.json` | Features com LLM: RAG, embeddings/vector DB, agentes com tool-calling/MCP, prompt engineering, avaliação/guardrails |
| `/techlead` | `agents/techlead-agent.json` | Code review, governança, mentoria |
| `/automation-engineer` | `agents/automation-engineer-agent.json` | Automação profissional: planilhas, browser, API, ETL |
| `/security` | `agents/security-agent.json` | OWASP Top 10, auth, secure coding |
| `/devops` | `agents/devops-agent.json` | CI/CD, Docker, K8s, IaC, observabilidade |
| `/database` | `agents/database-agent.json` | SQL, PostgreSQL, Redis, modelagem de dados |
| `/qa` | `agents/qa-agent.json` | QA & Test Automation: unitários, integração, E2E (Playwright), acessibilidade (WCAG) |
| `/bug-hunter` | `agents/bug-hunter-agent.json` | Debug, root cause analysis |
| `/docs` | `agents/docs-agent.json` | Docs técnicos, READMEs, diagramas |
| `/pm` | `agents/pm-agent.json` | Sprints, milestones, riscos |
| `/professor` | `agents/professor-agent.json` | Ensino adaptativo, explicações |
| `/researcher` | `agents/researcher-agent.json` | Investigação aprofundada, síntese de fontes |
| `/evaluator` | `agents/evaluator-agent.json` | Critério técnico, avaliação objetiva de entregas |
| `/adversarial-critic` | `agents/adversarial-critic-agent.json` | Crítica destrutiva-construtiva, pontos cegos |
| `/form-engineer` | `agents/form-engineer-agent.json` | Formulários high-craft: validação, wizard, acessibilidade |
| `/agent-architect` | `agents/agent-architect-agent.json` | Projeta novos agentes (Genome, guardrails, avaliação) por lacuna real |
| `/skill-architect` | `agents/skill-architect-agent.json` | Curadoria de skills: security scan, anti-duplicação, lacunas comprovadas |

> **Histórico:** `agents/generated/` não é versionado — agentes gerados pela Agent Factory (`izanagi agent create`) ficam locais por padrão. O antigo exemplo `c-systems-engineer.json` foi removido na v2.13.0 e não deve mais ser listado como agente do framework.

---

## 3. Arquitetura Poliglota

Coexistência **Strangler Fig** (ADR-001): o legado npm (`src/`, CLI `izanagi`) permanece intocado e publicável; o crescimento novo vive num SDK TypeScript + 4 núcleos nativos, orquestrados pela CLI de nova geração (`packages/cli`, binário `izanagi-next`). Referência canônica de contratos IPC, error codes (`-32001..-32005`), env vars e ADRs: **`docs/POLYGLOT.md`** (ADRs integrais em `.agents/memoria/decisoes.md`, gitignored).

| Componente | Linguagem | Responsabilidade | Como testar |
|---|---|---|---|
| `crates/izanagi_core` | Rust | Quality engine: 7 heurísticas anti-slop sobre TS/Python/Go; protocolo NDJSON stdin/stdout (`validate`/`rules`/`version`) + op `scan-rationalizations` (`--file=<path>` / `--stdin`, exit 0/1/2); bindings WASM feature-gated (`--features wasm`, subcomandos `--version`/`--help`) | `cargo test --workspace` (126 testes declarados no fonte) · `cargo check -p izanagi_core --features wasm` |
| `crates/izanagi_mcp` | Rust | Cliente MCP JSON-RPC 2.0 sobre stdio: discovery + invocação pontual (`izanagi-mcp call --tool=<name>`) | incluso no `cargo test --workspace` |
| `go-services/swarm_orchestrator` | Go | Orquestrador de swarm (Uber Fx): pipeline architect→engineer→qa→security via JSON-RPC 2.0 sobre UDS com event push | `(cd go-services/swarm_orchestrator && go build ./... && go vet ./... && go test ./...)` |
| `python-engine/ast_analyzer` | Python ≥3.10 | Análise semântica multilíngue: símbolos, complexidade ciclomática, imports (tree-sitter + fallback estrutural) | `(cd python-engine && .venv/bin/python -m pytest tests/ -q)` (41 testes; o venv não é versionado) |
| `packages/sdk` | TypeScript | `@izanagi/sdk`: clientes tipados strict para os 4 núcleos + catálogo de skills; zero deps runtime | `(cd packages/sdk && npm install && npm test)` |
| `packages/cli` | TypeScript | Binário `izanagi-next`: run em 4 fases com auto-heal (N=2), `agent list`, `skill list`, `gates check`; exit codes próprios (0 ok · 1 gate/falha · 2 uso · 3 ambiente) | `npm test` dentro de `packages/cli` (13 testes em `tests/{run,skill}.test.ts`) |
| `packages/skill-migrator` · `agent-migrator` | Node ESM | Migradores determinísticos idempotentes: skills v1→v2 (106 módulos) e agents JSON→YAML (22) — ADR-004/005 | `node packages/agent-migrator/cli.mjs --check` · `node packages/skill-migrator/cli.mjs --dry-run` |

**Gotchas poliglotas:**
- Socket do orquestrador tem defaults divergentes por lado: servidor Go `/tmp/izanagi-orch.sock` (env `IZANAGI_ORCHESTRATOR_SOCK`) × SDK TS `/tmp/izanagi-swarm.sock` (env `IZANAGI_ORCHESTRATOR_SOCKET`). Case os dois via env antes de integrar (tabela completa em `docs/POLYGLOT.md`).
- Testes do SDK/CLI NUNCA via strip-types direto sobre `.ts`: use o build próprio de cada pacote (`npm test` dentro de `packages/sdk`).
- `Cargo.lock` é commitado (pins exatos, ex.: wasm-bindgen); build `.wasm` real só existe no job CI `wasm-build`.

---

## 4. Comandos de Desenvolvimento (ordem importa)

```
# Legado npm (raiz)
npm install          # instala deps
npm run build        # tsc && node dist/scripts/generate-manifest.js
npm test             # build + node --test dist/runtime/tests/*.test.js (764 testes)
npm run verify       # build + teste de instalação em sandbox (passa todos os pack IDs)
npm run doctor       # node bin/izanagi.js doctor [--deep]: auditoria de integridade
npm run bump:patch   # npm version patch --no-git-tag-version (também minor/major)
npm publish          # prepublishOnly roda build; depois: git push

# Núcleos poliglotas
cargo build --workspace                       # Rust: bins izanagi-core / izanagi-mcp em target/debug/
cargo test --workspace                        # 126 testes declarados no fonte (core + mcp)
cargo check -p izanagi_core --features wasm   # type-check dos bindings WASM (ADR-003)
(cd go-services/swarm_orchestrator && go build ./... && go vet ./... && go test ./...)
(cd python-engine && .venv/bin/python -m pip install -r requirements-dev.txt && .venv/bin/python -m pytest tests/ -q)
(cd packages/sdk && npm install && npm test)
(cd packages/cli && npm install && npm run build)

# Diagnóstico & catálogos v2
node bin/izanagi.js polyglot status [--json|--strict]   # saúde dos 7 componentes poliglotas (--strict sai 1 se algo ausente)
node packages/agent-migrator/cli.mjs --check            # drift YAML ↔ JSON (exit 0 sincronia / 1 drift / 2 uso)
node packages/skill-migrator/cli.mjs --dry-run          # valida migração skills v2 sem escrever
```

**Gotchas críticos:**
- `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js`: **rode `npm run build` antes de qualquer comando CLI local** (`doctor`, `polyglot status`, `export`...), senão roda código obsoleto ou quebra. O mesmo vale para `packages/*/dist`: rode o build do package antes de consumir SDK/CLI-next.
- `doctor`: instalação completa do usuário = `.agents/agents/` contendo agentes em **JSON** (formato distribuído); os YAMLs derivados do repo-fonte não caracterizam instalação.
- Há test runner real (`node:test`, 764 testes em `src/runtime/tests/`). Verificação = `npm test` + `npm run verify` + `npm run doctor` + suítes poliglotas da seção 3.
- Padrão de commit do repo: `chore: bump to vX.Y.Z` para bumps e `feat:`/`fix:`/`docs:` descritivos em PT-BR para mudanças.

---

## 5. Estrutura do Framework

**Legado (fonte canônica de agentes e skills):**
- `core/`: 15 engines (.md, incluindo `skill-composer.md`, `checkpoint-healing-engine.md`, `quality-gates.md`) + **`skill-resolver.json`** (mapa alias → target, 258 aliases, 16 `compositions`)
- `agents/`: 22 definições de agentes em JSON (fonte da verdade para os comandos) com `chains` compostas e Agent Genome (13 campos); derivados YAML em `.agents/agents/*.yaml` gerados pelo agent-migrator — proibido editar YAML à mão
- `skills/`: legado histórico v1 (fonte do migrador). Catálogo ativo **v2**: `.skills/<name>/SKILL.md` (106 módulos; front-matter `name/description/version/category/tools.mcp` + seções Triggering Criteria / Step-by-Step Workflow / Verification Steps / Common Rationalizations / Red Flags; subpastas `references/`)
- `references/`: curadoria de referências reais por domínio (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo)
- `.agents/memoria/`: memória persistente anti-repetição (**gitignored**, só existe local): `contexto.md`, `decisoes.md` (ADRs), `erros-corrigidos.md`, `learnings.md`
- `.opencode/agent/`: comandos slash do Opencode/Kimi CLI, gerados sob demanda a partir de `agents/*.json` (`izanagi export --cli opencode`), junto dos adapters de `.claude/`, `.codex/`, `.cursor/`, `.github/`, `.kimi/`
- `src/`: CLI TypeScript (entrypoint: `src/cli/index.ts` → `runCLI`; multi-CLI export: `src/exporters.ts`; diagnóstico poliglota: `src/cli/commands/polyglot.ts`)
- `SYSTEM.md` & `RULES.md`: fundação e regras operacionais (Anti-Generic High-Craft, Masterpiece Gate & Cinematic UI)

**Poliglota (crescimento novo):**
- `crates/`: workspace Rust na raiz — `izanagi_core` (quality engine + bindings WASM feature-gated), `izanagi_mcp` (cliente MCP stdio); `Cargo.lock` commitado
- `go-services/swarm_orchestrator/`: orquestrador Go (Uber Fx, JSON-RPC 2.0 sobre UDS, event push, artefatos por estágio)
- `python-engine/`: analisador AST multilíngue (tree-sitter + fallback, 41 testes; venv em `.venv/`, criado localmente e não versionado)
- `packages/`: `sdk` (`@izanagi/sdk`), `cli` (binário `izanagi-next`), `skill-migrator`, `agent-migrator` — todos `private`
- `docs/POLYGLOT.md`: referência canônica da topologia poliglota (contratos IPC, tabela de env vars, gaps conhecidos, resumo dos ADRs)

---

## 6. Regras de Execução, Autonomia & Masterpiece Gate

- **Estudo Antes de Codar (Study-First):** toda tarefa começa (1) carregando `.agents/memoria/contexto.md` (sempre) + só os arquivos de `.agents/memoria/` (`decisoes.md`, `erros-corrigidos.md`, `learnings.md`) do domínio da tarefa (cada agente nativo em `.claude/agents/*.md` já aponta pra sua fatia relevante, não é preciso reler os quatro por hábito), (2) consultando `references/` e/ou `deep-research` quando a tarefa exigir informação externa, e só então (3) arquitetar e implementar. Nunca programe no escuro, mas também nunca recarregue contexto irrelevante.
- **Lei da Fidelidade Absoluta a Referências (Anti-Rush):** Quando solicitado clonagem, inspiração ou replicação de uma referência visual/técnica (ex: `igloo.inc`), os agentes têm **estritamente proibido** retornar respostas apressadas ou fingir estudo superficial. É obrigatório decompor rigorosamente a estrutura, tipografia, grid, animações e micro-interações da referência e entregar uma obra de excelência artesanal (*High-Craft*) idêntica ou superior.
- **Zero Falsificação de Pesquisa (Anti-Fake-Research):** Nunca afirme ter estudado ou analisado um site ou documento sem processá-lo com profundidade real. Cada entrega reflete estudo genuíno e maestria técnica.
- **Composição de Skills Obrigatória:** skills nunca são usadas isoladas. O `core/skill-composer.md` + `compositions` do `skill-resolver.json` definem cadeias encadeadas por domínio.
- **Execução Paralela Concorrente:** Ative múltiplos agentes especializados simultaneamente para frentes distintas.
- **Pré-instalação de Dependências:** Baixe e instale pacotes necessários (`npm install`) **antes** de criar ou alterar arquivos de código. Nunca espere o usuário fazer.
- **Ponta a Ponta Autônomo & Lei de Entrega Completa de SaaS:** Execute tarefas até a conclusão total sem pausas desnecessárias. **Proibido atalhos ou landing-page-only:** quando o usuário solicitar um SaaS ou aplicação completa, a entrega deve obrigatoriamente incluir o ciclo vertical completo (Landing Page + Autenticação + Dashboard/Core App + Backend/Database + README).
- **Lei da Entrega Exaustiva e Profunda (Anti-Stub / Anti-Lazy-Code):** Em QUALQUER solicitação (feature, componente, tela ou script), é **estritamente proibido** escrever código esparso, stubs vazios (`TODO`, `// implement later`) ou arquivos mínimos. Toda entrega deve ser **profunda, rica, robusta e completa de primeira**, com tipagem estrita, estados reais, tratamento de erros e lógica funcional pronta para produção.
- **Lei da Geração de Código Real e Zero Listas (Anti-Checklist / Anti-Summary):** É estritamente proibido responder a pedidos de sistemas, apps ou SaaS com listas de tarefas resumidas (`[✓] 1. Criar banco...`), resumos textuais ou stubs vagos. O Izanagi exige a **geração de código real, completo e produtivo** para cada arquivo necessário (Schema Prisma, Rotas de API, Componentes React/Next.js com Tailwind, Middlewares de Auth, README de execução). Cada arquivo deve vir com seu código fonte 100% implementado, sem atalhos.
- **Discovery Condicional:** Se o prompt do usuário já estiver detalhado e estruturado, o `/discovery` aprova automaticamente e gera o blueprint/prompt rico de imediato, sem entrevistas desnecessárias. Se for vago, conduz a entrevista sugerindo temas personalizados ao nicho.
- **Style Selector Obrigatório (Design Directions First):** Em todo pedido de site/app/landing, apresente 3-5 direções de design BESPOKE para o nicho (`design-directions`): paleta exata, tipografia com personalidade, layout e motion signature: e o usuário escolhe antes de codar. Nunca template único.
- **Anti AI-Slop (Zero "Cara de IA"):** toda UI entregue passa pela auditoria `anti-ai-slop` (ZERO tells: Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future"). Substituir por escolhas intencionais: tipografia distinta, cor dominante + acento, layout assimétrico, motion em 1-2 momentos-chave.
- **Token Economy Ativa por Padrão:** a skill `economia-tokens` vale para toda sessão: contexto mínimo, prompt caching (estático primeiro, dinâmico por último), sliding window, coordenar agentes por artefatos em disco (nunca passar payloads gigantes entre agentes) e zero releituras. Economia se aplica a contexto inútil, nunca ao entregável.

---

## 7. Padrão Anti-Generic / High-Craft & Cinematic UI

Proibido entregar código/design genérico "cara de IA" (templates óbvios, fundos cinzas chapados, cards repetitivos, sem animação).
- **Obrigatório:** Estética Apple-like / Awwwards-grade (`bg-zinc-950`, glassmorphism, bento grids, tipografia precisa, scrollytelling e micro-interações).
- **Referências:** use `references/` como vocabulário técnico-visual: nunca invente URLs, nunca entregue colagem.

---

## 8. Multi-CLI Compatibility & Smart Detection

O framework funciona em qualquer CLI de IA que leia `AGENTS.md` e possui adapters gerados:

| CLI | Arquivos | Comandos/Agentes |
|---|---|---|
| **Opencode** | `.opencode/agent/*.md` | `/discovery`, `/architect`, `/agents`... |
| **Claude Code** | `CLAUDE.md` + `.claude/commands/*.md` + `.claude/skills/*/SKILL.md` | `/discovery`, `/architect`... via commands; skills nativas |
| **Codex** | `AGENTS.md` + `.codex/instructions.md` + `.codex/agents/*.md` | agentes em markdown simples |
| **Cursor** | `.cursor/rules/*.mdc` | rules globais (core/agents/memory) |
| **GitHub Copilot** | `AGENTS.md` + `.github/copilot-instructions.md` | regras de codificação |
| **Kimi CLI** | `kimi.md` + `.kimi/README.md` | compatível com convenção `.opencode/` |

- `izanagi init` possui **detecção inteligente de CLI**: auto-detecta a CLI/IDE em uso (ou permite selecionar via `--cli opencode|cursor|claude|codex|copilot|kimi|all`), gerando **apenas** o adaptador necessário para manter o workspace limpo e sem poluição visual.
- `izanagi export --cli opencode|claude|codex|cursor|copilot|kimi|all` regenera os adapters sob demanda. **Idempotente com uma regra:** arquivo que carrega o `GENERATED_MARKER` é reescrito; arquivo sem o marker (ou seja, editado à mão) é preservado intocado. "Nunca sobrescreve arquivos existentes" era a leitura errada disso: quem editou o gerado sem tirar o marker perde a edição.

---

## 9. Release Flow & CI/CD (resumo)

**CI — `.github/workflows/polyglot.yml`** (push/PR em `main`; jobs 100% paralelos, fail-fast global, actions fixadas por SHA): `legacy-npm` (build+test) · `rust` (clippy + test + check wasm) · `wasm-build` (`.wasm` E2E, ADR-003) · `go` (build/vet/test) · `python` (pytest com pins) · `ts-packages` (sdk test + cli build).

**CD — `.github/workflows/publish.yml`**: exclusivo de tag `v*`/release; guard idempotente; least privilege. Pacotes poliglotas (`@izanagi/sdk`, `@izanagi/cli-next`) são `private` — só o legado npm publica (whitelist `files` não inclui `crates/`, `go-services/`, `python-engine/`, `packages/`, por decisão deliberada).

1. `npm run bump:patch` (ou minor/major): bumpa `package.json`/`package-lock.json`
2. `npm run build`: recompila + regenera `.manifest`
3. Commit (`chore: bump to vX.Y.Z`) + `npm publish` (build roda via prepublishOnly)
4. `git push`
