# AGENTS.md — Izanagi AI Framework Reference

> Version 2.11.0
> Modular Skill-Oriented AI Prompt & Agent Framework for Autonomous Software Engineering
> Multi-CLI: Opencode · Claude Code · Codex · Cursor · Copilot · Kimi (Smart Auto-Detection & Selective Generation)

---

## 1. Visão Geral do Framework

Izanagi AI é um **framework meta** para engenharia de software autônoma orientada a agentes: arquitetura em camadas (Routing → Orchestration → Evaluation → Healing → Memory), biblioteca de skills especializadas, **Skill Composer** (15 composições de skills encadeadas por domínio), **21 agentes especializados core + gerados**, **Memória Persistente Anti-Repetição** (`.agents/memoria/`), **Curadoria de Referências** (`references/`), **Checkpoint & Self-Healing Swarm Engine**, e uma **CLI executável (`izanagi`)** publicada no npm (`izanagi-ai`). Este repositório É o framework (não um app que o usa).

---

## 2. Os 21 Agentes Especializados & Comandos Opencode (`/`)

O framework conta com **21 agentes especializados** em `agents/*.json` + orquestrador `/agents` (`.opencode/agent/agents.md`). Tarefas complexas ativam o **Multi-Agent Swarm Mode** (execução paralela concorrente de múltiplos especialistas com isolamento de contexto).

| Comando | Arquivo | Papel & Especialidade |
|---|---|---|
| `/agents` | `.opencode/agent/agents.md` | Orquestrador Multi-Agente (Swarm Mode padrão / Paralelo) |
| `/discovery` | `agents/discovery-agent.json` | Pré-produção: entrevista condicional, pesquisa web, preview, prompt rico ⭐ |
| `/product-reasoner` | `agents/product-reasoner-agent.json` | Entendimento: requisitos com evidências (FACT/ASSUMPTION/UNKNOWN), critérios BDD |
| `/animation` | `agents/animation-agent.json` | Scrollytelling, 3D WebGL, motion signature |
| `/architect` | `agents/architect-agent.json` | System design, Clean Arch, DDD, CQRS, ADRs |
| `/senior-engineer` | `agents/senior-engineer-agent.json` | Full-stack dev, refactoring, código limpo/testável |
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
| *Dinâmico* | `agents/generated/c-systems-engineer.json` | Engenharia C & Baixo Nível: gestão de memória, ponteiros, GCC/CMake, Valgrind |

---

## 3. Comandos de Desenvolvimento (ordem importa)

```
npm install          # instala deps
npm run build        # tsc && node dist/scripts/generate-manifest.js
npm test             # build + node --test dist/runtime/tests/*.test.js (165 testes)
npm run verify       # build + teste de instalação em sandbox (passa todos os pack IDs)
npm run doctor       # node bin/izanagi.js doctor — auditoria de integridade
npm run bump:patch   # npm version patch --no-git-tag-version (também minor/major)
npm publish          # prepublishOnly roda build; depois: git push
```

**Gotchas críticos:**
- `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js` — **rode `npm run build` antes de qualquer comando CLI local**, senão roda código obsoleto ou quebra.
- `doctor` valida: SYSTEM.md/RULES.md, JSONs de agentes e aliases do resolver → targets.
- Há test runner real (`node:test`, 165 testes em `src/runtime/tests/`). Verificação = `npm test` + `npm run verify` + `npm run doctor`.
- Padrão de commit do repo: `chore: bump to vX.Y.Z` para bumps e `feat:`/`fix:`/`docs:` descritivos em PT-BR para mudanças.

---

## 4. Estrutura do Framework

