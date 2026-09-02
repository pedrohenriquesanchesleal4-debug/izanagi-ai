# Runtime: trabalho pendente

> Estado em **v3.14.0** (2026-09-02). Este documento é o handoff vivo da rearquitetura do runtime: o que **ainda falta**, por que falta, e o que exatamente precisa ser feito para fechar cada item.
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Cada item declara o arquivo real onde a mudança precisa acontecer. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança.

---

## Como ler

| Marca | Significado |
|---|---|
| 🔴 | Gap que faz uma promessa da arquitetura não se cumprir hoje |
| 🟡 | Peça existe e é testada, mas **não tem caller em produção** |
| 🔵 | Não implementado, decisão consciente de escopo |

Não há mais itens 🔴 nem 🟡 abertos: os oito itens da lista original foram fechados (ver *Fechados* no fim). O que resta é escopo consciente.

---

## 🔵 1. Sub-orquestradores hierárquicos

**Onde:** `src/runtime/orchestrator.ts`, `src/runtime/orchestration/commander.ts`.

**O que falta:** o grafo é plano. Um nó não abre um subgrafo próprio com `maxOrchestrationDepth`.

**Quando vale fazer:** só quando aparecer um caso real de tarefa que precise se decompor **durante** a execução (não no planejamento). Hoje o Commander decompõe tudo antes de executar, e para os planos de até ~9 nós isso basta. A quebra de tarefa do `Commander.replan` (rascunho + fechamento) já cobre o caso mais comum de "a tarefa era maior do que parecia" sem precisar de recursão. Implementar antes de ter o caso é over-engineering (regra 47).

---

## 🔵 2. Programmatic tool calling (`execute_code`)

**O que falta:** colapsar uma sequência de chamadas de tool num único script executado em sandbox, para reduzir round-trips de inferência.

**Bloqueio real:** exige sandbox de execução isolada, que o framework ainda não tem (o `PolicyEngine` decide permissão, mas não isola processo). Ver item 4.

---

## 🔵 3. Cache além de resposta de modelo

**O que existe:** `ResponseCache` (resposta de modelo, por hash da entrada completa) e memoização de manifesto de skill no `SkillResolver` (adicionada quando o ranking passou a ser por tarefa).

**O que falta:** cache de resultado de tool, de validação determinística e de pesquisa. Todos são candidatos legítimos porque são funções puras da entrada. O de validação é o mais barato de fazer (`validateArtifact` é determinístico e roda várias vezes sobre o mesmo conteúdo em retry, verificação e detecção de regressão).

---

## 🔵 4. Policy Engine fora do caminho de `izanagi run` (dívida herdada)

**Onde:** `src/runtime/security/policy.ts`, `src/runtime/tools/registry.ts`, `src/runtime/orchestrator.ts`.

**O que acontece hoje:** `Orchestrator.executeNode` chama `opts.produce()`, que é uma chamada de LLM (ou simulação headless). **Nunca passa por `ToolRegistry`**, então nenhuma garantia de trust-tier / least-privilege / sandbox se aplica à execução real. Isto está documentado no `SYSTEM.md` desde antes desta rearquitetura e continua verdade.

**Quando morde:** no momento em que um nó puder executar tool de verdade (escrever arquivo, rodar comando, chamar rede). Enquanto o produce só chama LLM, a superfície é a do próprio provider.

**O que fazer:** um `kind: 'tool'` de nó que roteia por `ToolRegistry` com `ToolContext` derivado do contrato (permissões declaradas no contrato, trust tier do agente), e `PolicyEngine` decidindo antes da execução. Sem isso, não faz sentido implementar `execute_code` (item 2).

---

## 🔵 5. Observabilidade: dashboard não mostra os campos novos

**Onde:** `src/runtime/dashboard/page.ts` e `server.ts`.

**O que falta:** o `RunTrace` agora carrega `mode`, `telemetry`, `verification` e `conversation`. O dashboard (Run Explorer) ainda renderiza só os campos antigos. `izanagi budget` e `izanagi explain --conversation` já cobrem isso no terminal, então é conveniência, não lacuna funcional.

---

## 🔵 6. Arena: métricas de verificação e recuperação por caso

**Onde:** `src/runtime/benchmarks/`.

**O que existe:** suíte de 10 casos com artefatos esperados e validators (`izanagi benchmark run`), e o Token Benchmark de plano (`izanagi benchmark tokens`).

**O que falta para ser a "Izanagi Arena" descrita na arquitetura:** por caso, medir também `verification rate`, `recovery rate` (falhas curadas / falhas totais), `retries`, `latency` e `cost` de uma execução **real** (não de plano). Isso exige rodar a suíte contra um provider configurado e guardar o resultado para comparação entre versões — a infraestrutura de `compare` já existe.

**Nota de honestidade que precisa sobreviver a qualquer evolução deste item:** o Token Benchmark de hoje mede **plano** (tetos declarados × preço de catálogo), não execução. Qualquer número de "economia real" só pode sair de `izanagi budget <run-id>` sobre runs de verdade.

---

## 🔵 7. Producer headless não satisfaz o schema dos artefatos tipados

**Onde:** `src/runtime/execute.ts` (`createHeadlessProducer`).

**O que acontece hoje:** sem API key, o producer devolve `{ node, label, task, producedAt, summary }` para qualquer kind. Para `security-report`, `architecture`, `database-schema` e os demais kinds tipados, esse objeto não tem os campos obrigatórios do schema, então o nó reprova na verificação, entra em healing e o run termina `FAIL`. O caminho de `critique` foi corrigido (a simulação devolve uma crítica estruturada que aprova e declara ser simulação), o resto não.

