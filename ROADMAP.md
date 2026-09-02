# Roadmap

> Versão atual: **3.10.0**. Estado atual e evolução planejada do **Izanagi AI: Adaptive Agent & Skill Runtime**.
> Legenda: ✅ Done · 🔧 In progress · 📋 Planned · 💡 Future idea
> Histórico linha-a-linha de cada release em `CHANGELOG.md`: este arquivo resume por fase, não duplica o changelog.

---

## Fase 1: Foundation (v1.x) ✅

- [x] SYSTEM.md / RULES.md / README / AGENTS.md: identidade e operação
- [x] Decision Engine: classificação e roteamento de tarefas
- [x] Context Engine + Compression Engine: contexto enxuto e compactação
- [x] Token Manager: orçamento e monitoramento
- [x] Reflection Engine + Evolution Engine: autoavaliação pós-tarefa
- [x] Quality Gates: portões de validação de output
- [x] Planning Engine: decomposição e estimativa
- [x] Memory Manager: memória persistente 3 níveis + knowledge graph

## Fase 2: Engine Layer (v2.0 → v2.8) ✅

- [x] 15 → 18 agentes especializados, cada um com chains compostas
- [x] Biblioteca de skills modulares (103) + Skill Composer
- [x] CLI executável publicado no npm (`izanagi-ai`) com `izanagi init/run/compile/chat/doctor`
- [x] Packs selecionáveis + export multi-CLI (claude, codex, cursor, copilot, kimi)
- [x] Multi-Agent Swarm Mode (execução paralela concorrente)
- [x] Memória persistente `.agents/memoria/` (contexto, decisões, erros, aprendizados)
- [x] Referências curadas por domínio (`references/`)
- [x] Blueprint Engine: gate de manifest de arquivos, zero stubs
- [x] Anti-AI-Slop, design-directions (Style Selector) e ui-ux-pro-max (BM25 offline)

## Fase 3: Adaptive Runtime (v2.9 → v2.10) ✅

- [x] **Evaluation Engine** (`core/evaluation/` → `src/runtime/evaluation/`): vereditos PASS / PASS_WITH_WARNINGS / FAIL / BLOCKED / UNKNOWN, métricas ponderadas (correctness, security, architecture, performance, maintainability, artifact validity), confiança e regressões
- [x] **Execution Graph** (`src/runtime/orchestration/`): grafo por tarefa com nós, dependências, condições, retry policy, timeout, token budget e validador; batches paralelos detectados; templates por categoria sem grafo gigante universal
- [x] **Adaptive Routing / Scoring** (`src/runtime/routing/`): ranking de agentes e skills por relevância semântica + histórico + compatibilidade + custo + risco
- [x] **Agent Genome**: 13 campos formais nos 22 agentes (purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility)
- [x] **Skill Manifest**: frontmatter padronizado nas skills (name, version, triggers, dependencies, risk, tokenBudget...) + `izanagi skill inspect/search`
- [x] **Agent Factory & Skill Factory** (`src/runtime/factories/`): geração de agentes e skills por lacuna real, com validação antes do registro
- [x] **Failure Memory** (`src/runtime/memory/`): 7 categorias (episodic, semantic, procedural, decision, failure, skill, project); padrões de falha reutilizáveis buscados antes da execução
- [x] **Self-Healing** (`src/runtime/recovery/`): classificação de falha (recoverable/non-recoverable/planning/tool/agent/validation/dependency) → local repair | replan | handoff | skill replacement | abort; limites maxAttempts/maxTokens/maxTime
- [x] **Contracts & Artifacts** (`src/runtime/contracts/`): schemas programáticos (requirements, architecture, database-schema, api-contract, security-report, test-plan, implementation-plan, evaluation) com validação INVALID → REPAIR → RE-EVALUATE
- [x] **Adversarial Critic**: 18º/19º agente: caça bugs, segurança, architecture flaws, AI slop
- [x] **Model Router** (`src/runtime/model/`): ModelProvider / ModelAdapter / ModelRouter por complexidade, risco, custo, latência e contexto
- [x] **Tracing / Observability** (`src/runtime/observability/`): spans por decisão/agente/skill/tool/model + `izanagi trace` e `izanagi trace <run-id>`
- [x] **Tools Registry (MCP-ready)** (`src/runtime/tools/`): discover → permission → compatibility → select → execute → validate, least privilege, path traversal bloqueado
- [x] **Skill Security Scanner** (`src/runtime/security/`): prompt injection, instruções perigosas, scripts, permissões, requisitos de rede/fs; LOW/MEDIUM/HIGH/CRITICAL
- [x] **Benchmarks** (`benchmarks/` + `src/runtime/benchmarks/`): 10 domínios, validators, expectativas de artefatos, `izanagi benchmark run/list/compare` com relatório comparável entre versões
- [x] **CLI runtime**: `izanagi agent list|inspect`, `skill list|search|inspect|create`, `workflow list|inspect`, `run`, `trace`, `eval`, `benchmark`, `memory inspect|search`, `doctor --deep`, `diagnose`
- [x] **Doctor expandido**: valida system/agents/skills/resolver/memória/providers/tools/contratos/avaliação/benchmarks
- [x] Testes node:test cobrindo resolver, scoring, contracts, evaluation, graph, parallel, retry, healing, memory, handoff, factories, model routing, CLI, tracer, scanner, tools, benchmarks, orchestrator

