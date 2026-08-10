# AGENTS.md — Izanagi AI Framework Reference

> Version 2.8.0
> Modular Skill-Oriented AI Prompt & Agent Framework for Autonomous Software Engineering
> Multi-CLI: Opencode · Claude Code · Codex · Cursor · Copilot · Kimi (Smart Auto-Detection & Selective Generation)

---

## 1. Visão Geral do Framework

Izanagi AI é um **framework meta** para engenharia de software autônoma orientada a agentes: arquitetura em camadas (Decision → Context → Skill → Quality → Reflection → Memory), biblioteca de skills especializadas, **Skill Composer** (12 composições de skills encadeadas que se conversam), **14 agentes especializados** (incluindo `/automation-engineer` e `/qa`), **Memória Persistente Anti-Repetição** (`.agents/memoria/`), **Curadoria de Referências** (`references/`), **Checkpoint & Self-Healing Swarm Engine**, e uma **CLI executável (`izanagi`)** publicada no npm (`izanagi-ai`).

---

## 2. Os 14 Agentes & Comandos Opencode (`/`)

O framework conta com **14 agentes especializados** em `agents/*.json` + orquestrador `/agents` (`.opencode/agent/agents.md`). Por padrão, tarefas complexas ativam o **Multi-Agent Swarm Mode** (execução paralela concorrente de múltiplos especialistas).

| Comando | Arquivo | Papel & Especialidade |
|---|---|---|
| `/agents` | `.opencode/agent/agents.md` | Orquestrador Multi-Agente (Swarm Mode padrão / Paralelo) |
| `/discovery` | `agents/discovery-agent.json` | Pré-produção: entrevista condicional, pesquisa web, preview, prompt rico ⭐ |
| `/animation` | `agents/animation-agent.json` | Scrollytelling, 3D WebGL, motion signature |
| `/architect` | `agents/architect-agent.json` | System design, Clean Arch, DDD, CQRS, ADRs |
| `/senior-engineer` | `agents/senior-engineer-agent.json` | Full-stack dev, refactoring, código limpo/testável |
| `/techlead` | `agents/techlead-agent.json` | Code review, governança, mentoria |
| `/automation-engineer` | `agents/automation-engineer-agent.json` | Automação profissional: planilhas, browser, API, ETL |
| `/security` | `agents/security-agent.json` | OWASP Top 10, auth, secure coding |
| `/devops` | `agents/devops-agent.json` | CI/CD, Docker, K8s, IaC, observabilidade |
| `/database` | `agents/database-agent.json` | SQL, PostgreSQL, Redis, modelagem de dados |
| `/qa` | `agents/qa-agent.json` | QA & Test Automation: unitários, integração, E2E (Playwright), acessibilidade (WCAG) 🆕 |
| `/bug-hunter` | `agents/bug-hunter-agent.json` | Debug, root cause analysis |
| `/docs` | `agents/docs-agent.json` | Docs técnicos, READMEs, diagramas |
| `/pm` | `agents/pm-agent.json` | Sprints, milestones, riscos |
| `/professor` | `agents/professor-agent.json` | Ensino adaptativo, explicações |

---

## 3. CLI Executável (`izanagi`)

Instalação global: `npm install -g izanagi-ai` (ou uso direto via `npx izanagi <cmd>`).

| Comando | Descrição Completa |
|---|---|
| `izanagi init [dir]` | Inicializa o framework no projeto. Copia automaticamente `AGENTS.md`, `SYSTEM.md` e `RULES.md` para a **raiz do projeto** (para detecção nativa pelo Opencode) e estrutura `.agents/`. |
| `izanagi run [agent] --task "<task>"` | Analisa a tarefa, classifica a categoria, seleciona o(s) agente(s) e a skill chain, resolve dependências e **gera automaticamente o arquivo `izanagi-prompt.md`** pronto para ser copiado e colado na sua IA. |
| `izanagi compile <agent> [file]` | Compila o System Prompt completo (Agente + SYSTEM.md + RULES.md + Skills) para exportação. |
| `izanagi list [skills\|agents]` | Lista todos os agentes disponíveis e todas as skills registradas no `core/skill-resolver.json`. |
| `izanagi doctor` | Executa auditoria de integridade do framework (verifica SYSTEM, RULES, integridade de JSONs de agentes e aliases do resolver). |

**Gotchas críticos:**
- `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js` — **rode `npm run build` antes de qualquer comando CLI local**, senão roda código obsoleto ou quebra.
- Não há test runner (sem `npm test`). Verificação = `npm run build` + `npm run verify` + `npm run doctor`.

---

## 4. Arquitetura em Camadas & Engines (`core/`)

1. **Decision Engine**: Classifica o tipo de tarefa (`new_project`, `bug`, `refactor`, `review`, `security_audit`, etc.) e define a chain de skills ideal.
2. **Context Engine**: Constrói janela de contexto enxuta e carrega memória de projeto.
3. **Skill Executor**: Executa o grafo direcionado acíclico (DAG) de skills com resolução de dependências.
4. **Token Manager**: Monitora orçamento de tokens e aciona compressão quando >70% do orçamento é atingido.
5. **Quality Gates**: Valida obrigatoriamente todas as entregas na ordem: **Security → Style → Clarity → Conciseness → Completeness**.
6. **Reflection Engine**: Avaliação pós-tarefa e aprendizado contínuo.
7. **Skill Composer**: 12 composições de skills encadeadas (`core/skill-composer.md` + `compositions` do `core/skill-resolver.json`).
8. **Checkpoint & Self-Healing Engine**: checkpoints de progresso e recuperação de crash (`core/checkpoint-healing-engine.md`).
9. **Memória Anti-Repetição**: `.agents/memoria/` (contexto, decisões, erros corrigidos, learnings) — nunca repita um erro já resolvido.

