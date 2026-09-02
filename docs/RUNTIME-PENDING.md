# Runtime: trabalho pendente

> Estado em **v3.13.0** (2026-09-01). Este documento é o handoff da rearquitetura do runtime (Commander, Task Contracts, roteamento por papel, verificação por evidência): o que **ficou faltando**, por que ficou, e o que exatamente precisa ser feito para fechar cada item.
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Cada item declara o arquivo real onde a mudança precisa acontecer.

---

## Como ler

| Marca | Significado |
|---|---|
| 🔴 | Gap que faz uma promessa da arquitetura não se cumprir hoje |
| 🟡 | Peça existe e é testada, mas **não tem caller em produção** |
| 🔵 | Não implementado, decisão consciente de escopo |

Ordem sugerida de ataque: os 🔴 primeiro (são dívida de coerência: o código promete algo que não entrega), depois os 🟡 (custo baixo, valor alto: é só ligar o fio), por fim os 🔵.

---

## 🔴 1. Degradação de orçamento é registrada mas nunca aplicada

**Onde:** `src/runtime/token/execution-budget.ts` (`nextDegradation`) e `src/runtime/orchestrator.ts` (bloco que consome `result.tokens`).

**O que acontece hoje:** quando a pressão orçamentária passa de 0.6, `nextDegradation()` devolve o próximo degrau (`reduce-context` → `reduce-output` → `downgrade-model` → `reduce-parallelism` → `drop-optional-tasks` → `require-human-approval`), o orchestrator abre um span `budget:degradation:<passo>` e a telemetria registra o passo. **Nada muda de fato na execução.** O contexto continua do mesmo tamanho, o modelo continua o mesmo, o paralelismo continua igual.

**Por que é 🔴:** a arquitetura promete "nunca ultrapassar o orçamento em silêncio, degradar em ordem". Hoje o Izanagi *avisa* que degradaria e segue igual até o teto recusar o gasto. O comportamento final (recusa do gasto) é correto e testado, mas a escada é decorativa.

**O que fazer:**
- `reduce-context`: o `ContextResolver` já aceita `maxCharsPerArtifact`/`maxTotalChars`. Guardar a instância no `ExecuteCtx` e recriá-la com orçamento menor (ex.: metade) quando o passo dispara.
- `reduce-output`: reduzir `node.tokenBudget` dos nós ainda pendentes (é o `maxTokens` da chamada).
- `downgrade-model`: inverso de `ModelRouter.escalateRole` — falta um `demoteRole()` (commander→specialist→worker) e aplicá-lo no `routeRole` do orchestrator.
- `reduce-parallelism`: `executeBatches` executa `Promise.all` sobre o batch inteiro; falta um teto de concorrência (ver item 3).
- `drop-optional-tasks`: já existe a maquinaria de `contract.optional` + early stopping; aqui é pular opcional **por orçamento**, não por verificação.
- `require-human-approval`: injetar um nó `kind: 'approval'` antes do próximo batch, reusando o `ApprovalStore`.

**Definição de pronto:** teste que força pressão alta e prova que o segundo nó recebeu contexto menor / modelo mais barato / batch menor, não só um span registrado.

---

## 🔴 2. Artefato não tem content store: o conteúdo morre com o processo

**Onde:** `src/runtime/artifacts/registry.ts` e `src/runtime/orchestrator.ts` (`ctx.artifacts`).

**O que acontece hoje:** o `ArtifactRegistry` persiste **metadado** (id, kind, produtor, hash, tamanho, validade, score, dependências, versão) em `.izanagi/state/artifacts.json`. O **conteúdo** vive só no `Map` de `ExecuteCtx`, em memória. Ao fim do run, o conteúdo se perde: o que sobra em disco é o `RunTrace` (que também não guarda conteúdo) e o metadado.

**Por que é 🔴:** o contrato de arquitetura fala em `contentRef` e em "reutilização de artefato". Sem conteúdo persistido não existe reuso entre runs, `izanagi explain` não consegue mostrar o que foi produzido, e o `Context Resolver` só consegue referenciar artefatos do run corrente. O checkpoint salva conteúdo (`CheckpointData.artifacts`), mas é apagado no veredito terminal.

**O que fazer:** gravar o conteúdo em `.izanagi/state/artifacts/<runId>/<nodeId>.v<N>` e preencher `ArtifactRecord.contentRef` com o caminho relativo. Adicionar `registry.readContent(id)`. Cuidado com dois pontos: (a) tamanho — aplicar teto e truncar com marca explícita, nunca silenciosamente; (b) segredo — o conteúdo pode carregar dado sensível, então respeitar a mesma zona de sandbox da `ToolRegistry` e não gravar fora de `.izanagi/state/`.