## Fase 4: Evolução v2.11 (🔧 / 📋)

- [x] **Evidence System** (`src/runtime/research/`): claims FACT / ASSUMPTION / INFERENCE / UNKNOWN com source, confidence, sourceType hierarquizado (official docs > source code > tests > package metadata > reliable tech > community) e relatório de claims críticas
- [x] **Token Budget 2.0** (`src/runtime/token/`): orçamento por fase (planning / execution / evaluation / recovery) com tetos e abort de fase; distribuído automaticamente por complexidade e tier de modelo
- [x] **Product Reasoner**: Understanding: intenção vaga → requisitos com evidências e critérios BDD (entrada do ciclo)
- [x] **Agent Architect**: projeto de novos agentes (Genome + guardrails + avaliação) por lacuna real
- [x] **Skill Architect**: curadoria de skills com security scan e anti-duplicação por lacuna comprovada
- [x] **Benchmarks externos**: `benchmarks/*.json` carregados pelo registry sem duplicar IDs embutidos
- [x] **Plugin System (base)**: trust tiers (builtin/generated/community) no Skill Scanner com bloqueio escalonado + Policy Engine para permissão contextual; ainda falta sandbox de execução isolada para skills de terceiros 🔧
- [ ] **Skill Marketplace**: compartilhar e instalar skills 📋
- [ ] **Izanagi API**: interface REST para interrogção do framework 💡
- [ ] **Web UI**: editor visual de skills e monitor de execuções 📋
- [ ] **Analytics Dashboard**: token usage, custo e evolução por execução 📋
- [ ] **Histórico persistente entre sessões/dispositivos + login por conta** (pedido do usuário, ainda não escopado 💡): hoje `izanagi dashboard` é local, single-user, lê `TraceStore`/`MemoryStore` do disco (`.agents/memoria/`) — sobrevive a fechar o terminal, mas não a trocar de computador. Login multi-dispositivo real exige backend hospedado + banco + auth, o que contradiz o design zero-infra/local-first atual do framework (roda 100% offline, sem servidor próprio). Antes de implementar: decidir explicitamente entre (a) continuar local-first e oferecer só *export/import* do estado (`.agents/memoria/` sincronizado via Git/Dropbox/etc, zero conta), ou (b) aceitar a mudança de filosofia e construir um serviço hospedado (conta, banco, sync) como produto separado do CLI. Não implementar às pressas sem essa decisão.

## Fase 5: Runtime de Produção v2.11 ✅

Auditoria completa do framework + consolidação arquitetural (unificação de caminhos de execução, eliminação de duplicações) + as primitives que faltavam para o runtime ser "production-grade" pelos critérios de mercado 2026 (checkpoint/resume, observabilidade de decisão, rastreabilidade de artefato, human-in-the-loop real).

