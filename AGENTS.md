# AGENTS.md — Izanagi AI Framework Reference

> Version 2.5.3
> Modular Skill-Oriented AI Prompt & Agent Framework for Autonomous Software Engineering
> Multi-CLI: Opencode · Claude Code · Codex · Cursor · Copilot · Kimi (Smart Auto-Detection & Selective Generation)

---

## 1. Visão Geral do Framework

Izanagi AI é um **framework meta** para engenharia de software autônoma orientada a agentes: arquitetura em camadas (Decision → Context → Skill → Quality → Reflection → Memory), biblioteca de skills especializadas, **Skill Composer** (12 composições de skills encadeadas que se conversam), 12 agentes pré-definidos, **Memória Persistente Anti-Repetição** (`.agents/memoria/`), **Curadoria de Referências** (`references/`), **Checkpoint & Self-Healing Swarm Engine**, e uma **CLI executável (`izanagi`)** publicada no npm (`izanagi-ai`). Este repositório É o framework (não um app que o usa).

---

## 2. Agentes & Comandos Opencode (`/`)

12 agentes em `agents/*.json` + orquestrador `/agents` (`.opencode/agent/agents.md`). Cada agente tem `chains` (nome → array de **aliases** de skill) e `skills` (array de aliases). Existe também um `.md` por agente em `.opencode/agent/` para ativação via slash.

| Comando | Arquivo | Papel |
|---|---|---|
| `/agents` | `.opencode/agent/agents.md` | Orquestrador Multi-Agente (Concorrente / Swarm / Paralelo) |
| `/discovery` | `agents/discovery-agent.json` | Pré-produção: entrevista, pesquisa web, preview, prompt rico ⭐ |
| `/animation` | `agents/animation-agent.json` | Scrollytelling, 3D WebGL, motion signature |
| `/architect` | `agents/architect-agent.json` | System design, Clean Arch, DDD, CQRS, ADRs |
| `/senior-engineer` | `agents/senior-engineer-agent.json` | Full-stack, refactoring, código limpo/testável |
| `/techlead` | `agents/techlead-agent.json` | Code review, governança, mentoria |
| `/security` | `agents/security-agent.json` | OWASP Top 10, auth, secure coding |
| `/devops` | `agents/devops-agent.json` | CI/CD, Docker, K8s, IaC, observabilidade |
| `/database` | `agents/database-agent.json` | SQL, PostgreSQL, Redis, modelagem |
| `/bug-hunter` | `agents/bug-hunter-agent.json` | Debug, root cause analysis |
| `/docs` | `agents/docs-agent.json` | Docs técnicos, READMEs, diagramas |
| `/pm` | `agents/pm-agent.json` | Sprints, milestones, riscos |
| `/professor` | `agents/professor-agent.json` | Ensino adaptativo, explicações |

---

## 3. Comandos de Desenvolvimento (ordem importa)

```
npm install          # instala deps (self-dependency: package.json depende de "izanagi-ai")
npm run build        # tsc && node dist/scripts/generate-manifest.js
npm run verify       # build + teste de instalação em sandbox (passa todos os pack IDs)
npm run doctor       # node bin/izanagi.js doctor — auditoria de integridade
npm run bump:patch   # npm version patch --no-git-tag-version (também minor/major)
npm publish          # prepublishOnly roda build; depois: git push
```

**Gotchas críticos:**
- `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js` — **rode `npm run build` antes de qualquer comando CLI local**, senão roda código obsoleto ou quebra.
- `doctor` valida: SYSTEM.md/RULES.md, JSONs de agentes e aliases do resolver → targets.
- Não há test runner (sem `npm test`). Verificação = `npm run build` + `npm run verify` + `npm run doctor`.
- Padrão de commit do repo: `chore: bump to vX.Y.Z` para bumps e `feat:`/`fix:`/`docs:` descritivos em PT-BR para mudanças.

---

## 4. Estrutura do Framework

- `core/` — 10 engines (.md, incluindo `skill-composer.md` e `checkpoint-healing-engine.md`) + **`skill-resolver.json`** (mapa alias → target + seção `compositions`)
- `agents/` — 12 definições de agentes em JSON (fonte da verdade para os comandos) com `chains` compostas (6-10 skills encadeadas)
- `skills/` — 79+ skills em `skills/<name>/SKILL.md` (+ `references.md` opcional)
- `references/` — curadoria de referências reais por domínio (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo) — consulte antes de implementar
- `.agents/memoria/` — memória persistente anti-repetição: `contexto.md`, `decisoes.md`, `erros-corrigidos.md`, `learnings.md`
- `.opencode/agent/` — comandos slash do Opencode; adapters equivalentes em `.claude/`, `.codex/`, `.cursor/`, `.github/`, `.kimi/`
- `src/` — CLI TypeScript (entrypoint: `src/cli/index.ts` → `runCLI`; multi-CLI export: `src/exporters.ts`)
- `SYSTEM.md` & `RULES.md` — fundação e regras operacionais (Anti-Generic High-Craft & Cinematic UI)

---

## 5. Regras de Execução & Autonomia

- **Estudo Antes de Codar (Study-First):** toda tarefa começa (1) carregando `.agents/memoria/` (aprendizados, erros já corrigidos, decisões — nunca repita um erro já resolvido), (2) consultando `references/` e/ou `deep-research` quando a tarefa exigir informação externa (stack, referências visuais/técnicas, preços), e só então (3) arquitetar e implementar. Nunca programe no escuro.
- **Composição de Skills Obrigatória:** skills nunca são usadas isoladas. O `core/skill-composer.md` + `compositions` do `skill-resolver.json` definem cadeias encadeadas por domínio (output de uma alimenta a input da próxima). Carregar skill "de enfeite" sem a cadeia é proibido.
- **Execução Paralela Concorrente:** Ative múltiplos agentes especializados simultaneamente para frentes distintas (ex: Database + Senior Engineer + Security + Animation em paralelo), com desduplicação estrita (delta-first: cada skill atua só no que as anteriores não cobriram).
- **Pré-instalação de Dependências:** Baixe e instale pacotes necessários (`npm install`) **antes** de criar ou alterar arquivos de código. Nunca espere o usuário fazer.
- **Ponta a Ponta Autônomo & Lei de Entrega Completa de SaaS:** Execute tarefas até a conclusão total (planejamento → instalação de deps → código → build/teste) sem pausas desnecessárias. **Proibido atalhos ou landing-page-only:** quando o usuário solicitar um SaaS ou aplicação completa, a entrega deve obrigatoriamente incluir todo o ciclo vertical (Landing Page + Autenticação + Dashboard/Core App + Backend/Database + README).

---

## 6. Padrão Anti-Generic / High-Craft & Cinematic UI

Proibido entregar código/design genérico "cara de IA" (templates óbvios, fundos cinzas chapados, cards repetitivos, sem animação).
- **Obrigatório:** Estética Apple-like / Awwwards-grade (`bg-zinc-950`, glassmorphism, bento grids, tipografia precisa, scrollytelling e micro-interações).
- **Referências:** use `references/` como vocabulário técnico-visual (ex: `references/webgl-3d.md` traz exemplos reais do threejs.org para citar e aplicar) — nunca invente URLs, nunca entregue colagem.

---

## 7. Multi-CLI Compatibility

O framework funciona em qualquer CLI de IA que leia `AGENTS.md` (padrão da indústria) e possui adapters gerados:

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