---

## 5. Padrão Anti-Generic / High-Craft & Cinematic UI

O framework proíbe estritamente a entrega de códigos ou designs genéricos com "cara de IA" (templates óbvios, fundos cinzas chapados, cards repetitivos, sem animação), **a menos que o usuário solicite explicitamente**.
- **Padrão Obrigatório**: Inovação, sofisticação técnica, código limpo e arquitetura refinada ("High-Craft").
- **Design Padrão (quando aplicável)**: Estética Apple-like / Awwwards-grade (`bg-zinc-950`, glassmorphism sutil, bento grids, tipografia precisa, scrollytelling e micro-interações intencionais).
- **Style Selector (Design Directions First)**: todo pedido de site/app apresenta 3-5 direções de design BESPOKE para o nicho antes de codar (skill `design-directions`).
- **Anti AI-Slop**: toda UI passa pela auditoria `anti-ai-slop` (ZERO tells: Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future").

---

## 6. Regras de Execução & Autonomia

- **Estudo Antes de Codar (Study-First):** toda tarefa começa (1) carregando `.agents/memoria/`, (2) consultando `references/` e/ou `deep-research` quando exigir informação externa, e só então (3) arquitetar e implementar. Nunca programe no escuro.
- **Composição de Skills Obrigatória:** skills nunca são usadas isoladas — o `core/skill-composer.md` + `compositions` definem cadeias encadeadas por domínio.
- **Execução Paralela Concorrente:** ative múltiplos agentes especializados simultaneamente (skill `parallel-agents` — fan-out com merge por artefatos).
- **Lei da Entrega Completa de SaaS:** proibido landing-page-only — ciclo vertical completo (Landing + Auth + Dashboard + Backend/DB + README).
- **Lei da Entrega Exaustiva (Anti-Stub):** proibido stubs vazios, placeholders ou arquivos mínimos — código de produção completo de primeira.
- **Lei da Geração de Código Real (Zero Checklists):** proibido responder pedidos de sistemas com listas de tarefas — código fonte real por arquivo.
- **Pré-instalação de Dependências:** baixe e instale pacotes necessários antes de criar/alterar arquivos. Nunca espere o usuário.
- **Token Economy Ativa:** contexto mínimo, prompt caching (estático primeiro), coordenação por artefatos em disco, zero releituras.

---

## 7. Estrutura de Diretórios do Framework

- `core/` — 10 engines (.md, incluindo `skill-composer.md` e `checkpoint-healing-engine.md`) + **`skill-resolver.json`** (mapa alias → target + seção `compositions`)
- `agents/` — 14 definições de agentes em JSON (fonte da verdade para os comandos) com `chains` compostas
- `skills/` — 200+ skills em `skills/<name>/SKILL.md` (+ `references.md` opcional), incluindo `design-directions` (Style Selector por indústria) e `anti-ai-slop` (auditoria zero "cara de IA")
- `references/` — curadoria de referências reais por domínio (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo, repos-ai-agents)
- `.agents/memoria/` — memória persistente anti-repetição: `contexto.md`, `decisoes.md`, `erros-corrigidos.md`, `learnings.md`
- `.opencode/agent/` — comandos slash (`/`) nativos do Opencode; adapters equivalentes gerados sob demanda em `.claude/`, `.codex/`, `.cursor/`, `.github/`, `.kimi/`
- `src/` — CLI TypeScript (entrypoint: `src/cli/index.ts` → `runCLI`; multi-CLI export: `src/exporters.ts`)
- `SYSTEM.md` & `RULES.md` — fundação e regras operacionais (Anti-Generic High-Craft & Cinematic UI)

---

## 8. Multi-CLI Compatibility & Smart Detection

| CLI | Arquivos | Comandos/Agentes |
|---|---|---|
| **Opencode** | `.opencode/agent/*.md` | `/discovery`, `/architect`, `/agents`... |
| **Claude Code** | `CLAUDE.md` + `.claude/commands/*.md` + `.claude/skills/*/SKILL.md` | `/discovery`, `/architect`... via commands; skills nativas |
| **Codex** | `AGENTS.md` + `.codex/instructions.md` + `.codex/agents/*.md` | agentes em markdown simples |
| **Cursor** | `.cursor/rules/*.mdc` | rules globais (core/agents/memory) |
| **GitHub Copilot** | `AGENTS.md` + `.github/copilot-instructions.md` | regras de codificação |
| **Kimi CLI** | `kimi.md` + `.kimi/README.md` | compatível com convenção `.opencode/` |

`izanagi init` possui **detecção inteligente de CLI**: auto-detecta a CLI/IDE em uso (ou permite selecionar via `--cli cursor|claude|codex|copilot|kimi|all`), gerando **apenas** o adaptador necessário. `izanagi export --cli ...` regenera os adapters sob demanda (idempotente — nunca sobrescreve arquivos existentes).

---

## 9. Release Flow (resumo)

1. `npm run bump:patch` (ou minor/major) — bumpa `package.json`/`package-lock.json`
2. `npm run build` — recompila + regenera `.manifest`
3. Commit (`chore: bump to vX.Y.Z`) + `npm publish` (build roda via prepublishOnly)
4. `git push`