**Definição de pronto:** um run termina, o processo morre, e `izanagi explain <run-id>` consegue mostrar o artefato produzido por um nó.

---

## 🔴 3. Paralelismo sem teto de concorrência

**Onde:** `src/runtime/orchestrator.ts`, `executeBatches`.

**O que acontece hoje:** `Promise.all(batchNodes.map(...))` dispara **todos** os nós do batch ao mesmo tempo. No template `fullstack`, o batch `[security-review, database-design, product-spec]` faz 3 chamadas simultâneas ao provider. Com um plano maior, o número cresce sem limite.

**Por que é 🔴:** a arquitetura diz "limitar concorrência" e "não paralelize tudo indiscriminadamente". Hoje não há limite nenhum, e um provider com rate limit apertado transforma paralelismo em erro 429 — que vira healing, que vira retry, que gasta mais tokens do que a execução serial teria gasto.

**O que fazer:** `ExecutionBudgetLimits` ganha `maxConcurrency` (default sensato: 3, ou 1 quando `--local`, já que modelo local costuma ser single-GPU). `executeBatches` passa a consumir o batch numa fila com esse teto. `reduce-parallelism` da escada de degradação (item 1) diminui esse número em tempo de execução.

**Definição de pronto:** teste que prova que um batch de 5 nós com `maxConcurrency: 2` nunca tem mais de 2 produces em voo simultâneo.

---

## 🟡 4. Protocolo agente-a-agente e crítica estruturada sem caller

**Onde:** `src/runtime/protocol/messages.ts` (completo e testado, 12 testes) e `src/runtime/orchestration/planner.ts` (nó `critic`).

**O que acontece hoje:** `parseCritique`, `isBlocking`, `worstSeverity`, `formatCorrection` e `createMessage` existem, são determinísticos e testados. **Nenhum nó do runtime os invoca.** O nó `critic` dos templates produz texto cru como qualquer outro nó, e esse texto vira um artefato `critique` que ninguém interpreta. O `Healer` também não consome crítica.

**Por que é 🟡:** a peça está pronta; falta o fio. É o item de melhor relação valor/esforço da lista.

**O que fazer:**
1. No `Orchestrator.executeNode`, quando `node.outputs?.[0] === 'critique'` (ou `node.id === 'critic'`), passar a saída por `parseCritique` e guardar o `Critique` estruturado no `ExecuteCtx`.
2. Se `isBlocking(critique)`, marcar o nó criticado como falho com `formatCorrection(critique)` como mensagem — isso já cai no caminho de healing existente, e a correção enviada é mínima (só os bloqueantes), como o protocolo prevê.
3. O prompt do nó crítico precisa pedir JSON explicitamente (hoje pede texto livre): acrescentar o contrato de saída em `buildNodePrompt` quando o kind for `critique`.

**Definição de pronto:** um run onde o crítico aponta um problema `critical` reprova o artefato e a retentativa recebe **só** a lista de correções, sem reenviar histórico.

---

## 🟡 5. Verificação semântica sem juiz configurado

**Onde:** `src/runtime/verification/engine.ts` (`SemanticJudge`) e `src/runtime/orchestrator.ts` (`opts.judge`).

**O que acontece hoje:** a camada semântica existe, é injetável e é testada nos dois caminhos (com e sem juiz). **Nem a CLI nem o SDK injetam um juiz.** Consequência: todo critério `kind: 'semantic'` fica `UNVERIFIED`, e o veredito do nó nunca é `VERIFIED` quando há critério semântico.

Hoje isso não morde porque os critérios gerados pelo `Commander` são todos determinísticos (derivados do schema do artefato). Vai morder no momento em que alguém escrever um critério semântico à mão ou quando o Commander passar a gerá-los.

**Por que é 🟡 e não 🔴:** o comportamento atual é o **conservador correto** (inconclusivo em vez de falso positivo). O gap é de capacidade, não de correção.

**O que fazer:** um juiz default que usa o modelo do papel `worker` (avaliação é tarefa barata) com prompt estrito de saída `{ "pass": boolean, "reason": string }`, parseado pelo `extractJsonObject` que já existe em `protocol/messages.ts`. Injetar em `runtime/execute.ts` para CLI e SDK herdarem juntos. Manter desligável (`--no-judge`), porque juiz custa token.