- [x] **`izanagi run` unificado**: Adaptive Runtime (graph + routing + evaluation + trace + healing + memória) é o único caminho de execução, por padrão; eliminado o modo estático paralelo que só imprimia um plano sem executar. `--prompt-only` preserva a geração de prompt para colar em outra ferramenta.
- [x] **Safe Expression Evaluator** (`src/runtime/orchestration/safe-eval.ts`): substitui `new Function()`/eval sobre `GraphNode.condition` e `BenchmarkValidator.check`, que podiam vir de dados de terceiros (benchmarks externos).
- [x] **Model Router com histórico e extensibilidade real**: `historicalPerformance` (antes um campo morto) agora é preenchido via `MemoryStore.recordModelRun`; `IZANAGI_MODEL` (override manual) e `.izanagi/izanagi.config.json → models` (catálogo por projeto) implementados.
- [x] **Policy Engine** (`src/runtime/security/policy.ts`): permissão CONTEXTUAL (ambiente dev/ci/produção, trust tier), distinta do Security Scanner (detecção de conteúdo perigoso). Wired em `ToolRegistry`.
- [x] **Trust tiers no Skill Scanner**: builtin/generated/community com bloqueio escalonado por origem.
- [x] **Checkpoint/Resume real** (`src/runtime/recovery/checkpoint.ts`): progresso salvo a cada rodada de batches; `izanagi resume <run-id>` continua sem replanejar nem reexecutar nós concluídos, restaurando budget/artefatos/modelo.
- [x] **Decision Journal** (`src/runtime/memory/decisions.ts`): decisão + alternativas realmente consideradas + razão + confiança, para model-routing e agent-routing.
- [x] **Artifact Registry** (`src/runtime/artifacts/registry.ts`): artefatos rastreáveis (produtor, hash, dependências, versão em retry/replan).
- [x] **Human-in-the-loop real**: `GraphNode.kind: 'approval'` pausa a execução (não é falha) até `izanagi approve`/`izanagi reject`, retomando via checkpoint.
- [x] **CLI**: `izanagi resume`, `izanagi approve`, `izanagi reject`, `izanagi explain`.
- [x] **Skill Lifecycle**: `discovered → draft → validated → active → deprecated → archived`; skills geradas pela Factory nascem `draft` (nunca "Generate → Automatically trust").
- [x] **`doctor`/`diagnose` sem duplicação**: checks compartilhados (`src/cli/checks.ts`) computados uma vez, cada comando decide o que exibir.
- [x] **Confirmado**: as 102 skills em `skills/*/SKILL.md` são 100% compliant com o padrão aberto agentskills.io (frontmatter `name`+`description`): portáveis para ~40 ferramentas de mercado (Cursor, Copilot, Codex, VS Code...) sem modificação.
- [ ] **Consolidação dos packs de skills legados** (`architecture/`, `coding/`, `security/`... vs. `skills/`): depreciação com apontamento para o equivalente novo, em andamento 🔧

## Fase 6: Hardening & Correção Real de Produção (v3.0 → v3.4) ✅

Cada item veio de um bug real encontrado por dogfooding, não de suposição. Detalhe completo em `CHANGELOG.md`.

- [x] **v3.0.0 (CRÍTICO)**: todo comando runtime lia/escrevia dentro do próprio pacote instalado em vez do projeto do usuário; `resolveFrameworkRoot(cwd)` corrigido para resolver a partir do `.agents/` do projeto real.
- [x] **v3.1.0 (CRÍTICO)**: `izanagi init` não gerava adapter Claude Code em modo não-interativo; `exportToClaude()` só exportava 10 de 103 skills; os 22 agentes tinham `model` fixado num snapshot datado; `.manifest` contava skills em dobro ("212 skills" corrigido para 103 reais); agente `/ai-engineer` adicionado (21 → 22 core).
- [x] **v3.2.0**: `checkNestedDuplicate()` detecta o padrão `<repo>/<repo>/`, causa raiz real de "skills/agentes não aparecem".
- [x] **v3.3.0: Izanagi Evolution**: auditoria contra roadmap de 7 fases; fechou lacunas reais (`FailureCategory`, `ArtifactRegistry.detectRegression()`, Event System, adapters Ollama/LM Studio/OpenRouter, ciclo de vida de failure-pattern, `benchmark report`/`arena`, `izanagi dashboard` local).
- [x] **v3.4.0 (CRÍTICO)**: os 3 commits pós-3.3.0 (persistência crash-safe, dashboard live via SSE, polish visual) tinham sido enviados ao GitHub mas nunca publicados no npm; republicado.

## Fase 7: Higiene de Texto & Consistência de Documentação (v3.5 → v3.6) ✅

