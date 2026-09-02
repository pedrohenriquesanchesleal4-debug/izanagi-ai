# Runtime: trabalho pendente

> Estado em **v3.15.0** (2026-09-02). Este documento é o handoff vivo da rearquitetura do runtime: o que **ainda falta**, por que falta, e o que exatamente precisa ser feito para fechar cada item.
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Cada item declara o arquivo real onde a mudança precisa acontecer. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança.

---

## Como ler

| Marca | Significado |
|---|---|
| 🔴 | Gap que faz uma promessa da arquitetura não se cumprir hoje |
| 🟡 | Peça existe e é testada, mas **não tem caller em produção** |
| 🔵 | Não implementado, decisão consciente de escopo |

Os quinze itens da lista original foram fechados (tabela no fim). Restam três itens, todos 🔵, e todos com o mesmo motivo: **falta a decisão ou o caso de uso, não o código.** Implementá-los agora seria construir sobre suposição.

---

## 🔵 1. Sub-orquestradores hierárquicos

**Onde:** `src/runtime/orchestrator.ts`, `src/runtime/orchestration/commander.ts`.

**O que falta:** o grafo é plano. Um nó não abre um subgrafo próprio com `maxOrchestrationDepth`.

**Por que continua fora:** o Commander decompõe tudo ANTES de executar, e a quebra de tarefa do `Commander.replan` (rascunho + fechamento) já cobre o caso de "a tarefa era maior do que parecia" sem recursão. Sub-orquestração só se justifica quando existir uma tarefa que precise se decompor **durante** a execução, e nenhum caso desses apareceu. Implementar antes de ter o caso é over-engineering (regra 47), e recursão mal delimitada é a forma mais cara de errar isso.

**O que destravaria:** um objetivo real em que uma tarefa descubra, no meio da execução, que precisa de 3 a 5 sub-tarefas que o planejamento não tinha como prever. Quando aparecer, `maxOrchestrationDepth` (2, provavelmente) e um `ExecuteCtx` filho com orçamento derivado do nó pai são o desenho mínimo.

---

## 🔵 2. Programmatic tool calling (`execute_code`)

**Onde:** dependeria de `src/runtime/tools/registry.ts`.

**O que falta:** colapsar uma sequência de chamadas de tool num único script executado em sandbox, para reduzir round-trips de inferência.

**Bloqueio real:** exige **isolamento de processo**, que o framework não tem. O caminho de tool já passa por permissão declarada no contrato, trust tier por origem e sandbox de filesystem (fechado na v3.15.0), mas nada disso isola CPU, memória, rede ou syscall. Executar código arbitrário gerado por modelo sem esse isolamento é uma superfície de ataque que as camadas atuais não cobrem — e fingir que cobrem seria pior do que não ter a feature.

**O que destravaria:** uma decisão sobre o mecanismo de isolamento (worker thread com permissões do Node, container, WASM). É decisão de arquitetura e de dependência, não de implementação.

---

## 🔵 3. Ideias do Hermes ainda não avaliadas contra o Izanagi

Da pesquisa que motivou a rearquitetura, quatro itens ficaram fora **de propósito**: implementar sem comparar com o que o Izanagi já tem seria duplicação.

- **Índice de memória em SQLite FTS5 + passe de extração pós-sessão.** O Izanagi já tem `MemoryStore` (JSON) + `.agents/memoria/` (markdown) + busca textual simples. Antes de trocar por FTS5, medir se a busca atual é de fato o gargalo. Hoje não há medição que diga isso.
- **Síntese autônoma de skills a partir de trajetórias bem-sucedidas.** Já existem `SkillFactory` (criação por lacuna comprovada, com security scan) e `LearningEngine`. O que falta é o gatilho: transformar um run `VERIFIED` de N tarefas numa skill procedural. Risco alto de gerar skill genérica sem valor — exigir evidência de **recorrência** antes de sintetizar.
- **Modo daemon / cron / integração com canais (Slack, Telegram).** Muda a filosofia do produto: de CLI local-first para serviço. Mesma decisão pendente já registrada na Fase 4 do `ROADMAP.md` sobre histórico multi-dispositivo. Decidir **explicitamente** antes de escrever qualquer linha.
- **Compressão neural de contexto (LLMLingua-2).** Dependência externa pesada (modelo próprio) num framework que hoje tem **uma** dependência de runtime. `ContextResolver` + `session-diet` já entregam compressão determinística e auditável. Só reavaliar com medição mostrando que a determinística é insuficiente.

---

## Limitações conhecidas que NÃO são gaps

Coisas que alguém pode confundir com dívida ao ler o código. São escolhas, e o motivo está registrado.

- **Templates do Planner não geram nós de tool.** O caminho `kind: 'tool'` existe, é seguro e é testado; quem monta grafo com tool hoje é o SDK ou uma decomposição externa. Colocar tool nos templates exige saber QUAL tool cada workflow precisa, e isso depende do projeto do usuário.
- **Decomposição por LLM não tem caller.** `Commander.plan({ decompose })` valida e aceita decomposição externa, mas nem CLI nem SDK injetam uma. O planejamento em produção é 100% template + heurística, e é determinístico por isso — planejar não gasta token.
- **Token Benchmark mede plano, não execução.** Continua verdade e continua separado de propósito. Consumo real sai de `izanagi budget <run-id>` ou de `izanagi benchmark run --execute`; os dois números nunca dividem o mesmo campo.
- **Cache de validação economiza CPU, não token.** Nenhuma chamada de modelo é evitada, e por isso ele não aparece na telemetria de economia.
- **Estatística por domínio depende de volume.** `agentStats(agent, domain)` só é usada quando há amostra mínima naquele domínio; abaixo disso o agregado global decide. Com histórico curto, a precisão do recorte é menor que o ruído dele.

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
| 🟡 8. Skills resolvidas por run | `96714ff` | `resolveSkills` por tarefa (teto de 3), com memoização de manifesto no `SkillResolver`. |
| 🔵 9. Sub-orquestradores | — | Continua aberto por decisão. Ver item 1. |
| 🔵 10. `execute_code` | — | Continua aberto por bloqueio real de isolamento. Ver item 2. |
| 🔵 11. Cache além de resposta de modelo | `35ade52` | Cache de `validateArtifact` por `(kind, hash)` com teto de 512 e eviction FIFO. Ressalva registrada: economiza CPU, não token. |
| 🔵 12. Policy Engine fora do caminho de run | `641e198` | Nó `kind: 'tool'` roteado por `ToolRegistry` + `PolicyEngine`, com `TaskContract.permissions` (menor privilégio) e trust tier derivado da ORIGEM do arquivo do agente. Dois bugs reais corrigidos junto: `toText` podia devolver `undefined`, e caminho relativo escapava da sandbox resolvendo contra o cwd. |
| 🔵 13. Dashboard sem os campos novos | `6e0b0da` | Run Explorer mostra modo, verificação por tarefa, economia e conversa A2A. Bug corrigido: a tabela de economia referenciava campos que não existem em `TokenTelemetry`. |
| 🔵 14. Arena sem métricas de execução | `6e0b0da` | `benchmarks/arena.ts` + `izanagi benchmark run --execute`: verificação, recuperação, retries, healing, tokens e custo REAIS por caso e agregados. Métrica ausente aparece como ausente. |
| 🔵 15. Producer headless não satisfazia schema tipado | `35ade52` | `simulatedArtifact` deriva do schema real, com teste que valida TODO kind registrado contra o validador de verdade. `izanagi run` headless deixou de terminar FAIL por motivo alheio ao runtime. |