**Definição de pronto:** critério semântico com juiz ligado fecha `VERIFIED`; com `--no-judge`, continua `UNVERIFIED` e o run diz isso.

---

## 🟡 6. Replanejamento não passa pelo Commander

**Onde:** `src/runtime/orchestrator.ts` (ação de healing `replan`) e `src/runtime/orchestration/planner.ts` (`Planner.replan`).

**O que acontece hoje:** quando o healing decide `replan`, o `Planner.replan()` reconstrói o **mesmo grafo** marcando concluídos como `skipped` e reabrindo o nó falho. Ele não reclassifica, não muda de modo, não regenera contratos, e não recebe a causa da falha.

**Por que é 🟡:** funciona (é o comportamento legado, testado), mas a arquitetura pede que o replan receba causa provável, artefato que falhou, evidência e tentativa anterior — e produza um **Plano B**, não uma repetição do Plano A com um nó reaberto.

**O que fazer:** `Commander.replan(previousPlan, failure)` que recebe `{ nodeId, error, verification.unmet, artifactRef, attempt }` e devolve um plano novo: pode trocar o agente do nó (via `AgentCapabilityRegistry.findCapable(..., { exclude: [agenteQueFalhou] })`), subir o papel, ou quebrar a tarefa em duas. Nunca reenviar a execução inteira ao Commander: só o delta.

**Definição de pronto:** falha reincidente no mesmo nó produz um grafo **diferente** do original, e a diferença aparece no `izanagi explain`.

---

## 🟡 7. Memória não informa o planejamento

**Onde:** `src/runtime/memory/store.ts` e `src/runtime/orchestration/commander.ts`.

**O que acontece hoje:** o `MemoryStore` guarda stats por agente/skill/modelo, padrões de falha e learnings, e o `SkillResolver` usa isso para ranquear. O **Commander não lê memória nenhuma**: classifica, escolhe modo e agente sem saber que aquele agente falhou nas últimas 5 vezes nesse tipo de tarefa, nem que existe um padrão de falha conhecido para o objetivo.

**O que fazer:** passar o `MemoryStore` para `CommanderInput` e usar em três pontos: (a) `pickAgent` exclui agentes com taxa de sucesso baixa naquele domínio; (b) `decideMode` sobe um degrau quando há padrão de falha conhecido para o objetivo (problema já se mostrou mais difícil do que parece); (c) as `decisions` do plano registram "memória consultada: N padrões relevantes".

Cuidado: **recuperação seletiva**, nunca injeção da memória inteira no contexto (a arquitetura é explícita nisso).

---

## 🟡 8. Skills por tarefa continuam vindo da chain do agente

**Onde:** `src/cli/commands/run.ts` (`resolveChainForCategory`) e `src/runtime/routing/resolver.ts` (`rankSkills`).

**O que acontece hoje:** a chain de skills é resolvida **uma vez por run**, a partir do agente e da categoria, e a mesma lista vai para todos os nós (limitada a 4 no prompt). O `SkillResolver.rankSkills()` sabe ranquear skills por relevância + histórico, mas não é chamado por tarefa.

**O que fazer:** o `Commander` popula `contract.skills` por tarefa usando `rankSkills(contract.objective)`. Cada nó carrega só as skills do próprio objetivo, não a chain do run inteiro. É economia de contexto direta e mensurável (`contextCharsSaved` já existe na telemetria para medir).

---

## 🔵 9. Sub-orquestradores hierárquicos

**O que falta:** o grafo é plano. Um nó não abre um subgrafo próprio com `maxOrchestrationDepth`.

**Quando vale fazer:** só quando aparecer um caso real de tarefa que precise se decompor **durante** a execução (não no planejamento). Hoje o Commander decompõe tudo antes de executar, e para os planos de até ~9 nós isso basta. Implementar antes de ter o caso é over-engineering (regra 47).

---

## 🔵 10. Programmatic tool calling (`execute_code`)

**O que falta:** colapsar uma sequência de chamadas de tool num único script executado em sandbox, para reduzir round-trips de inferência.

**Bloqueio real:** exige sandbox de execução isolada, que o framework ainda não tem (o `PolicyEngine` decide permissão, mas não isola processo). Ver item 12.

---

## 🔵 11. Cache além de resposta de modelo

**O que existe:** `ResponseCache` (resposta de modelo, por hash da entrada completa).

**O que falta:** cache de resultado de tool, de validação determinística e de pesquisa. Todos são candidatos legítimos porque são funções puras da entrada. O de validação é o mais barato de fazer (`validateArtifact` é determinístico e roda várias vezes sobre o mesmo conteúdo em retry/verificação).

