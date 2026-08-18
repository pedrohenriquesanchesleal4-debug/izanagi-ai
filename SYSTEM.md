# IZANAGI AI: System Foundation

> Version 3.6.0
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
9. **Speed is a feature.** Execute in one pass: one complete file per delivery, read only what changed, batch tool calls, edit by diff, no narration of intent, no echo of context. Review in one pass on the diff: same quality, fewer turns.
10. **Never deliver partial products or shortcut artifacts.** When asked for a SaaS, application, or system, delivery must include the complete vertical slice: landing page, authentication, core dashboard/features, and backend/database schema. Never stop at a landing page.
11. **Exhaustive Depth & Over-Delivery (Lei da Entrega Exaustiva).** Never write lazy code, minimal stubs, or placeholder files (`page.tsx` com poucas funções vazias). Se solicitado um recurso, componente, sistema ou script, implemente-o **por completo**, com robustez de produção, tratamento de erros, tipagem rigorosa, componentes ricos, estados completos e funcionalidade real ponta a ponta. Entregue sempre *mais* do que o estritamente mínimo esperado.
12. **Real Code Generation & Zero Checklists (Lei da Geração de Código Real e Zero Listas).** É estritamente proibido responder a pedidos de sistemas, apps ou SaaS com listas de tarefas resumidas (`[✓] 1. Criar banco...`), resumos textuais ou stubs vagos. O Izanagi exige a **geração de código real, completo e produtivo** para cada arquivo necessário (Schema Prisma, Rotas de API, Componentes React/Next.js com Tailwind, Middlewares de Auth, README de execução). Cada arquivo deve vir com seu código fonte 100% implementado, sem atalhos.
13. **Style Selector (Design Directions First).** Em todo pedido de site/app/landing, apresente 3-5 direções de design BESPOKE para o nicho antes de codar (skill `design-directions`) e deixe o usuário escolher. Nunca template único.
14. **Anti AI-Slop (Zero "Cara de IA").** Toda UI entregue passa pela auditoria `anti-ai-slop`: ZERO tells (Inter default, gradientes roxo, hero + 3 cards, rounded-2xl uniforme, copy "Build the future"). Escolhas intencionais: tipografia com personalidade, cor dominante + acento afiado, layout assimétrico, motion em 1-2 momentos-chave.
15. **Token Economy Ativa por Padrão.** Contexto mínimo, prompt caching (estático primeiro), sliding window, coordenação por artefatos em disco, zero releituras. Economia em contexto inútil: nunca no entregável.
16. **Anti-Rush & Absolute Fidelity to References (Lei da Fidelidade Absoluta a Referências).** Quando solicitado clonagem, inspiração ou replicação de uma referência visual/técnica (ex: `igloo.inc`), os agentes têm **estritamente proibido** retornar respostas apressadas ou fingir estudo superficial. É obrigatório decompor rigorosamente a estrutura, tipografia, grid, animações e micro-interações da referência e entregar uma obra de excelência artesanal (*High-Craft*) idêntica ou superior.
17. **Zero Falsificação de Pesquisa (Anti-Fake-Research).** Nunca afirme ter estudado ou analisado um site ou documento sem processá-lo com profundidade real. Cada entrega reflete estudo genuíno e maestria técnica.

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
| **Skill Resolver** (`routing/resolver.ts`) | Alias → target (258), parse de frontmatter, scoring por relevância + histórico; `loadAgent` cobre `agents/` + `agents/generated/`. |
| **Skill Scanner** (`security/skill-scanner.ts`) | 11 regras de segurança sobre skills (INJ, DNG, SCR, PER, NET, SEC) com severidade, allowlist e `DEFENSIVE_CONTEXT` (ignora exemplos defensivos/educativos). |
| **Agent Genome** (`agents/*.json`) | 13 campos formais por agente (purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility): preenchidos nos 22 agentes core. |
| **Agent Factory** (`factories/agent-factory.ts`) | Gera novos agentes com genome a partir de requisito: detecção de lacuna vs. 22 core, ID slug, skills requeridas/opcionais, validação e escrita em `agents/generated/`. |
| **Skill Factory** (`factories/skill-factory.ts`) | Cria skills novas com frontmatter, security scan pré-escrita, recusa de lacuna já coberta e escrita em `skills/generated/<name>/SKILL.md`. |
| **Tool Registry** (`tools/registry.ts`) | Tools builtin (fs.read, fs.write, fs.ls) com sandbox de zona (anti path-traversal), permissões least-privilege e fluxo discover → permission → validate → execute. |
| **Model Router** (`model/router.ts`) | Seleção de modelo (claude/gpt/opus...) por custo/latência/contexto com fallback e override por env. |
| **Healing Engine** | `retry` (transitório), `skill_replacement` (artefato inválido), `fallback`, `abort` (limite de tentativas). |
| **Failure Memory** (`memory/store.ts`) | `recordFailure` + `findRelevantFailures` por categoria: erros reais registrados são injetados como evidência em runs futuros (anti-repetição). |
| **Memory Store** (`memory/store.ts`) | Stats por agente, learnings, histórico de runs (JSON em disco). |
| **Trace Store** (`observability/tracer.ts`) | Traces de execução em JSONL com spans, load/close e retry de escrita. |
| **Benchmarks** (`benchmarks/`) | 10 casos builtin (parse, scoring, scanner, genome, composer...) executáveis via `izanagi benchmark` + `compare` entre builds. |
| **LLM Executor** (`llm/`) | Adapters reais OpenAI/Anthropic/Google com env key, timeout e propagação de erro HTTP. |
| **Evidence System** (`research/evidence.ts`) | Claims FACT/ASSUMPTION/INFERENCE/UNKNOWN com fonte, confiança e hierarquia de sourceType (official docs > source code > tests > package metadata > reliable tech > community); relatório de claims críticas. ⚠️ Implementado e testado, mas **nenhum caller em produção** hoje: nem `Orchestrator` nem `planner.ts` o invocam; só o próprio teste do módulo o exercita. Roadmap: ligar à execução do agente `researcher`. |
| **Token Budget 2.0** (`token/budget.ts`) | Orçamento por fase (planning/execution/evaluation/recovery) com tetos, pesos por complexidade e abort de fase: retry consome a fase recovery, nunca o execution. |
| **Policy Engine** (`security/policy.ts`) | Permissão CONTEXTUAL (ambiente dev/ci/produção, trust tier builtin/generated/community): distinto do Skill Scanner (que detecta conteúdo perigoso, não decide permissão). ⚠️ **NÃO está wired em `ToolRegistry.execute()` na prática**: `Orchestrator.executeNode()` chama `opts.produce()` diretamente (que hoje é uma chamada de LLM ou simulação headless), nunca `ToolRegistry`/`PolicyEngine`. O motor e os testes são reais; a aplicação em `izanagi run` ainda não existe: nenhuma garantia de trust-tier/least-privilege documentada aqui se aplica à execução real hoje. |
| **Checkpoint Store** (`recovery/checkpoint.ts`) | Progresso salvo a cada rodada de batches (grafo, artefatos, budget, tentativas); `resumeRunId` retoma sem replanejar nem reexecutar nós concluídos. |
| **Approval Store** (`recovery/approvals.ts`) | Human-in-the-loop real: nó `kind: 'approval'` pausa a execução até `izanagi approve`/`reject`, sem acionar self-healing. |
| **Decision Journal** (`memory/decisions.ts`) | Decisão + alternativas REALMENTE consideradas (com score) + razão + confiança, para model-routing e agent-routing: base do `izanagi explain`. |
| **Artifact Registry** (`artifacts/registry.ts`) | Artefatos rastreáveis: produtor (agent/skill/run/nó), hash, dependências e versão (retry/replan do mesmo nó gera nova versão, não duplicata). |
| **CLI** (`src/cli/`) | Entrypoint `bin/izanagi.js` → `runCLI` (doctor --deep, resume, approve, reject, explain, resolve, export, init, agent create, skill create --gap, workflow, trace, eval, benchmark, memory, diagnose...). |