- `core/` — 10+ engines (.md, incluindo `skill-composer.md`, `checkpoint-healing-engine.md`, `quality-gates.md`) + **`skill-resolver.json`** (mapa alias → target + seção `compositions`)
- `agents/` — Definições de agentes em JSON (fonte da verdade para os comandos) com `chains` compostas e Agent Genome (13 campos)
- `skills/` — 212 skills em `skills/<name>/SKILL.md` (+ `references.md` opcional), incluindo `design-directions` (Style Selector por indústria), `ui-ux-pro-max` (design system com motor BM25 offline em Node) e `anti-ai-slop` (auditoria zero "cara de IA")
- `references/` — curadoria de referências reais por domínio (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo)
- `.agents/memoria/` — memória persistente anti-repetição: `contexto.md`, `decisoes.md`, `erros-corrigidos.md`, `learnings.md`
- `.opencode/agent/` — comandos slash do Opencode; adapters gerados sob demanda em `.claude/`, `.codex/`, `.cursor/`, `.github/`, `.kimi/`
- `src/` — CLI TypeScript (entrypoint: `src/cli/index.ts` → `runCLI`; multi-CLI export: `src/exporters.ts`)
- `SYSTEM.md` & `RULES.md` — fundação e regras operacionais (Anti-Generic High-Craft, Masterpiece Gate & Cinematic UI)

---

## 5. Regras de Execução, Autonomia & Masterpiece Gate