---

## 🔵 12. Policy Engine fora do caminho de `izanagi run` (dívida herdada)

**Onde:** `src/runtime/security/policy.ts`, `src/runtime/tools/registry.ts`, `src/runtime/orchestrator.ts`.

**O que acontece hoje:** `Orchestrator.executeNode` chama `opts.produce()`, que é uma chamada de LLM (ou simulação headless). **Nunca passa por `ToolRegistry`**, então nenhuma garantia de trust-tier / least-privilege / sandbox se aplica à execução real. Isto está documentado no `SYSTEM.md` desde antes desta rearquitetura e continua verdade.

**Quando morde:** no momento em que um nó puder executar tool de verdade (escrever arquivo, rodar comando, chamar rede). Enquanto o produce só chama LLM, a superfície é a do próprio provider.

**O que fazer:** um `kind: 'tool'` de nó que roteia por `ToolRegistry` com `ToolContext` derivado do contrato (permissões declaradas no contrato, trust tier do agente), e `PolicyEngine` decidindo antes da execução. Sem isso, não faz sentido implementar `execute_code` (item 10).

---

## 🔵 13. Observabilidade: dashboard não mostra os campos novos

**Onde:** `src/runtime/dashboard/page.ts` e `server.ts`.

**O que falta:** o `RunTrace` agora carrega `mode`, `telemetry` e `verification`. O dashboard (Run Explorer) ainda renderiza só os campos antigos. `izanagi budget` já cobre isso no terminal, então é conveniência, não lacuna funcional.

---

## 🔵 14. Arena: métricas de verificação e recuperação por caso

**Onde:** `src/runtime/benchmarks/`.

**O que existe:** suíte de 10 casos com artefatos esperados e validators (`izanagi benchmark run`), e o Token Benchmark de plano (`izanagi benchmark tokens`).

**O que falta para ser a "Izanagi Arena" descrita na arquitetura:** por caso, medir também `verification rate`, `recovery rate` (falhas curadas / falhas totais), `retries`, `latency` e `cost` de uma execução **real** (não de plano). Isso exige rodar a suíte contra um provider configurado e guardar o resultado para comparação entre versões — a infraestrutura de `compare` já existe.

**Nota de honestidade que precisa sobreviver a qualquer evolução deste item:** o Token Benchmark de hoje mede **plano** (tetos declarados × preço de catálogo), não execução. Qualquer número de "economia real" só pode sair de `izanagi budget <run-id>` sobre runs de verdade.

---

## 🔵 15. Ideias do Hermes ainda não avaliadas contra o Izanagi

Da pesquisa que motivou esta rearquitetura, três itens ficaram fora **de propósito** (não foram avaliados contra o que o Izanagi já tem, e implementar sem essa comparação seria duplicação):

- **Índice de memória em SQLite FTS5 + passe de extração pós-sessão.** O Izanagi já tem `MemoryStore` (JSON) + `.agents/memoria/` (markdown) + busca textual simples. Antes de trocar por FTS5, medir se a busca atual é de fato o gargalo.
- **Síntese autônoma de skills a partir de trajetórias bem-sucedidas.** O Izanagi já tem `SkillFactory` (criação por lacuna comprovada, com security scan) e `LearningEngine`. O que falta é o gatilho: transformar um run `VERIFIED` de N tarefas numa skill procedural. Risco alto de gerar skill genérica sem valor: exigir evidência de recorrência antes de sintetizar.
- **Modo daemon / cron / integração com canais (Slack, Telegram).** Muda a filosofia do produto (de CLI local-first para serviço). Mesma decisão pendente já registrada na Fase 4 do `ROADMAP.md` sobre histórico multi-dispositivo: decidir **explicitamente** entre continuar local-first ou construir um serviço hospedado, antes de escrever qualquer linha.

- **Compressão neural de contexto (LLMLingua-2).** Dependência externa pesada (modelo próprio) num framework que hoje tem **uma** dependência de runtime. O `ContextResolver` + `session-diet` já entregam compressão determinística e auditável. Só vale reavaliar com medição mostrando que a compressão determinística é insuficiente.

---

## Onde isto já está registrado

- `ROADMAP.md` → *Fase 8* traz a versão resumida das limitações (itens 1, 4, 5, 6, 9, 12, 14).
- `SYSTEM.md` → seções *Policy Engine* e *Evidence System* trazem as ressalvas de "sem caller em produção" herdadas.
- Este documento é a versão completa e acionável. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança, senão os dois divergem.