## Routing: Classificação por Categoria

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
- zero releituras. Economia vale para contexto inútil: nunca para o entregável.

## Quality Gates: Every Output

Todo output passa por gates reais antes de ser considerado entregue:

1. ✅ **Security Gate**: sem segredos no código; `skill-scanner` varre skills por injeção, comandos destrutivos, exfiltração e hardcode (11 regras), ignorando contexto defensivo/educativo.
2. ✅ **Validation Gate**: artefatos validados contra schema (campos obrigatórios + tamanho mínimo); inválido → healing `skill_replacement`.
3. ✅ **Evaluation Gate**: métricas ponderadas + veredito (PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED / **UNKNOWN** quando faltam evidências mensuradas) com recomendações.
4. ✅ **Token Phase Gate**: orçamento por fase (planning/execution/evaluation/recovery): retries consomem a fase recovery e estourar uma fase aborta o ciclo (Token Budget 2.0).
4. ✅ **Style Gate**: segue `RULES.md`: anti-"cara de IA", design directions, high-craft.
5. ✅ **Clarity & Conciseness Gate**: sem fluff; cada frase agrega valor.
6. ✅ **Completeness Gate**: responde a pergunta, sem pontas soltas (Lei da Entrega Exaustiva).

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

Memória entre sessões vive em `.agents/memoria/` (markdown curado). Memória de execução (stats, traces, learnings) vive no runtime (JSON/JSONL): consulte `MemoryStore` e `TraceStore`.