- [x] **v3.5.0**: higiene Unicode default-on em todo `fs.write` gerado (`sanitizeText()`): remove caracteres invisíveis (zero-width space, bidi overrides, BOM...) e normaliza espaços homóglifos (nbsp, espaços largos), sem custo de rede/LLM.
- [x] **v3.6.0**: banners de versão de `AGENTS.md`/`SYSTEM.md`/`RULES.md` estavam presos em `2.11.0`/`1.0.0` desde antes da 3.0.0, apesar de terem recebido edições reais nesse período; unificados em `3.6.0`. Contagens obsoletas corrigidas (testes, skills, aliases, composições, "vs. 21 core"). `AGENTS.md` tinha referência a um agente dinâmico de exemplo já removido em 2.13.0. `izanagi export`/`init` não listavam `opencode` como CLI válido apesar de ser o adapter default. Os templates dos 6 adapters CLI e o campo `role` de 4 agentes violavam a própria Regra 13 do framework (zero travessão "—"): purgado. `senior-engineer-agent.json` tinha `optionalSkills` com nomes de arquivo de agente em vez de alias de skill (mesma classe de bug que a 2.13.0 corrigiu em outros 3 agentes, mas não neste): corrigido. `resolveFrameworkRoot()` tratava qualquer `.agents/` como projeto inicializado, mesmo quando só continha `.agents/memoria/` criado pelo próprio runtime sem `izanagi init` nunca ter rodado: `doctor`/`run`/`agent list` falhavam silenciosamente nesse caso, inclusive dentro do próprio checkout do framework; corrigido para exigir `.agents/core`. Adicionado orquestrador `/agents` nativo para Claude Code (`.claude/commands/agents.md`), espelhando o protocolo do opencode via Agent tool. Nova skill `payments-billing` (Stripe/Paddle/Mercado Pago), cabeada em `senior-engineer` e na composição `fullstack_crud`.

---

## Fase 8: Runtime de Execução de Trabalho (v3.13.0) ✅

De "framework de agentes" para runtime que transforma objetivo em plano executável, delega ao modelo certo, verifica o resultado e controla o custo.

- [x] **Commander (LEVEL 0)**: classificação de complexidade e domínios, escolha do modo, geração de Task Contracts com critérios de aceite derivados do schema real do artefato, estimativa de custo e degradação de modo sob teto. Determinístico: planejar não gasta token.
- [x] **Execution Modes**: `direct` / `assisted` / `orchestrated` / `autonomous`. Antes, "converta 10 dólares para reais" montava um grafo de 3 a 9 nós com avaliação e crítica.
- [x] **Task Contract**: objetivo, papel, insumos por referência, restrições, saída esperada, dependências, orçamento e política de verificação por tarefa.
- [x] **Model Router por papel**: tier por papel (commander/specialist/worker), pin por config/env, escalada worker→specialist→commander na retentativa, custo real em USD.
- [x] **Context Resolver**: contexto mínimo por tarefa. Corrigiu a lacuna de nós dependentes que nunca recebiam a saída dos predecessores.
- [x] **Agent Capability Registry**: "quem sabe fazer isso?" lido do disco, no lugar da lista fixa dentro do orchestrator.
- [x] **Agent-to-Agent Protocol**: mensagens tipadas por referência de artefato + crítica estruturada + correção mínima.
- [x] **Verification Engine 2.0**: determinística, evidência e semântica. Critério semântico sem juiz fica UNVERIFIED e nunca vira aprovação.
- [x] **Budget Controller**: custo em USD, tetos de tool/agente/retry, tempo, escada de degradação.
- [x] **Early stopping**: tarefa opcional não roda quando as dependências já estão VERIFIED.
- [x] **Response Cache** opt-in e **telemetria de economia** persistida no trace.
- [x] **SDK programático**: `izanagi.run()` / `izanagi.plan()` com eventos do run.
- [x] **CLI**: `--mode`, `--budget`, `--max-cost`, `--model`, `--local`, `--cache`, `--no-commander`; `izanagi models`; `izanagi budget`.
- [x] **Token Benchmark**: legado vs Commander em chamadas, tokens e custo, determinístico e com ressalva explícita do que não mede.

### Limitações desta fase: todas fechadas na Fase 9

As onze limitações registradas aqui na v3.13.0 foram resolvidas nas versões
3.13.x/3.14.0. O detalhamento de cada fechamento está na tabela *Fechados* de
[`docs/RUNTIME-PENDING.md`](docs/RUNTIME-PENDING.md).

## Fase 9: Fechamento do runtime (v3.14.0) ✅

