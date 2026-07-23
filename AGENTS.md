# AGENTS.md — NexusAI

NexusAI é um **framework meta** (instruções para agentes de IA), não um projeto executável. O repositório inteiro é markdown + JSON — sem npm, sem build, sem testes, sem CI.

## Arquitetura

- `SYSTEM.md` — Fundação: identidade, princípios, arquitetura em camadas (Decision → Context → Skill → Quality → Reflection → Memory)
- `RULES.md` — 9 regras operacionais + formato de declaração de skills + regras de comunicação
- `core/` — 8 engines (decision-engine, context-engine, token-manager, compression-engine, reflection-engine, evolution-engine, quality-gates, planning-engine)
- `agents/` — 10 agentes pré-definidos como JSONs que compõem skills
- `skills/INDEX.md` — Registro central de todas as 111 skills. **Qualquer skill nova deve ser registrada aqui**
- `core/skill-resolver.json` — Mapeia short IDs para paths de skills. **Qualquer skill nova deve ter alias aqui** para ser usada por agentes

## Regras-chave

- **Toda skill precisa de entrada em dois lugares**: `skills/INDEX.md` + `core/skill-resolver.json`
- **Formato de skill**: YAML header (name, version, priority, dependencies, triggers, token_budget, compatibility) + seções (Identity → Goals → Workflow → Decision Tree → Rules → Checklists → Metrics → Evolution)
- **Agentes**: JSON com `skills` (array de short IDs), `chains` (mapa de tipo de task → chain de skills), `always`/`never`
- **Task routing**: `RULES.md:86-106` — 6 classificações (new_project, bug, refactor, review, question, security_audit) + fallback genérico
- **Output format** obrigatório (RULES.md seção 2.1): `## Context` → `## File` (com path) → `## Notes`
- **Token budgets** (SYSTEM.md:115-120): 2048 soft / 4096 hard por resposta, 8192 contexto, compressão automática >70%
- **Quality Gates** (SYSTEM.md:129-135): Security → Style → Clarity → Conciseness → Completeness (nesta ordem)
- **5 proibições** (RULES.md:49-53): não adivinhar APIs, não codificar sem entender o codebase, não repetir contexto, não ignorar convenções, não hardcodear secrets

## Estrutura de diretórios

| Diretório | Conteúdo |
|-----------|----------|
| `core/` | Engines do sistema (8 skills) |
| `architecture/` | Padrões arquiteturais (Clean Arch, Hexagonal, DDD, CQRS, etc.) |
| `coding/` | Skills de engenharia (backend, frontend, React, Laravel, etc.) |
| `skills/` | 77+ skills especializadas (quality, debugging, cloud, devops, etc.) |
| `agents/` | Definições de agentes como JSON |
| `memory/` | Gerenciamento de memória (6 skills) |
| `teaching/` | Modo professor e ensino adaptativo |
| `testing/` | Testes unitários, integração, E2E, mocking |
| `security/` | OWASP, pentest, segurança |
| `database/` | SQL, PostgreSQL, MySQL, Redis |
| `devops/` | Docker, K8s, CI/CD, Linux |
| `optimization/` | Redução de tokens, otimização de prompt, custo |

## Convenções

- **Versão atual**: v2.0.0 (SemVer). CHANGELOG.md e ROADMAP.md mostram o plano até v3.0.0
- **Idioma**: maior parte em português (descrições de agentes, READMEs); conteúdo técnico em inglês
- **Filosofia**: "Architecture first. Code second." — nunca pular planejamento
- O framework é **carregado automaticamente** via `opencode.json` (`instructions: ["AGENTS.md", "SYSTEM.md"]`) ao iniciar o opencode na raiz do projeto

## Skills (Economia de Tokens)

Skills nicho foram **desativadas** por padrão para reduzir o system prompt (~50% menos skills carregadas).

**Ativas:** `ai-agent`, `ai-agent-dev`, `architecture-patterns`, `economia-tokens`, `frontend`, `frontend-dev`, `handoff-sessao`, `memoria-projeto`, `professor-modo`, `qa`, `qa-engineer`, `security-privacy`, `web-perf-seo`

**Desativadas (renomeadas para `SKILL.md.disabled`):** `chaos-engineering`, `cloud-architect`, `cloud-infra`, `data-engineer`, `data-engineering`, `feature-flags`, `graphql`, `i18n-l10n`, `iac-terraform`, `legacy-migration`, `mobile-dev`, `mobile-engineer`, `privacy-engineer`, `serverless-edge`, `sre-reliability`, `wasm`, `web-perf-engineer`, `websocket-realtime`

**Ativação automática:** Ao receber um pedido cujo contexto indica que uma skill desativada é necessária (ex: "criar app mobile" → `mobile-dev`, "deploy na AWS" → `cloud-infra`), o agente DEVE:
1. Renomear `SKILL.md.disabled` → `SKILL.md` na pasta correspondente
2. Informar o usuário que a skill foi ativada e é preciso reiniciar o opencode
3. Não prosseguir com a tarefa até o reinício — o usuário precisa reiniciar para a skill carregar

## Site de Portfólio (SiteIzanagi)

O repositório `site/` contém um site Next.js (portfólio do NexusAI) publicado em `github.com/pedrohenriquesanchesleal4-debug/SiteIzanagi`.
**Toda vez que o framework for atualizado**, o agente DEVE também atualizar o site (i18n, estrutura, comandos, versão) no repositório do site e enviar push.

## Design Preference (Default)

- **Estilo visual**: Futurista Apple-like — fundo escuro, glassmorphism, gradientes suaves, partículas animadas, 3D tilt em cards, tipografia bold, animações sutis, sem excesso de "cara de IA"
- **Stack**: a stack (React, Vue, HTML/CSS/JS, etc.) é definida pelo contexto do projeto ou pelo que o usuário pedir — o estilo visual se adapta à stack, não o contrário
- **Exceptions**: quando o usuário pedir um estilo específico, seguir a solicitação