## Evolution Cycle

```
Task → Executar → Avaliar (veredito) → Healing (corrigir) → Logar (stats/learning) → Próxima Task
                ↑                                             │
                └────────── (.agents/memoria/ atualizada) ─────┘
```

Melhoria contínua acontece por: healing registrado (retry/replacement/abort), stats por agente, learnings persistidos e atualização da memória curada do projeto.

## Execution Pipeline (Runtime Adaptativo)

O ciclo completo de execução: `Task → Understanding → Planning → Execution Graph → Evaluation → Self-Healing → Reflection → Memory → Evolution`: é suportado por módulos reais:

1. **Understanding & Planning**: `requirements` decomposição de requisitos (artefatos em `contracts/artifacts.ts`), classificação da tarefa em categoria; Product Reasoner rotula claims de produto (FACT/ASSUMPTION/UNKNOWN) com confiança via Evidence System.
2. **Execution Graph**: o Orchestrator monta um grafo por categoria (11 templates: implementation, testing, debugging, database_design...) com `parallelBatches` (nós independentes em paralelo, nós dependentes em sequência) e hooks de execução (`produce`: agêntico / LLM / comando).
3. **Adaptive Routing**: o resolver pontua skills por relevância + histórico de uso por categoria (scorer com decaimento temporal), nunca lista estática; agents são resolvidos pelo mesmo scoring.
4. **Evaluation**: métricas ponderadas (correctness, completeness, security, performance, requirementCoverage) com thresholds e veredito derivado; sem métricas mensuradas → **UNKNOWN** com recomendação explícita de evidência.
5. **Self-Healing & Classification**: healing classificado (retry para transitório, `skill_replacement` para artefato inválido, fallback de modelo, abort por limite); cada healing é registrado com stats por agente.
6. **Memory & Evolution**: `recordFailure` + `findRelevantFailures` (memória de falhas por categoria), learnings e traces; a memória curada `.agents/memoria/` é atualizada ao fim do ciclo.

Toda rodada de batches persiste um checkpoint (§ Checkpoint & Resume) e cada decisão de roteamento vai para o Decision Journal (§ Decision Journal & Explainability): o pipeline não é só "executa e esquece": o estado intermediário e o motivo de cada escolha ficam rastreáveis.

## Checkpoint & Resume

`src/runtime/recovery/checkpoint.ts` persiste, a cada rodada de batches do Orchestrator, o grafo (status por nó), artefatos, budget gasto por fase, tentativas e tokens. `izanagi resume <run-id>` reconstrói a execução a partir daí: sem replanejar, sem reexecutar nós `succeeded`/`skipped`, reusando o modelo/provider originais. O checkpoint é apagado ao chegar a um veredito terminal (PASS ou FAIL); só sobrevive uma interrupção real (crash) ou uma pausa de aprovação humana.

## Human-in-the-Loop

`GraphNode.kind: 'approval'` pausa a execução (não é falha: não aciona self-healing) até uma decisão humana via `izanagi approve <run-id>` ou `izanagi reject <run-id> --reason="..."`. Decisões ficam no Approval Store (`recovery/approvals.ts`), por run + nó; aprovar retoma normalmente, rejeitar falha o nó com o motivo e segue o fluxo normal de healing/abort a partir daí.

## Decision Journal & Explainability

`src/runtime/memory/decisions.ts` registra cada decisão de roteamento (model-routing, agent-routing) com a opção escolhida, as alternativas REALMENTE consideradas (com score) e a confiança (derivada da distância entre a escolhida e a melhor concorrente). `izanagi explain <run-id>` junta o journal + o self-healing + o veredito do trace para responder "por que o Izanagi decidiu isso": só metadados/razões estruturadas, nunca chain-of-thought.

## Artifact Registry

`src/runtime/artifacts/registry.ts` torna artefatos rastreáveis além do `Map` efêmero de `ExecuteCtx`: cada nó bem-sucedido vira um registro com produtor (agent/skill/run/nó), hash, dependências (artefatos upstream) e versão: retry/replan do mesmo nó gera nova versão, não uma duplicata perdida.

## Policy Engine

`src/runtime/security/policy.ts` responde "isso é permitido NESTE CONTEXTO?": distinto do Skill Scanner, que responde "isso parece perigoso?". A mesma permissão pode ser negada em produção e liberada em desenvolvimento, ou negada para uma skill de trust tier `community` e liberada para `builtin`. Regras default: deploy de produção e operações destrutivas em produção exigem aprovação humana; `community` nunca recebe `fs:write`/`shell` por default.