**Por que importa:** é o modo em que alguém experimenta o Izanagi pela primeira vez, e é o modo em que se faz smoke test de mudança de runtime. Hoje ele sempre termina em vermelho por um motivo que não tem nada a ver com o runtime.

**O que fazer:** derivar o conteúdo simulado de `ARTIFACT_SCHEMAS[kind].required`, com uma marca explícita de simulação no próprio conteúdo. Cuidado com `database-schema`, cujo `validate` exige conteúdo textual com chave primária e relacionamento — um objeto genérico não passa. Nunca apresentar simulação como execução: o run precisa continuar dizendo, em toda saída, que rodou headless.

---

## 🔵 8. Estatística de agente é global, não por domínio

**Onde:** `src/runtime/memory/store.ts` (`agentStats`) e `src/runtime/orchestration/commander.ts` (`unreliableAgents`).

**O que acontece hoje:** o Commander desprioriza agente com taxa de sucesso abaixo de 40% em pelo menos 3 runs. A taxa é **global por agente**: um agente que vai mal em frontend e bem em backend é despriorizado nos dois.

**O que fazer:** `recordAgentRun` passar a registrar o domínio (ou a categoria) do run, e `agentStats` aceitar um filtro. Só vale com volume de runs suficiente para a estatística por domínio significar alguma coisa — antes disso, a taxa global é o sinal mais confiável disponível.

---

## 🔵 9. Ideias do Hermes ainda não avaliadas contra o Izanagi

Da pesquisa que motivou esta rearquitetura, três itens ficaram fora **de propósito** (não foram avaliados contra o que o Izanagi já tem, e implementar sem essa comparação seria duplicação):

- **Índice de memória em SQLite FTS5 + passe de extração pós-sessão.** O Izanagi já tem `MemoryStore` (JSON) + `.agents/memoria/` (markdown) + busca textual simples. Antes de trocar por FTS5, medir se a busca atual é de fato o gargalo.
- **Síntese autônoma de skills a partir de trajetórias bem-sucedidas.** O Izanagi já tem `SkillFactory` (criação por lacuna comprovada, com security scan) e `LearningEngine`. O que falta é o gatilho: transformar um run `VERIFIED` de N tarefas numa skill procedural. Risco alto de gerar skill genérica sem valor: exigir evidência de recorrência antes de sintetizar.
- **Modo daemon / cron / integração com canais (Slack, Telegram).** Muda a filosofia do produto (de CLI local-first para serviço). Mesma decisão pendente já registrada na Fase 4 do `ROADMAP.md` sobre histórico multi-dispositivo: decidir **explicitamente** entre continuar local-first ou construir um serviço hospedado, antes de escrever qualquer linha.
- **Compressão neural de contexto (LLMLingua-2).** Dependência externa pesada (modelo próprio) num framework que hoje tem **uma** dependência de runtime. O `ContextResolver` + `session-diet` já entregam compressão determinística e auditável. Só vale reavaliar com medição mostrando que a compressão determinística é insuficiente.

---

## Fechados

Registro do que saiu desta lista, para que ninguém reabra um item já resolvido nem procure um gap que não existe mais.

| Item original | Fechado em | Como |
|---|---|---|
| 🔴 1. Degradação registrada mas nunca aplicada | `8a5d04c` | Cada degrau muda a execução: contexto pela metade, saída a 60%, `demoteRole`, concorrência dividida, opcionais cortadas, pausa por aprovação. Limiar por degrau (0.60 a 0.93) e pressão calculada pela maior razão **por fase**. |
| 🔴 2. Artefato sem content store | `8a5d04c` | Conteúdo persistido em `.izanagi/state/artifacts/<runId>/`, com `contentRef`, teto de 512KB e truncamento declarado. `izanagi explain --artifacts` mostra. |
| 🔴 3. Paralelismo sem teto de concorrência | `8a5d04c` | `orchestration/concurrency.ts`: pool com ordem preservada e falha isolada, default 3, configurável por `maxConcurrency`. |
| 🟡 4. Protocolo A2A e crítica sem caller | `c108699` | `interpretCritique` no Orchestrator: crítica bloqueante reprova o nó criticado com correção mínima; `ConversationLog` registra task/result/critique/correction por referência de artefato; `critique` virou ArtifactKind com formato obrigatório. |
| 🟡 5. Juiz semântico não injetado | `e977b7a` | `verification/judge.ts` + `createSemanticJudge` no wiring compartilhado. Papel `worker`, artefato resumido, saída ilegível vira `inconclusive` (nunca reprovação). `--no-judge` desliga. |
| 🟡 6. Replan não passa pelo Commander | `e803837` | `Commander.replan`: troca agente → sobe papel → quebra a tarefa em duas. Recebe só o delta da falha; `changes` vazio quando não há alternativa. |
| 🟡 7. Memória não informa o planejamento | `96714ff` | `PlanningMemory` no `CommanderInput`: padrão de falha conhecido sobe o modo um degrau, agente com histórico ruim sai da disputa, consulta registrada nas decisões. |
| 🟡 8. Skills resolvidas por run | `96714ff` | `resolveSkills` por tarefa (teto de 3), com memoização de manifesto no `SkillResolver` para o ranking por tarefa não multiplicar I/O. |