- **Estudo Antes de Codar (Study-First):** toda tarefa começa (1) carregando `.agents/memoria/contexto.md` (sempre) + só os arquivos de `.agents/memoria/` (`decisoes.md`, `erros-corrigidos.md`, `learnings.md`) do domínio da tarefa — cada agente nativo em `.claude/agents/*.md` já aponta pra sua fatia relevante, não é preciso reler os quatro por hábito —, (2) consultando `references/` e/ou `deep-research` quando a tarefa exigir informação externa, e só então (3) arquitetar e implementar. Nunca programe no escuro, mas também nunca recarregue contexto irrelevante.
- **Lei da Fidelidade Absoluta a Referências (Anti-Rush):** Quando solicitado clonagem, inspiração ou replicação de uma referência visual/técnica (ex: `igloo.inc`), os agentes têm **estritamente proibido** retornar respostas apressadas ou fingir estudo superficial. É obrigatório decompor rigorosamente a estrutura, tipografia, grid, animações e micro-interações da referência e entregar uma obra de excelência artesanal (*High-Craft*) idêntica ou superior.
- **Zero Falsificação de Pesquisa (Anti-Fake-Research):** Nunca afirme ter estudado ou analisado um site ou documento sem processá-lo com profundidade real. Cada entrega reflete estudo genuíno e maestria técnica.
- **Composição de Skills Obrigatória:** skills nunca são usadas isoladas. O `core/skill-composer.md` + `compositions` do `skill-resolver.json` definem cadeias encadeadas por domínio.
- **Execução Paralela Concorrente:** Ative múltiplos agentes especializados simultaneamente para frentes distintas.
- **Pré-instalação de Dependências:** Baixe e instale pacotes necessários (`npm install`) **antes** de criar ou alterar arquivos de código. Nunca espere o usuário fazer.
- **Ponta a Ponta Autônomo & Lei de Entrega Completa de SaaS:** Execute tarefas até a conclusão total sem pausas desnecessárias. **Proibido atalhos ou landing-page-only:** quando o usuário solicitar um SaaS ou aplicação completa, a entrega deve obrigatoriamente incluir o ciclo vertical completo (Landing Page + Autenticação + Dashboard/Core App + Backend/Database + README).
- **Lei da Entrega Exaustiva e Profunda (Anti-Stub / Anti-Lazy-Code):** Em QUALQUER solicitação (feature, componente, tela ou script), é **estritamente proibido** escrever código esparso, stubs vazios (`TODO`, `// implement later`) ou arquivos mínimos. Toda entrega deve ser **profunda, rica, robusta e completa de primeira**, com tipagem estrita, estados reais, tratamento de erros e lógica funcional pronta para produção.
- **Lei da Geração de Código Real e Zero Listas (Anti-Checklist / Anti-Summary):** É estritamente proibido responder a pedidos de sistemas, apps ou SaaS com listas de tarefas resumidas (`[✓] 1. Criar banco...`), resumos textuais ou stubs vagos. O Izanagi exige a **geração de código real, completo e produtivo** para cada arquivo necessário (Schema Prisma, Rotas de API, Componentes React/Next.js com Tailwind, Middlewares de Auth, README de execução). Cada arquivo deve vir com seu código fonte 100% implementado, sem atalhos.
- **Discovery Condicional:** Se o prompt do usuário já estiver detalhado e estruturado, o `/discovery` aprova automaticamente e gera o blueprint/prompt rico de imediato, sem entrevistas desnecessárias. Se for vago, conduz a entrevista sugerindo temas personalizados ao nicho.
- **Style Selector Obrigatório (Design Directions First):** Em todo pedido de site/app/landing, apresente 3-5 direções de design BESPOKE para o nicho (`design-directions`) — paleta exata, tipografia com personalidade, layout e motion signature — e o usuário escolhe antes de codar. Nunca template único.
- **Anti AI-Slop (Zero "Cara de IA"):** toda UI entregue passa pela auditoria `anti-ai-slop` (ZERO tells: Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future"). Substituir por escolhas intencionais: tipografia distinta, cor dominante + acento, layout assimétrico, motion em 1-2 momentos-chave.
- **Token Economy Ativa por Padrão:** a skill `economia-tokens` vale para toda sessão — contexto mínimo, prompt caching (estático primeiro, dinâmico por último), sliding window, coordenar agentes por artefatos em disco (nunca passar payloads gigantes entre agentes) e zero releituras. Economia se aplica a contexto inútil, nunca ao entregável.

---

## 6. Padrão Anti-Generic / High-Craft & Cinematic UI

Proibido entregar código/design genérico "cara de IA" (templates óbvios, fundos cinzas chapados, cards repetitivos, sem animação).
- **Obrigatório:** Estética Apple-like / Awwwards-grade (`bg-zinc-950`, glassmorphism, bento grids, tipografia precisa, scrollytelling e micro-interações).
- **Referências:** use `references/` como vocabulário técnico-visual — nunca invente URLs, nunca entregue colagem.

---

## 7. Multi-CLI Compatibility & Smart Detection

O framework funciona em qualquer CLI de IA que leia `AGENTS.md` e possui adapters gerados:

| CLI | Arquivos | Comandos/Agentes |
|---|---|---|
| **Opencode** | `.opencode/agent/*.md` | `/discovery`, `/architect`, `/agents`... |
| **Claude Code** | `CLAUDE.md` + `.claude/commands/*.md` + `.claude/skills/*/SKILL.md` | `/discovery`, `/architect`... via commands; skills nativas |
| **Codex** | `AGENTS.md` + `.codex/instructions.md` + `.codex/agents/*.md` | agentes em markdown simples |
| **Cursor** | `.cursor/rules/*.mdc` | rules globais (core/agents/memory) |
| **GitHub Copilot** | `AGENTS.md` + `.github/copilot-instructions.md` | regras de codificação |
| **Kimi CLI** | `kimi.md` + `.kimi/README.md` | compatível com convenção `.opencode/` |

- `izanagi init` possui **detecção inteligente de CLI**: auto-detecta a CLI/IDE em uso (ou permite selecionar via `--cli cursor|claude|codex|copilot|kimi|all`), gerando **apenas** o adaptador necessário para manter o workspace limpo e sem poluição visual.
- `izanagi export --cli claude|codex|cursor|copilot|kimi|all` regenera os adapters sob demanda (idempotente — nunca sobrescreve arquivos existentes).

---

## 8. Release Flow (resumo)

1. `npm run bump:patch` (ou minor/major) — bumpa `package.json`/`package-lock.json`
2. `npm run build` — recompila + regenera `.manifest`
3. Commit (`chore: bump to vX.Y.Z`) + `npm publish` (build roda via prepublishOnly)
4. `git push`