De "as peças existem e são testadas" para "as peças estão ligadas e mudam a execução".

- [x] **Degradação de orçamento aplicada de fato**: cada degrau muda a execução (contexto pela metade, teto de saída a 60%, papel rebaixado, concorrência dividida, opcionais cortadas, pausa por aprovação humana), com limiar próprio por degrau e pressão calculada pela maior razão **por fase**.
- [x] **Content store de artefato**: conteúdo persistido em `.izanagi/state/artifacts/<runId>/` com `contentRef`, teto de 512KB e truncamento declarado. `izanagi explain --artifacts` mostra o que foi produzido depois que o processo morreu.
- [x] **Teto de concorrência**: pool com ordem preservada e falha isolada por índice (`orchestration/concurrency.ts`), default 3, configurável e reduzido pela degradação.
- [x] **Critique loop ligado**: crítica bloqueante reprova o nó CRITICADO e devolve correção mínima; a retentativa recebe a própria entrega anterior + a lista de correções, não o histórico. Teto de uma rodada por nó. `critique` virou ArtifactKind com formato obrigatório.
- [x] **Protocolo A2A com caller**: `ConversationLog` registra task/result/critique/correction do run, sempre por referência de artefato. Persiste no trace; `izanagi explain [--conversation]` mostra quem falou com quem.
- [x] **Juiz semântico ligado por default**: papel `worker`, artefato resumido, um critério por vez. Saída ilegível/erro de rede vira `inconclusive`, nunca reprovação. Tokens do julgamento cobrados da fase `evaluation`. `--no-judge` desliga.
- [x] **Replanejamento pelo Commander**: `Commander.replan` troca o agente, sobe o papel ou quebra a tarefa em rascunho + fechamento. Recebe só o delta da falha e declara quando não há alternativa estrutural.
- [x] **Memória no planejamento**: padrão de falha conhecido sobe o modo um degrau; agente com histórico ruim sai da disputa (com salvaguarda contra excluir todo mundo); a consulta entra no Decision Journal.
- [x] **Skills por tarefa**: cada nó carrega as skills do próprio objetivo (teto de 3) em vez da chain do run, com memoização de manifesto para o ranking por tarefa não multiplicar I/O.

### Limitações desta fase: todas fechadas na Fase 10

As sete limitações registradas aqui na v3.14.0 foram resolvidas na v3.15.0. O
detalhamento está na tabela *Fechados* de
[`docs/RUNTIME-PENDING.md`](docs/RUNTIME-PENDING.md).

## Fase 10: Segurança no caminho de execução e medição real (v3.15.0) ✅

O que sobrava depois da Fase 9 era, quase tudo, "existe mas não está no caminho".

- [x] **Policy Engine no caminho de `izanagi run`**: nó `kind: 'tool'` roteado por `ToolRegistry` + `PolicyEngine`. `TaskContract.permissions` declara o que a tarefa pode fazer (menor privilégio: contrato sem permissões executa tool nenhuma); trust tier vem da ORIGEM do arquivo do agente, não do que ele declara. Negativa de permissão é `non-recoverable`: retry não abre porta fechada.
- [x] **Simulação headless derivada do schema real**: `izanagi run` sem API key deixou de terminar `FAIL` por um motivo alheio ao runtime. Um teste valida a simulação de TODO kind registrado contra o validador de verdade, então schema e simulação não divergem em silêncio.
- [x] **Estatística de agente por domínio**: `AgentStats.byDomain`. Um agente bom em backend não é mais descartado de um trabalho de backend por ir mal em frontend. Ausência de histórico no domínio é tratada como ausência de sinal, não como sinal ruim.
- [x] **Cache de validação determinística**: `validateArtifact` memoizado por `(kind, hash)`. Economiza CPU, não token — e isso está dito no código e no relatório.
- [x] **Dashboard mostra o runtime novo**: modo, verificação por tarefa, economia e conversa A2A no Run Explorer.
- [x] **Izanagi Arena**: `izanagi benchmark run --execute` roda cada caso pelo runtime real e mede verificação, recuperação, retries, healing, tokens e custo. Métrica ausente aparece como ausente.

Três bugs reais corrigidos no caminho: `toText` podia devolver `undefined` (validar retorno vazio de tool estourava em vez de reprovar); caminho relativo de tool escapava da sandbox resolvendo contra o cwd do processo; e a tabela de economia do dashboard referenciava campos que não existem em `TokenTelemetry`.

