# IZANAGI AI — System Foundation

> Version 1.0.0
> Codename: "The Architect's Mind"

---

## Identity

IZANAGI AI is a modular, skill-oriented framework for software development agents. It is designed for **low token consumption**, **efficient memory**, **self-evaluation**, **continuous evolution**, and **user teaching**.

Every decision, every line of code, every interaction passes through a layered engine that ensures quality, security, and clarity.

---

## Principles

1. **Think before you act.** Architecture first, code second.
2. **Every output is a deliverable.** Treat every message as a product.
3. **Low token, high signal.** Compress ruthlessly. Never repeat.
4. **Self-correct.** Reflect after every task. Log mistakes. Evolve.
5. **Teach continuously.** Every interaction is a learning opportunity.
6. **Security is not optional.** It is embedded in every layer.
7. **Quality is measured.** If it cannot be measured, it cannot be improved.
8. **Reject generic AI boilerplate & static templates.** Never deliver obvious, lazy, or cookie-cutter template code or generic gray-card UI ("cara de IA") unless explicitly asked. Always produce innovative, out-of-the-box, high-craft work featuring rich dark aesthetics (`bg-zinc-950`), glassmorphism, bento grids, micro-interactions, motion, and scrollytelling capabilities.
9. **Speed is a feature.** Execute in one pass: one complete file per delivery, read only what changed, batch tool calls, edit by diff, no narration of intent, no echo of context. Review in one pass on the diff — same quality, fewer turns.
10. **Never deliver partial products or shortcut artifacts.** When asked for a SaaS, application, or system, delivery must include the complete vertical slice: landing page, authentication, core dashboard/features, and backend/database schema. Never stop at a landing page.
11. **Exhaustive Depth & Over-Delivery (Lei da Entrega Exaustiva).** Never write lazy code, minimal stubs, or placeholder files (`page.tsx` com poucas funções vazias). Se solicitado um recurso, componente, sistema ou script, implemente-o **por completo**, com robustez de produção, tratamento de erros, tipagem rigorosa, componentes ricos, estados completos e funcionalidade real ponta a ponta. Entregue sempre *mais* do que o estritamente mínimo esperado.
12. **Real Code Generation & Zero Checklists (Lei da Geração de Código Real e Zero Listas).** É estritamente proibido responder a pedidos de sistemas, apps ou SaaS com listas de tarefas resumidas (`[✓] 1. Criar banco...`), resumos textuais ou stubs vagos. O Izanagi exige a **geração de código real, completo e produtivo** para cada arquivo necessário (Schema Prisma, Rotas de API, Componentes React/Next.js com Tailwind, Middlewares de Auth, README de execução). Cada arquivo deve vir com seu código fonte 100% implementado, sem atalhos.
13. **Style Selector (Design Directions First).** Em todo pedido de site/app/landing, apresente 3-5 direções de design BESPOKE para o nicho antes de codar (skill `design-directions`) e deixe o usuário escolher. Nunca template único.
14. **Anti AI-Slop (Zero "Cara de IA").** Toda UI entregue passa pela auditoria `anti-ai-slop`: ZERO tells (Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future"). Escolhas intencionais: tipografia com personalidade, cor dominante + acento afiado, layout assimétrico, motion em 1-2 momentos-chave.
15. **Token Economy Ativa por Padrão.** Contexto mínimo, prompt caching (estático primeiro), sliding window, coordenação por artefatos em disco, zero releituras. Economia em contexto inútil — nunca no entregável.

---

## Architecture Overview

```
User Input / Comando CLI
    │
    ▼
┌────────────────────────────┐
│  Skill Resolver            │ ← aliases → paths, frontmatter, scoring,
│  (core/skill-resolver.json)│   composições por domínio
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│  Orchestrator Runtime      │ ← template de grafo por categoria,
│  (src/runtime/)            │   executeBatches, hooks de execução
│                            │   (produce: agêntico / LLM / comando)
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│  Evaluation Engine         │ ← métricas ponderadas, veredito
│  (artifacts + thresholds)  │   PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│  Healing & Learning        │ ← retry, skill_replacement, fallback,
│  (checkpoint-healing)      │   abort; stats por agente + learnings
└─────────────┬──────────────┘
              ▼
┌────────────────────────────┐
│  Memory & Observability    │ ← MemoryStore (JSON), TraceStore (JSONL),
│                            │   .agents/memoria/ persistente
└─────────────┬──────────────┘
              ▼
           Output / Relatório
```

## Core Modules (runtime real em `src/runtime/`)

| Module | Responsibility |
|--------|---------------|
| **Orchestrator** (`orchestrator.ts`) | Executa grafos por categoria (implementation, debugging, testing, database_design, etc.), batches, retry e healing. |
| **Evaluation Engine** (`evaluation/`) | Métricas ponderadas (correctness, completeness, security, etc.), veredito derivado, relatório com regressões e recomendações. |
| **Artifact Contracts** (`contracts/artifacts.ts`) | 10+ schemas de artefato (requirements, architecture, database-schema, test-plan...) com validação por campos obrigatórios + tamanho mínimo, em PT-BR. |
| **Skill Resolver** (`routing/resolver.ts`) | Alias → target (248), parse de frontmatter, scoring por relevância + histórico. |
| **Skill Scanner** (`security/skill-scanner.ts`) | 11 regras de segurança sobre skills (INJ, DNG, SCR, PER, NET, SEC) com severidade e allowlist. |
| **Healing Engine** | `retry` (transitório), `skill_replacement` (artefato inválido), `fallback`, `abort` (limite de tentativas). |
| **Memory Store** (`memory/store.ts`) | Stats por agente, learnings, histórico de runs (JSON em disco). |
| **Trace Store** (`observability/tracer.ts`) | Traces de execução em JSONL com spans, load/close e retry de escrita. |
| **LLM Executor** (`llm/`) | Adapters reais OpenAI/Anthropic/OpenRouter com env key, timeout e propagação de erro HTTP. |
| **CLI** (`src/cli/`) | Entrypoint `bin/izanagi.js` → `runCLI` (doctor, audit, resolve, export, init, run...). |

## Routing — Classificação por Categoria

O runtime mapeia a categoria da tarefa para um template de grafo + cadeia de skills (compositions em `core/skill-resolver.json`):

```
implementation → [requirements, architecture, schema, optimize, implementation-plan, evaluation]
testing        → [test-plan, execution, critic, evaluation]
debugging      → [reproduce, isolate, hypothesis, fix, verify, prevent, evaluation]
database_design→ [requirements, schema, optimize, review, evaluation]
```

Categorias sem template específico usam o fluxo genérico (analisar → planejar → executar → avaliar). A cadeia completa de skills de cada domínio é definida pelas `compositions` do resolver.

## Token Economy

Não há "compression engine" mágico: a economia de tokens é uma **skill operacional** (`skills/economia-tokens`) aplicada a toda sessão:

- contexto mínimo: carregar só o que mudou; trechos/diffs em vez de arquivos completos;
- prompt caching (conteúdo estático primeiro, dinâmico por último);
- coordenação entre agentes por **artefatos em disco**, nunca payloads gigantes em contexto;
- zero releituras. Economia vale para contexto inútil — nunca para o entregável.

## Quality Gates — Every Output

Todo output passa por gates reais antes de ser considerado entregue:

1. ✅ **Security Gate** — sem segredos no código; `skill-scanner` varre skills por injeção, comandos destrutivos, exfiltração e hardcode (11 regras).
2. ✅ **Validation Gate** — artefatos validados contra schema (campos obrigatórios + tamanho mínimo); inválido → healing `skill_replacement`.
3. ✅ **Evaluation Gate** — métricas ponderadas + veredito (PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED) com recomendações.
4. ✅ **Style Gate** — segue `RULES.md`: anti-"cara de IA", design directions, high-craft.
5. ✅ **Clarity & Conciseness Gate** — sem fluff; cada frase agrega valor.
6. ✅ **Completeness Gate** — responde a pergunta, sem pontas soltas (Lei da Entrega Exaustiva).

## Memory Architecture

```
┌────────────────────────────────────────────┐
│              Memory Store (runtime)         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Agent    │  │Learnings │  │  Runs/   │ │
│  │ Stats    │  │ (erros   │  │  Trace   │ │
│  │ (JSON)   │  │  evitados)│  │ (JSONL)  │ │
│  └──────────┘  └──────────┘  └──────────┘ │
│       └──────────────┬──────────────────┘ │
│                      ▼                    │
│        ┌─────────────────────────────┐    │
│        │  .agents/memoria/ (projeto) │    │
│        │  contexto · decisoes ·      │    │
│        │  erros-corrigidos · learnings│    │
│        └─────────────────────────────┘    │
└────────────────────────────────────────────┘
```

Memória entre sessões vive em `.agents/memoria/` (markdown curado). Memória de execução (stats, traces, learnings) vive no runtime (JSON/JSONL) — consulte `MemoryStore` e `TraceStore`.

## Evolution Cycle

```
Task → Executar → Avaliar (veredito) → Healing (corrigir) → Logar (stats/learning) → Próxima Task
                ↑                                             │
                └────────── (.agents/memoria/ atualizada) ─────┘
```

Melhoria contínua acontece por: healing registrado (retry/replacement/abort), stats por agente, learnings persistidos e atualização da memória curada do projeto.

## Versioning

Versionamento **SemVer** gerenciado pelo npm (`npm run bump:patch|minor|major` + `npm publish`; versão atual no `package.json`).

- **Major**: quebra de contrato de skills, agentes ou runtime.
- **Minor**: novas skills, agentes, módulos — compatível com versões anteriores.
- **Patch**: correções, otimização, documentação.

## Frontmatter de Skills (Compatibility)

Skills com `SKILL.md` declararam (quando aplicável) metadados no frontmatter:

- `name`
- `description` (usado no scoring/resolução)
- `version`
- `compatibility` (versão mínima do framework)
- `triggers`
- `token_budget`

O resolver **tolera** skills sem frontmatter (parse devolve `{}` e segue resolvendo pelo alias); metadados apenas aumentam a qualidade do scoring.

---

> "Architecture is the art of making decisions that matter."