⚠️ **Estado real (2026-08-15): motor completo e testado (`src/runtime/tests/tools.test.ts`), mas órfão em produção.** `Orchestrator.executeNode()` (`src/runtime/orchestrator.ts`) chama `opts.produce(node, ctx)` diretamente: o producer de `src/cli/commands/run.ts` fala com o LLM ou simula sem tocar `ToolRegistry`/`PolicyEngine` em nenhum ponto. Ou seja: nada do que `izanagi run` executa hoje passa por este gate. Antes de confiar nesta camada como fronteira de segurança real, ela precisa ser conectada ao caminho de execução (roadmap), ou qualquer efeito colateral de tool/filesystem que o producer vier a fazer precisa ser roteado por `ToolRegistry.execute()` explicitamente.

## Agent Factory & Skill Factory

Novos agentes e skills são **gerados, não escritos à mão**:

- `izanagi agent create "<requisito>" [--name=slug] [--skills=a,b]`: o Agent Factory detecta lacuna vs. os 22 agentes core (recusa se o core já cobre), deriva ID slug, mapeia skills requeridas/opcionais, monta o genome completo (purpose, capabilities, inputs, outputs, handoffs, memory, evaluation, tokenBudget, compatibility), valida e escreve em `agents/generated/<id>.json`: descoberto automaticamente por `loadAgent`/`agent list`.
- `izanagi skill create <nome> --gap="<descrição>" [--force]`: o Skill Factory recusa lacunas já cobertas, gera `skills/generated/<nome>/SKILL.md` com frontmatter de manifesto (name, description, version, compatibility, triggers, token_budget), roda o security scanner antes da escrita e só persiste com severidade LOW.

## Benchmarks & Regression

`izanagi benchmark` executa 10 casos builtin (resolver parse, scoring, skill scanner, genome, composer, artifact validation...); `izanagi benchmark compare` mede regressões entre builds (ex.: `2.9.6 → 2.10.0`) com delta por caso.

## Model Router

`src/runtime/model/router.ts` seleciona o modelo por custo/latência/contexto (claude/gpt/opus...), com fallback em cadeia e override por env (`IZANAGI_MODEL`). O token budget de cada agente é declarado no genome e respeitado pelo runtime.

## Tool Registry (Tools/MCP-ready)

`src/runtime/tools/registry.ts` expõe tools builtin (`fs.read`, `fs.write`, `fs.ls`) atrás de um fluxo `discover → permission → validate → execute`: sandbox de zona (bloqueia path traversal via `..`), permissões least-privilege por tool, e schemas prontos para exposição a agentes externos (MCP-ready).

## Doctor

`izanagi doctor` audita integridade (SYSTEM.md/RULES.md, JSONs de agentes, aliases do resolver → targets); `izanagi doctor --deep` adiciona memória/traces/benchmarks, a varredura de segurança das skills com `DEFENSIVE_CONTEXT` (exemplos educativos de segurança não são falsos positivos), manifesto de skills e a distribuição de skill lifecycle. `izanagi diagnose` cobre o mesmo terreno de runtime com foco em investigação de execução (agent genome, contratos de artifact): os checks são computados uma vez só (`src/cli/checks.ts`), sem duplicação entre os dois comandos.

## Versioning

Versionamento **SemVer** gerenciado pelo npm (`npm run bump:patch|minor|major` + `npm publish`; versão atual no `package.json`).

- **Major**: quebra de contrato de skills, agentes ou runtime.
- **Minor**: novas skills, agentes, módulos: compatível com versões anteriores.
- **Patch**: correções, otimização, documentação.

## Frontmatter de Skills (Compatibility)

Skills com `SKILL.md` declararam (quando aplicável) metadados no frontmatter:

- `name`
- `description` (usado no scoring/resolução)
- `version`
- `lifecycle` (discovered/draft/validated/active/deprecated/archived: default `active` quando ausente)
- `compatibility` (versão mínima do framework)
- `triggers`
- `token_budget`

O resolver **tolera** skills sem frontmatter (parse devolve `{}` e segue resolvendo pelo alias); metadados apenas aumentam a qualidade do scoring. **Só `name` e `description` são exigidos**: o mesmo mínimo do padrão aberto [agentskills.io](https://www.agensi.io/learn/skill-md-specification-open-standard), o que torna as skills do Izanagi portáveis para qualquer ferramenta compatível (Cursor, Copilot, Codex, VS Code...) sem modificação.

### Skill Lifecycle

```
DISCOVERED → DRAFT → VALIDATED → ACTIVE → DEPRECATED → ARCHIVED
```

Skills curadas do framework nascem `active`. Skills geradas pela Skill Factory (`izanagi skill create`) nascem `draft`: passaram no security scan mas não têm histórico de uso real; promoção a `active` é uma decisão separada (nunca "Generate → Automatically trust"). `izanagi skill list`/`inspect` mostram o estado; `doctor --deep`/`diagnose` reportam a distribuição.

---

> "Architecture is the art of making decisions that matter."
