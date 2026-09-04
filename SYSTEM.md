# IZANAGI AI: System Foundation

> Version 3.18.0
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
│  Memory & Observability    │ ← MemoryStore (JSON), TraceStore (JSON por run),
│                            │   .agents/memoria/ persistente
└─────────────┬──────────────┘
              ▼
           Output / Relatório
```

## Core Modules (runtime real em `src/runtime/`)

| Module | Responsibility |
|--------|---------------|
| **Commander** (`orchestration/commander.ts`) | LEVEL 0. Classifica complexidade (1 a 5) e domínios, escolhe o modo (direct/assisted/orchestrated/autonomous), gera um Task Contract por tarefa com critérios de aceite derivados do schema real do artefato, estima custo e degrada o modo quando o teto de custo seria estourado. Determinístico: planejar não gasta token. |
| **Task Contract** (`contracts/task-contract.ts`) | Objetivo, papel (commander/specialist/worker), insumos por referência, restrições, saída esperada, dependências, orçamento (tokens/tempo/tool calls/custo), política de verificação e critérios de aceite. Anexado em `node.metadata.contract`. |
| **Orchestrator** (`orchestrator.ts`) | Executa o plano do Commander (ou o grafo legado por categoria), roteia cada nó pelo PAPEL, escala o papel na retentativa, verifica contra o contrato, aplica early stopping em tarefas opcionais e persiste telemetria de economia no trace. |
| **Context Resolver** (`orchestration/context-resolver.ts`) | Contexto mínimo por tarefa: objetivo, restrições e SÓ os artefatos dos quais ela depende, resumidos (começo + fim preservados) e referenciados por id. |
| **Agent Capability Registry** (`registry/capabilities.ts`) | Descoberta de agentes em disco com capacidades, skills, chains, classe de custo, papel e domínios. Matching bilíngue por domínio, no lugar da lista fixa de agentes. |
| **Agent-to-Agent Protocol** (`protocol/messages.ts`) | Mensagens tipadas com referência de artefato em vez de cópia de texto; crítica estruturada com parsing tolerante (saída não parseável vira `needs_revision`, nunca aprovação) e correção mínima só dos bloqueantes. |
| **Verification Engine 2.0** (`verification/engine.ts`) | Três camadas: determinística, evidência e semântica. O juiz semântico default (`verification/judge.ts`) vem ligado na CLI e no SDK quando há provider, roda no papel `worker` e recebe o artefato resumido; sem juiz (`--no-judge` ou modo headless) o critério fica `UNVERIFIED` e NUNCA conta como aprovação. Juiz que não respondeu é `inconclusive`, nunca reprovação. Só `VERIFIED` encerra uma tarefa. |
| **Budget Controller** (`token/execution-budget.ts`) | Custo em USD, tetos de tool call/agente/retry, tempo de parede e escada de degradação (contexto → saída → modelo → paralelismo → tarefas opcionais → aprovação humana). Gasto que estouraria um teto é recusado, e **registrado antes de ser recusado**: gasto recusado por teto ainda aconteceu na fatura. Desde 2026-09-04 `maxRetries` e `maxAgents` de fato BARRAM (antes contavam e o retorno era descartado), e `remainingTokens` alimenta o roteamento por nó. Teto estourado é `non-recoverable` no `Healer`: um teto não se move entre tentativas, então retentar é gastar orçamento numa porta fechada. |
| **Response Cache** (`cache/response-cache.ts`) | Cache local por hash de (provider, modelo, system, mensagens, teto, temperatura), com TTL, eviction e versão de esquema. Opt-in (`--cache` / `IZANAGI_CACHE=1`). |
| **SDK** (`src/sdk.ts`) | `izanagi.run({ objective })` e `izanagi.plan({ objective })`: mesma engine da CLI, sem saída no terminal, com eventos do run em tempo real. |
| **Evaluation Engine** (`evaluation/`) | Métricas ponderadas (correctness, completeness, security, etc.), veredito derivado, relatório com regressões e recomendações. |
| **Artifact Contracts** (`contracts/artifacts.ts`) | 10+ schemas de artefato (requirements, architecture, database-schema, test-plan...) com validação por campos obrigatórios + tamanho mínimo, em PT-BR. |
| **Skill Resolver** (`routing/resolver.ts`) | Alias → target (258), parse de frontmatter, scoring por relevância + histórico; `loadAgent` cobre `agents/` + `agents/generated/`. |
| **Skill Scanner** (`security/skill-scanner.ts`) | 10 regras de segurança sobre skills (INJ x3, DNG x4, NET x2, SEC x1) com severidade, allowlist e `DEFENSIVE_CONTEXT` (ignora exemplos defensivos/educativos). |
| **Agent Genome** (`agents/*.json`) | campos formais por agente, preenchidos nos 22 core: `name`, `role`, `capabilities`, `skills`, `optionalSkills`, `chains`, `inputs`, `outputs`, `always`/`never`, `permissions`, `handoffs`, `memory`, `evaluation`, `token_budget`, `model`. Desde 2026-09-04 o `AgentCapabilityRegistry` também expõe `modelHint`, `declaredPermissions` e `evaluation` (antes descartados no parse). **`declaredPermissions` é prosa do autor do agente, NÃO a concessão de permissão do runtime:** o que autoriza uma tool é `TaskContract.permissions` no formato `fs:read`/`fs:write`/`shell`. |
| **Agent Factory** (`factories/agent-factory.ts`) | Gera novos agentes com genome a partir de requisito: detecção de lacuna vs. 22 core, ID slug, skills requeridas/opcionais, validação e escrita em `agents/generated/`. |
| **Skill Factory** (`factories/skill-factory.ts`) | Cria skills novas com frontmatter, security scan pré-escrita, recusa de lacuna já coberta e escrita em `skills/generated/<name>/SKILL.md`. |
| **Tool Registry** (`tools/registry.ts`) | Seis tools builtin (`fs.read`, `fs.write`, `fs.ls`, `project.survey`, `project.materialize`, `code.execute`) com sandbox de zona (anti path-traversal), permissões least-privilege e fluxo discover → permission → policy → validate → execute. Desde a v3.18.0 o planejamento gera três nós de tool (`survey`, `materialize`, `deliver`), então o fluxo é atravessado por um `izanagi run` comum. Desde 2026-09-04 existe uma camada acima da permissão: `allowedTools` (no `Orchestrator`, no SDK e por caso de benchmark) é a allowlist do RUN INTEIRO, conferida antes da permissão do contrato e da política. A permissão diz o que a TAREFA pode fazer; a allowlist diz o que este run pode usar, sem depender de nenhum contrato estar correto. Lista vazia proíbe toda tool; ausência é "sem allowlist". |
| **Deadline e cancelamento** (`orchestration/deadline.ts`) | **Prazo:** aplica `node.timeoutMs` e `TaskContract.budget.maxTimeMs` (vale o MENOR dos dois). Todo o planejamento declarava prazo por nó e nada lia: um provider pendurado travava o nó até o timeout HTTP do cliente, e uma tool externa sem cliente HTTP travava indefinidamente. Ausência, zero e negativo significam "sem prazo", nunca "prazo zero". Prazo estourado tira o nó do caminho do grafo e é **retentável**. **Cancelamento:** `OrchestratorOptions.signal` é conferido no topo de cada batch e desce até a requisição (combinado com o timeout HTTP via `AbortSignal.any`), então a chamada em voo aborta de verdade; sinal já abortado recusa a chamada antes de gastá-la. Cancelamento é do RUN, é `non-recoverable` (curar seria desobedecer quem cancelou) e **preserva o checkpoint**: apagá-lo tornaria `izanagi resume` impossível no único caso em que ele é claramente o que se quer. Na CLI, Ctrl-C cancela em vez de matar o processo; um segundo Ctrl-C força a saída (exit 130). |
| **Model Router** (`model/router.ts`) | Catálogo por provider + `routeForRole` (tier por papel: commander→premium, specialist→balanced, worker→fast), pin por papel via config/env, escalada worker→specialist→commander e custo real em USD. `route()` legado preservado. |
| **Healing Engine** | `retry` (transitório), `skill_replacement` (1ª reprovação de validação), `replan` (2ª reprovação de validação, ou falha de planejamento), `handoff`, `abort` (limite de tentativas, ou teto de run estourado: teto não se cura tentando de novo). |
| **Failure Memory** (`memory/store.ts`) | `recordFailure` + `findRelevantFailures` por categoria: erros reais registrados são injetados como evidência em runs futuros (anti-repetição). |
| **Memory Store** (`memory/store.ts`) | Stats por agente, learnings, histórico de runs (JSON em disco). |
| **Trace Store** (`observability/tracer.ts`) | Traces de execução em JSON (um arquivo por run em `.izanagi/state/traces/`) com spans, load/close e retry de escrita. |
| **Benchmarks** (`benchmarks/`) | 10 casos builtin executáveis via `izanagi benchmark` + `compare` entre builds, mais o Token Benchmark (`benchmark tokens`): legado vs Commander em chamadas, tokens e custo, de forma determinística. |
| **LLM Executor** (`llm/`) | Adapters reais OpenAI/Anthropic/Google com env key, timeout e propagação de erro HTTP. |
| **Evidence System** (`research/evidence.ts`) | Claims FACT/ASSUMPTION/INFERENCE/UNKNOWN com fonte, confiança e hierarquia de sourceType (official docs > source code > tests > package metadata > reliable tech > community); relatório de claims críticas. ⚠️ Implementado e testado, mas **nenhum caller em produção** hoje: nem `Orchestrator` nem `planner.ts` o invocam; só o próprio teste do módulo o exercita. Roadmap: ligar à execução do agente `researcher`. |
| **Token Budget 2.0** (`token/budget.ts`) | Orçamento por fase (planning/execution/evaluation/recovery) com tetos, pesos por complexidade e abort de fase: retry consome a fase recovery, nunca o execution. |
| **Policy Engine** (`security/policy.ts`) | Permissão CONTEXTUAL (ambiente dev/ci/produção, trust tier builtin/generated/community): distinto do Skill Scanner (que detecta conteúdo perigoso, não decide permissão). **Está no caminho de `izanagi run` desde a v3.15.0**: um nó `kind: 'tool'` (contrato com `tool: { id, input }`) roteia por `ToolRegistry`, que checa a permissão declarada em `TaskContract.permissions`, consulta a `PolicyEngine` e só então executa dentro da sandbox. Contrato sem `permissions` não executa tool nenhuma. O trust tier vem da ORIGEM do arquivo do agente (`agents/generated/` → generated, `.agents/` → community, resto → builtin), nunca do que o agente declara sobre si; agente desconhecido é tratado como `community`. Desde a v3.16.0 a `ToolRegistry` inclui `code.execute`, que roda script em processo isolado com o Permission Model do Node (filesystem restrito ao diretório de trabalho, subprocessos/workers/addons bloqueados, ambiente montado do zero, timeout com kill). **Rede NÃO é isolada** — o Permission Model não cobre rede, e existe um teste que mede esse limite; a mitigação é a permissão `shell`, que a política nega a `generated` e `community`. Desde a v3.18.0 o **planejamento** gera três nós de tool (`survey`, `materialize`, `deliver`), então o gate é atravessado por um `izanagi run` comum; nós de agente seguem chamando o modelo por `opts.produce()` e não recebem permissão nenhuma. |
| **Checkpoint Store** (`recovery/checkpoint.ts`) | Progresso salvo a cada rodada de batches (grafo, artefatos, budget, tentativas); `resumeRunId` retoma sem replanejar nem reexecutar nós concluídos. |
| **Approval Store** (`recovery/approvals.ts`) | Human-in-the-loop real: nó `kind: 'approval'` pausa a execução até `izanagi approve`/`reject`, sem acionar self-healing. |
| **Decision Journal** (`memory/decisions.ts`) | Decisão + alternativas REALMENTE consideradas (com score) + razão + confiança, para model-routing e agent-routing: base do `izanagi explain`. |
| **Artifact Registry** (`artifacts/registry.ts`) | Artefatos rastreáveis: produtor (agent/skill/run/nó), hash, dependências e versão (retry/replan do mesmo nó gera nova versão, não duplicata). |
| **CLI** (`src/cli/`) | Entrypoint `bin/izanagi.js` → `runCLI` (doctor --deep, resume, approve, reject, explain, resolve, export, init, agent create, skill create --gap, workflow, trace, eval, benchmark, memory, diagnose...). |

## Routing: Classificação por Categoria

O runtime mapeia a categoria da tarefa para um template de grafo + cadeia de skills (compositions em `core/skill-resolver.json`):

```
implementation  → [execute, verify, evaluation]
testing         → [test-plan, execution, critic, evaluation]
debugging       → [reproduce, root-cause, fix, regression-test, evaluation]
database_design → [requirements, schema, optimize, review, evaluation]
```

Categorias sem template específico usam o fluxo genérico (analisar → planejar → executar → avaliar). A cadeia completa de skills de cada domínio é definida pelas `compositions` do resolver.

## Modos de Execução

O modo é proporcional ao problema, decidido pelo Commander (override com `--mode`):

| Modo | Gatilho | Forma | Tentativas |
|---|---|---|---|
| `direct` | complexidade 1, no máximo 1 domínio | 1 tarefa, sem grafo, sem crítica, sem avaliador | 1 |
| `assisted` | complexidade 2 | 1 especialista + gate determinístico | 1 |
| `orchestrated` | complexidade 3 a 4 | template do domínio, sem a cauda opcional (crítica) | 2 |
| `autonomous` | complexidade 5 ou 3+ domínios | template completo + healing + replan + verificação final | 3 |

Um teto `--max-cost` faz o plano DEGRADAR de modo (autonomous → orchestrated → assisted → direct) em vez de estourar o orçamento em silêncio, e a degradação fica registrada nas decisões do run. Modo forçado pelo usuário nunca degrada sozinho.

### Inteligência assimétrica

`commander` (tier premium) planeja e coordena; `specialist` (balanced) executa; `worker` (fast) faz extração, formatação e validação. Cada nó é roteado pelo seu papel, não pelo run. Uma retentativa ESCALA o papel em vez de repetir o mesmo modelo que já falhou. Pin por papel em `.izanagi/izanagi.config.json` → `roles`, ou por env `IZANAGI_MODEL_{COMMANDER,SPECIALIST,WORKER}`.

### Early stopping

Uma tarefa marcada como opcional (crítica adversarial, revisão redundante) é pulada quando TODAS as suas dependências terminaram `VERIFIED`. A decisão é local: um nó obrigatório ainda pendente adiante no grafo não é motivo para rodar uma crítica sobre algo já comprovado.

## Token Economy

Não há "compression engine" mágico: a economia de tokens é uma **skill operacional** (`skills/economia-tokens`) aplicada a toda sessão:

- contexto mínimo: carregar só o que mudou; trechos/diffs em vez de arquivos completos;
- prompt caching (conteúdo estático primeiro, dinâmico por último);
- coordenação entre agentes por **artefatos em disco**, nunca payloads gigantes em contexto;
- zero releituras. Economia vale para contexto inútil: nunca para o entregável.

Além da skill, o runtime aplica mecanismos determinísticos e mensuráveis:

| Mecanismo | Onde | Efeito |
|---|---|---|
| Modo proporcional | `orchestration/commander.ts` | tarefa trivial deixa de virar grafo de 3 a 9 nós |
| Roteamento por papel | `model/router.ts` | worker não paga preço de commander |
| Contexto mínimo | `orchestration/context-resolver.ts` | insumos resumidos e por referência, nunca o run inteiro |
| Early stopping | `orchestrator.ts` | tarefa opcional não roda quando o objetivo já está VERIFIED |
| Cache local | `cache/response-cache.ts` | execução idêntica não repaga a chamada (opt-in) |
| Prompt caching (CAPC) | `llm/prompt-cache.ts` | prefixo estático byte-idêntico entre nós do run |
| Observation masking | `llm/session-diet.ts` | observações antigas viram resumo de 1 linha |
| Escada de degradação | `token/execution-budget.ts` | sob pressão de orçamento, degrada em ordem em vez de estourar |

A telemetria de cada run (`izanagi budget <run-id>`) reporta tokens de entrada/saída, custo estimado, hits de cache local e do provider, chars de contexto poupados, tarefas paralelas, escaladas de modelo, retries e passos de degradação aplicados.

## Quality Gates: Every Output

Todo output passa por gates reais antes de ser considerado entregue (os heurísticos anti-slop/anti-racionalização também rodam como engine Rust em `crates/izanagi_core`: contratos e integração em `docs/POLYGLOT.md`):

1. ✅ **Security Gate**: sem segredos no código; `skill-scanner` varre skills por injeção, comandos destrutivos, exfiltração e hardcode (10 regras), ignorando contexto defensivo/educativo.
2. ✅ **Validation Gate**: artefatos validados contra schema (campos obrigatórios + tamanho mínimo); inválido → healing `skill_replacement`.
3. ✅ **Evaluation Gate**: métricas ponderadas + veredito (PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED / **UNKNOWN** quando faltam evidências mensuradas) com recomendações.
4. ✅ **Token Phase Gate**: orçamento por fase (planning/execution/evaluation/recovery): retries consomem a fase recovery e estourar uma fase aborta o ciclo (Token Budget 2.0).
5. ✅ **Style Gate**: segue `RULES.md`: anti-"cara de IA", design directions, high-craft.
6. ✅ **Clarity & Conciseness Gate**: sem fluff; cada frase agrega valor.
7. ✅ **Completeness Gate**: responde a pergunta, sem pontas soltas (Lei da Entrega Exaustiva).

## Memory Architecture

```
┌────────────────────────────────────────────┐
│              Memory Store (runtime)         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Agent    │  │Learnings │  │  Runs/   │ │
│  │ Stats    │  │ (erros   │  │  Trace   │ │
│  │ (JSON)   │  │  evitados)│  │ (JSON)   │ │
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

Memória entre sessões vive em `.agents/memoria/` (markdown curado). Memória de execução (stats, traces, learnings) vive no runtime (JSON em disco): consulte `MemoryStore` e `TraceStore`.

## Evolution Cycle

```
Task → Executar → Avaliar (veredito) → Healing (corrigir) → Logar (stats/learning) → Próxima Task
                ↑                                             │
                └────────── (.agents/memoria/ atualizada) ─────┘
```

Melhoria contínua acontece por: healing registrado (retry/replacement/abort), stats por agente, learnings persistidos e atualização da memória curada do projeto.

## Execution Pipeline (Runtime Adaptativo)

O ciclo completo de execução: `Objetivo → Classificação → Modo → Task Contracts → Roteamento por papel → Execution Graph → Contexto mínimo → Verificação → Self-Healing → Reflection → Memory → Evolution`: é suportado por módulos reais:

0. **Commander**: classifica complexidade e domínios, escolhe o modo, gera um contrato por tarefa com critérios de aceite verificáveis e estima o custo do plano ANTES de qualquer chamada de modelo. Sem plano do Commander (`--no-commander`, ou uso direto do Orchestrator), tudo abaixo segue exatamente o caminho legado.


1. **Understanding & Planning**: `requirements` decomposição de requisitos (artefatos em `contracts/artifacts.ts`), classificação da tarefa em categoria; Product Reasoner rotula claims de produto (FACT/ASSUMPTION/UNKNOWN) com confiança via Evidence System.
2. **Execution Graph**: o Orchestrator monta um grafo por categoria (10 templates: fullstack, debugging, security_audit, architecture, automacao, frontend, implementation, database_design, devops_infra, testing) com `parallelBatches` (nós independentes em paralelo, nós dependentes em sequência) e hooks de execução (`produce`: agêntico / LLM / comando).
3. **Adaptive Routing**: o resolver pontua skills por relevância + histórico de uso por categoria (scorer com decaimento temporal), nunca lista estática; agents são resolvidos pelo mesmo scoring.
4. **Verification & Evaluation**: cada artefato é verificado contra os critérios de aceite do contrato (determinística → evidência → semântica) e só `VERIFIED` encerra a tarefa; `UNVERIFIED` é reportado como inconclusivo, nunca como sucesso. O nó em si SEGUE (sem juiz semântico todo critério semântico fica inconclusivo, e derrubar o nó transformaria "não medi" em "está errado"), mas desde 2026-09-04 ele carrega `metadata.unverified` com status, motivo e critérios não comprovados, mais uma mensagem A2A de tipo `evidence`: aprovado sem prova é distinguível de comprovado. A avaliação final agrega métricas ponderadas com thresholds e veredito derivado; sem métricas mensuradas → **UNKNOWN** com recomendação explícita de evidência.
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

## As três raízes (assets, workspace, estado)

Um único `baseDir` respondia três perguntas diferentes, e as três divergem num projeto que não rodou `izanagi init`. Rodando de dentro do checkout do framework elas coincidem — e é exatamente por isso que a confusão sobreviveu tanto tempo.

| Raiz | Pergunta que responde | Resolução | O que vive lá |
|---|---|---|---|
| `baseDir` | De onde leio os assets do framework? | `resolveFrameworkRoot(cwd)`: `<projeto>/.agents` se inicializado, senão a **instalação do pacote** | agentes, skills, `RULES.md`, `SYSTEM.md`, casos de benchmark, referências |
| `workspaceDir` | Qual é o projeto sobre o qual estou trabalhando? | `process.cwd()` na CLI; `baseDir` no SDK | sandbox de tool (`fs.read`/`fs.write`/`project.survey`), raiz do check `file-exists`, destino de `--output` |
| `stateDir` | Onde vive o estado DESTE projeto? | `resolveStateRoot(cwd)`: `<projeto>/.agents` se inicializado, senão o **próprio projeto** | `.izanagi/state`: traces, artefatos com conteúdo, memória, checkpoints, aprovações, decisões |

Os dois bugs que essa confusão produziu, ambos corrigidos na v3.18.0:

- **Tool lia dentro de `.agents/`, não do projeto.** Um nó `fs.read` com caminho relativo resolvia contra a raiz de assets, e o check `file-exists` procurava o arquivo no lugar errado.
- **Estado vazava entre projetos.** Sem `izanagi init`, trace, artefato **com conteúdo**, memória e checkpoint iam para dentro de `node_modules/izanagi-ai/`, compartilhados com todos os outros projetos na mesma condição: `izanagi trace` listava execução alheia, e `npm update` apagava o histórico.

Ambos os campos novos têm default `baseDir`, então nenhum caller existente do `Orchestrator` mudou de comportamento — quem declara o valor certo é a CLI e o SDK. E projeto inicializado não mudou de lugar: mover o estado apagaria o histórico de quem já usa.

## Policy Engine

`src/runtime/security/policy.ts` responde "isso é permitido NESTE CONTEXTO?": distinto do Skill Scanner, que responde "isso parece perigoso?". A mesma permissão pode ser negada em produção e liberada em desenvolvimento, ou negada para uma skill de trust tier `community` e liberada para `builtin`. Regras default: deploy de produção e operações destrutivas em produção exigem aprovação humana; `community` nunca recebe `fs:write`/`shell` por default.

**Estado real (2026-09-02, v3.18.0): no caminho de execução, e exercitado.** A ressalva anterior — motor completo, testado e órfão em produção — valeu até a v3.15.0, quando `Orchestrator.executeNode()` passou a rotear nó `kind: 'tool'` por `ToolRegistry`. Desde a v3.18.0 o **planejamento** gera três desses nós, então o gate é atravessado por um `izanagi run` comum:

| Nó | Quando | Permissão concedida | Efeito |
|---|---|---|---|
| `survey` | default num diretório com manifesto reconhecido (`--no-survey` desliga) | `fs:read` | Levanta a forma do projeto na cabeça do grafo |
| `materialize` | `--output <dir>`, e só quando o plano produz artefato capaz de carregar código | `fs:write` | Escreve os arquivos declarados pelo agente em `<output>/<slug>/` |
| `deliver` | `--output <dir>` | `fs:write` | Grava a entrega do run dentro do projeto |

Menor privilégio permanece verificado, e não presumido: nenhum nó de agente recebe permissão nenhuma, e existe teste que percorre o plano inteiro conferindo isso nó a nó. Os nós de tool do planejamento não declaram agente, então o trust tier é `builtin` — quem declarou a tool foi o planejamento do próprio framework, e não um agente que afirmou algo sobre si.

A raiz da sandbox é `workspaceDir` (raiz do PROJETO), não `baseDir` (raiz do FRAMEWORK: `<projeto>/.agents`, ou a instalação do pacote). Até a v3.18.0 as duas eram a mesma coisa no código, e um nó `fs.read` lia dentro de `.agents/` em vez do projeto — rodando de dentro do checkout do framework elas coincidem, que é por que o erro passava despercebido.

## Agent Factory & Skill Factory

Novos agentes e skills são **gerados, não escritos à mão**:

- `izanagi agent create "<requisito>" [--name=slug] [--skills=a,b]`: o Agent Factory detecta lacuna vs. os 22 agentes core (recusa se o core já cobre), deriva ID slug, mapeia skills requeridas/opcionais, monta o genome completo (purpose, capabilities, inputs, outputs, handoffs, memory, evaluation, tokenBudget, compatibility), valida e escreve em `agents/generated/<id>.json`: descoberto automaticamente por `loadAgent`/`agent list`.
- `izanagi skill create <nome> --gap="<descrição>" [--force]`: o Skill Factory recusa lacunas já cobertas, gera `skills/generated/<nome>/SKILL.md` com frontmatter de manifesto (name, description, version, compatibility, triggers, token_budget), roda o security scanner antes da escrita e só persiste com severidade LOW.

## Benchmarks & Regression

`izanagi benchmark` executa 10 casos builtin (resolver parse, scoring, skill scanner, genome, composer, artifact validation...); `izanagi benchmark compare` mede regressões entre builds (ex.: `2.9.6 → 2.10.0`) com delta por caso. `benchmark run --execute` roda cada caso pelo runtime real; desde 2026-09-04 um caso pode declarar `budget`, `mode` e `allowedTools`, e o teto passa a ser IMPOSTO na execução em vez de apenas observado no relatório (antes, um caso resolvido com dez vezes o orçamento passava igual).

## Model Router

`src/runtime/model/router.ts` mantém um catálogo por provider (OpenAI, Anthropic, Google, OpenRouter, Ollama, LM Studio, custom) extensível via `.izanagi/izanagi.config.json` → `models`. Duas rotas coexistem:

- `route(ctx)`: rota legada, um modelo para o run inteiro, por complexidade/custo/latência/histórico. Preservada sem mudança de assinatura.
- `routeForRole(role, ctx)`: rota por PAPEL. Tier preferido por papel (commander→premium, specialist→balanced, worker→fast), com queda explícita para o tier adjacente quando o catálogo disponível não tem aquele tier. Pin por papel via `roles` na config ou `IZANAGI_MODEL_{COMMANDER,SPECIALIST,WORKER}` (env vence config). `escalateRole` sobe worker→specialist→commander e para no topo. `costUsd` e `estimateCostForRole` dão o custo real de catálogo (modelos self-hosted declaram 0, o que é fato, não estimativa).

`izanagi models` mostra o catálogo, quais providers estão realmente configurados e qual modelo cada papel receberia agora, com custo por 10k tokens.

## Tool Registry (Tools/MCP-ready)

`src/runtime/tools/registry.ts` expõe tools builtin atrás de um fluxo `discover → permission → policy → validate → execute`: sandbox de zona (bloqueia path traversal via `..`), permissões least-privilege por tool, e schemas prontos para exposição a agentes externos (MCP-ready).

| Tool | Permissão | O que faz |
|---|---|---|
| `fs.read` / `fs.ls` | `fs:read` | Lê arquivo / lista diretório dentro da zona permitida |
| `fs.write` | `fs:write` | Grava arquivo (cria diretórios), com Unicode Hygiene aplicada antes |
| `project.survey` | `fs:read` | Levanta stack, manifestos, árvore por extensão, entrypoints e começo do README. Conta e lista; **não abre arquivo de código**, e o script do `package.json` entra pelo NOME e nunca pelo comando |
| `project.materialize` | `fs:write` | Escreve os arquivos declarados num manifesto de agente (`### FILE: <caminho>` + bloco de código). Tudo ou nada, e só dentro do diretório de saída |
| `code.execute` | `shell` | Script Node ESM em processo isolado (Permission Model). Rede **não** é isolada, e a política nega `shell` a `generated`/`community` |

### Materialização (`tools/file-manifest.ts`)

O Blueprint Engine (`cli/blueprint.ts`) já definia o contrato de materialização — declare a árvore, escreva cada arquivo completo, zero stub — mas só em `--prompt-only`, isto é, num texto para a pessoa colar em outra ferramenta. Dentro do runtime o contrato não existia: o agente entregava código dentro de um artefato de texto, e o texto ia para o content store.

Agora o `TaskContract` de um nó que produz artefato capaz de carregar código PEDE o formato, e o parser reconhece exatamente ele:

```
### FILE: src/routes/pagination.ts
```ts
export function paginate(page: number) { ... }
```
```

Três decisões que definem o comportamento:

- **Nunca por cima da fonte.** Os arquivos vão para `<output>/<slug do objetivo>/`. O que o runtime produz fica num lugar que o usuário nomeou e pode revisar, apagar ou copiar. Aplicar sobre o código do projeto exigiria uma garantia que nenhuma verificação determinística consegue dar hoje.
- **Tudo ou nada.** A validação roda sobre o manifesto INTEIRO antes de qualquer escrita. Materialização parcial que se declara concluída é a desonestidade que a verificação por evidência existe para impedir: o usuário veria "6 arquivos escritos" sem saber que 3 foram recusados.
- **Só o formato combinado.** Inferir caminho do texto ao redor ou do nome da linguagem na cerca seria adivinhar o destino de um arquivo que vai ser gravado — e esse erro só aparece depois de gravado.

Recusas: caminho absoluto (o destino é de quem executa, não do agente), escape de diretório, caminho declarado duas vezes, arquivo vazio, marca de trabalho não feito (`TODO`/`FIXME`/`implement later`), e os tetos de 60 arquivos / 256KB por arquivo / 2MB no total.

### Groundedness (`verification/groundedness.ts`)

O check determinístico `references-exist` responde uma pergunta que o schema não faz: **o artefato corresponde a alguma realidade?** Um plano bem formatado, com todos os campos obrigatórios e tamanho de sobra, citando `app/controllers/users_controller.rb` num projeto sem `app/`, passava em tudo.

A fronteira que dá valor à checagem é o que ela NÃO pergunta. Não é "todos os arquivos citados existem?" — um plano legítimo propõe arquivos novos, e reprovar isso viraria ruído contra exatamente o trabalho que se quer. É **"o LUGAR citado existe?"**: `src/routes/pagination.ts` num projeto com `src/routes/` é proposta; `app/controllers/users.rb` num projeto sem `app/` é layout inventado.

- **Extração conservadora**: exige separador de diretório E extensão conhecida. `GET /users` é rota e não entra; `package.json` sem diretório não entra. Precisão importa mais que cobertura — reprovar um caminho legítimo faz o usuário desconfiar da verificação inteira, e o estado anterior era não checar nada.
- **Resolve contra a raiz E contra cada diretório de primeiro nível.** Gente e modelo escrevem caminho relativo à raiz de FONTE (`runtime/x.ts` para `src/runtime/x.ts`). Sem isso, o `docs/HANDOFF.md` deste próprio repositório saía com 0 de 17 caminhos fundamentados.
- **Piso de 0.5**: o artefato legítimo mistura o que existe com o que propõe criar. Abaixo de metade não é mistura, é outro projeto.
- **Sem referência nenhuma → `NOT-APPLICABLE`**, um outcome distinto de `UNKNOWN`. A diferença não é cosmética: `unknown` é "havia uma pergunta e a resposta não foi obtida" (juiz ausente) e nunca vira aprovação; `not-applicable` é "a pergunta não existe para este artefato" — uma ADR que não cita arquivo nenhum não está sem resposta, está respondida por vacuidade. Tratar o segundo como o primeiro derrubava todo artefato de prosa para `UNVERIFIED`, e um critério que reprova por não se aplicar é um critério que ninguém mantém ligado. Critério inaplicável sai da conta: não conta como aprovado nem como pendente.
- **Cobrado só quando o survey rodou.** Exigir um layout que nunca foi mostrado ao agente seria reprovar por informação que o runtime decidiu não dar.

### Marcadores de input (`tools/input-refs.ts`)

Um nó de tool é declarado no PLANO, antes de existir o que ele precisa gravar. `{ $artifact: '<nó>' }` e `{ $deliverable: true }` são resolvidos deterministicamente na hora da chamada — substituição de valor, não interpretação, e nenhuma chamada de modelo.

Duas regras que não afrouxam:

- **Referência a nó inexistente é erro**, nunca string vazia. Gravar um arquivo vazio e chamar isso de entrega é a falha silenciosa que a verificação por evidência existe para impedir.
- **`code.execute` recusa marcador em qualquer campo** do input. Levar saída de modelo para dentro de código executado é injeção com outro nome, e o fato de a sandbox isolar filesystem e processo não torna o código inócuo: ele ainda tem rede, e ainda decide o que devolver para a verificação. Quem precisa de um artefato dentro de um script grava com `fs.write` e lê o arquivo.

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

O parser aceita escalar, lista inline (`[a, b]`) e, desde 2026-09-04, **lista de bloco** (`triggers:` seguido de linhas `  - valor`), que é o formato que a `SkillFactory` escreve: antes disso toda skill gerada perdia em silêncio os próprios `triggers`. Chave sem valor e sem itens segue string vazia, nunca `[]` (ausência de valor não é lista vazia); chave aninhada (`tools:` → `mcp:`) continua fora de escopo, porque o `SkillManifest` é plano.

**O que o catálogo REALMENTE declara hoje**, medido no disco: as 106 skills de `skills/` (v1, a fonte que o resolver lê) declaram só `name` e `description`; as 106 de `.skills/` (v2) acrescentam `version`, `category`, `tools.mcp` e `references`, e embutem os gatilhos como prosa dentro da `description`. Nenhuma declara `triggers` ou `capabilities` em campo próprio, então o haystack de `rankSkills` inclui dois arrays que na prática estão vazios: o ranking escolhe entre descrições. Está registrado como item aberto 13 em `docs/RUNTIME-PENDING.md`.

O resolver **tolera** skills sem frontmatter (parse devolve `{}` e segue resolvendo pelo alias); metadados apenas aumentam a qualidade do scoring. **Só `name` e `description` são exigidos**: o mesmo mínimo do padrão aberto [agentskills.io](https://www.agensi.io/learn/skill-md-specification-open-standard), o que torna as skills do Izanagi portáveis para qualquer ferramenta compatível (Cursor, Copilot, Codex, VS Code...) sem modificação.

### Skill Lifecycle

```
DISCOVERED → DRAFT → VALIDATED → ACTIVE → DEPRECATED → ARCHIVED
```

Skills curadas do framework nascem `active`. Skills geradas pela Skill Factory (`izanagi skill create`) nascem `draft`: passaram no security scan mas não têm histórico de uso real; promoção a `active` é uma decisão separada (nunca "Generate → Automatically trust"). `izanagi skill list`/`inspect` mostram o estado; `doctor --deep`/`diagnose` reportam a distribuição.

---

> "Architecture is the art of making decisions that matter."