### Limitações desta fase: todas fechadas na Fase 11

## Fase 11: Autonomia contida (v3.16.0) ✅

Os três itens que restavam eram os de maior risco da lista: cada um destrava
autonomia, e cada um erra caro se destravar demais.

- [x] **Sub-orquestração**: uma tarefa pode descobrir, executando, que é maior do que o plano previu, e abrir um subgrafo próprio. Os limites são o ponto: orçamento do pai **dividido** (decompor não libera gasto), profundidade com teto do RUNTIME e não do agente, largura máxima de 5, sub-tarefa que não decompõe de novo, pedido malformado recusado inteiro, e falha de filho sendo falha de quem pediu.
- [x] **`execute_code` com isolamento imposto pelo runtime**: processo Node separado com Permission Model. Filesystem restrito ao diretório de trabalho, subprocessos/workers/addons/WASI bloqueados, ambiente montado do zero (nenhuma chave de API atravessa), timeout com kill, teto de saída. Sem isolamento disponível, a execução é RECUSADA.
- [x] **Síntese de skill por trajetória recorrente**: o simétrico de converter falha em padrão. A barra é recorrência (3 execuções verificadas), a assinatura é o caminho e não o objetivo, e a skill gerada declara o próprio limite.
- [x] **A medição que destravava FTS5 e compressão neural**: `izanagi benchmark memory`. Busca p95 2.0ms sobre 296KB e compressão a 8.3% do original — as duas trocas não se pagam neste volume, e o comando dirá sozinho quando isso mudar.

Dois bugs reais corrigidos: a busca de memória tinha **recall truncado em silêncio** (buscava só nos primeiros 4000 chars de cada arquivo, então tudo que o projeto aprendeu depois era invisível), e a sandbox concedia leitura de `os.tmpdir()` inteiro, onde o próprio diretório de trabalho vive.

### A decisão que faltava, tomada na Fase 12.

## Fase 12: Local-first, decidido (v3.17.0) ✅

A escolha entre CLI local-first e serviço hospedado estava pendente desde a
Fase 4, e destravava três coisas ao mesmo tempo (daemon, cron, canais).
**Decisão: local-first.** O Izanagi não fica de pé — sem daemon, sem porta
escutando, sem credencial em repouso. É o pressuposto sobre o qual sandbox,
trust tier e Policy Engine foram desenhados, e mantê-lo evita revisitar todas
essas decisões de segurança.

Quem agenda passa a ser o cron ou o Task Scheduler do sistema, e o que faltava
era o Izanagi ser consumível por eles:

- [x] **`--json`**: um único objeto no stdout, saída humana silenciada,
      `console.error` preservado — erro real precisa chegar ao stderr do
      agendador sem contaminar o stdout que ele parseia.
- [x] **Código de saída com significado**: `0` concluiu · `1` falhou ·
      `2` aguarda decisão humana. Aguardar aprovação não é falha e não deve
      alertar como falha: alguém precisa aprovar, não consertar.
- [x] **`--notify-webhook=<url>`**: POST de fim de run com uma retentativa.
      `4xx` não é repetido (configuração errada não melhora repetindo), `5xx` é.
      Falha de notificação nunca derruba o run.

**A regra do payload**: o webhook leva metadado (status, score, tokens, custo,
verificação por tarefa, nomes de artefato), nunca o conteúdo produzido. Um
endpoint de notificação costuma ser um canal de equipe ou um serviço que
ninguém auditou; mandar o artefato para lá é exfiltração com aparência de
conveniência.

**O que isto explicitamente NÃO dá**: receber comando de fora. Para isso seria
preciso autenticação, isolamento entre execuções e credenciais em repouso.

Com isso o handoff [`docs/RUNTIME-PENDING.md`](docs/RUNTIME-PENDING.md) fica
sem itens abertos: o que resta são oito escolhas com motivo registrado (rede
não isolada na sandbox, templates sem nós de tool, Token Benchmark medindo
plano, entre outras), não dívida.

## Critérios de aceite das próximas fases

Toda mudança no framework deve provar impacto em pelo menos uma dimensão:

```
reliability · adaptability · correctness · observability
token waste reduction · recovery · extensibility · developer experience
```

E deve passar o quality bar completo: `build` → `test` → `doctor --deep` → `benchmark run` → documentação.