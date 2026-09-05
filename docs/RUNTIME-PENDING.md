# Runtime: trabalho pendente

> Estado em **v3.20.0**. Handoff vivo da rearquitetura do runtime.
>
> Passagem completa da rearquitetura (o que mudou, decisões, números medidos, por onde continuar): [`HANDOFF.md`](HANDOFF.md).
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança.

---

## Estado

**Nenhum item aberto da lista anterior.** Os catorze itens que a auditoria de 2026-09-04 encontrou contra os 49 pontos de Definition of Done da especificação de evolução do runtime foram fechados na rodada de 2026-09-05, cada um com implementação, teste e medição. A tabela do fim registra como.

Esta frase já esteve errada uma vez: a versão de 2026-09-03 afirmava "nenhum item aberto" e a auditoria seguinte encontrou doze tetos e caminhos sem caller. A diferença agora é o que sustenta a afirmação: cada item fechado tem um teste que quebra se o comportamento regredir, e a seção "Limitações conhecidas que NÃO são gaps" abaixo continua listando, com motivo, tudo que foi deixado de fora por escolha.

**O que este arquivo NÃO afirma:** que o runtime está completo. Afirma que a lista de gaps verificados no código está vazia hoje, e que a próxima lista virá da próxima auditoria (ou do primeiro run contra provider real, que é onde as três limitações de medição do fim da seção seguinte deixam de ser limitações).

---

## Limitações conhecidas que NÃO são gaps

Coisas que alguém pode confundir com dívida ao ler o código. São escolhas, e o motivo está registrado.

- **Rede não é isolada na sandbox de código.** O Permission Model do Node não cobre rede: um script executado por `code.execute` pode fazer requisição de saída. Existe um teste que MEDE isso e quebra se o comportamento mudar. A mitigação é a permissão `shell` no contrato, que a `PolicyEngine` nega a trust tier `generated` e `community`. Isolar rede de verdade exige container ou firewall de processo: outra ordem de dependência.
- **O prazo por nó interrompe a espera; o CANCELAMENTO chega até a requisição.** Os dois vivem em `orchestration/deadline.ts` e a diferença está declarada lá: prazo (`timeoutMs`) tira o nó do caminho do grafo e é retentável; cancelamento (`signal`) é do run inteiro, aborta a chamada em voo e é `non-recoverable` (curar seria desobedecer quem cancelou).
- **Templates do Planner não geram nós de tool.** O planejamento gera três (`survey`, `materialize`, `deliver`), e eles são do Commander, não dos templates. Colocar tool nos *templates de workflow* exige saber QUAL tool cada workflow precisa, e isso depende do projeto de quem usa. Os três nós do Commander valem para qualquer categoria porque não presumem nada sobre o domínio.
- **Decomposição por LLM no planejamento não tem caller.** `Commander.plan({ decompose })` aceita decomposição externa, mas nem CLI nem SDK injetam uma. O planejamento em produção é template + heurística, e é determinístico por isso: planejar não gasta token. (Decomposição em EXECUÇÃO é outra coisa e existe: ver `orchestration/subgraph.ts`.)
- **Token Benchmark mede plano, não execução.** Continua separado de propósito, e os dois números nunca dividem o mesmo campo. Consumo real sai de `izanagi budget <run-id>` ou de `izanagi benchmark run --execute`; a comparação antigo vs novo em EXECUÇÃO, com as oito dimensões, sai de `izanagi benchmark run --execute --compare`.
- **Cache de validação economiza CPU, não token.** Nenhuma chamada de modelo é evitada, e por isso não aparece na telemetria de economia.
- **Cache de resposta e reuso de artefato são opt-in, desligados por default.** `cacheHits`/`cacheMisses` saem 0/0 num run normal, e a CLI rotula "(desligado)" em vez de mostrar 0% de aproveitamento: zero medido e zero por não ter medido são coisas diferentes. `--reuse-artifacts` liga o reuso entre runs, cuja política de invalidação está declarada em `reuseKey()` e cujo prazo está em `DEFAULT_REUSE_MAX_AGE_MS`.
- **Estatística por domínio depende de volume.** `agentStats(agent, domain)` só decide com amostra mínima no domínio; abaixo disso vale o agregado global.
- **A medição de compressão não avalia qualidade.** Mede razão de tamanho, não se o que sobrou é o que importava. Avaliar isso exigiria gabarito anotado, e é por isso que a reavaliação de compressão neural fica condicionada a essa medida existir.
- **A materialização não toca a fonte do projeto, e isso é a decisão.** Os arquivos declarados pelo agente vão para `<output>/<slug>/`. Aplicar por cima do código exigiria uma garantia que nenhuma verificação determinística consegue dar hoje; quem quer aplicar revisa e copia, que é onde uma pessoa olha o diff.
- **O manifesto só é reconhecido no formato combinado** (`### FILE: <caminho>` + bloco de código, que o contrato da tarefa pede). Inferir caminho do texto ao redor ou do nome da linguagem na cerca seria adivinhar o destino de um arquivo que vai ser gravado: erro que só aparece depois de gravado.
- **`references-exist` mede LUGAR, não semântica.** Confere que o diretório citado existe; não confere que a função citada exista dentro do arquivo. Isso exigiria análise sintática por linguagem, e o `python-engine/ast_analyzer` já faz parte disso.
- **O survey conta, não julga.** Devolve stack, contagem por extensão e manifestos; não devolve "o projeto usa arquitetura X". Quem interpreta é o agente a jusante, e a separação é deliberada: um levantamento que já conclui é um levantamento que já errou.
- **Grounding não foi medido contra ausência de grounding.** A comparação honesta (mesmo objetivo, mesmo provider, com e sem `--survey`, contra um gabarito de acerto) exige provider real. Está no "por onde continuar", não nos números.
- **O nó de teste mede a suíte do projeto, não o efeito da entrega.** `--verify-tests` executa o comando de teste do projeto DEPOIS da materialização, com o exit code do processo. Quando o `--output` cai fora da árvore que a suíte cobre, o que ele mede é a linha de base do projeto — o artefato declara o comando e o diretório justamente para que quem lê saiba qual dos dois casos está olhando.
- **A nota de qualidade do plano é de VERIFICAÇÃO, não de resultado.** `--min-quality` compara compromissos que o plano assume sobre verificar o próprio trabalho (política estrita, revisão independente, avaliação, critério semântico, critério que não vem do schema). Um plano com mais verificação não produz trabalho melhor: produz mais evidência sobre o trabalho, que é a única das duas que se pode garantir antes de executar.
- **O reuso de artefato depende do Commander.** A chave sai do CONTRATO da tarefa (objetivo, restrições, critérios), e o caminho legado por categoria (`--no-commander`) não tem contrato: lá não há do que derivar a chave, e nada é reaproveitado.
- **Cache de resultado de tool não existe, e não é esquecimento.** Nenhuma tool builtin é função pura da entrada: `fs.read`/`fs.ls`/`project.survey` dependem do disco (mutável), `fs.write` e `code.execute` têm efeito colateral, e cachear um write significaria não escrever. Um cache correto para as de leitura precisaria de `mtime`+`size` na chave, e o `stat` custa quase o mesmo que a leitura pequena que ele evitaria. Decisão medida, não pendência.
- **Sub-orquestração só é oferecida a papel `commander` em modo `autonomous`.** Não é limitação técnica: é onde o planejamento tem mais chance de subestimar escopo e onde o orçamento comporta a divisão.
- **`UNVERIFIED` deixa o nó seguir como `succeeded`.** Sem juiz semântico (o default sem provider, e o de `--no-judge`) todo critério semântico fica sem evidência conclusiva, e derrubar o nó transformaria "não medi" em "está errado". O que a rodada de 2026-09-04 acrescentou foi o nó CARREGAR o fato (`node.metadata.unverified` + mensagem A2A de tipo `evidence`), para que aprovado sem prova seja distinguível de comprovado.
- **Sem daemon, porta ou credencial em repouso.** Local-first é decisão de produto. Quem agenda é o cron ou o Task Scheduler do sistema, e `--json` + exit code com significado (0/1/2) + `--notify-webhook` fecham esse caminho. O payload do webhook leva metadado, nunca conteúdo de artefato.

---

## Fechados na rodada de 2026-09-05

Os catorze itens que a auditoria de 2026-09-04 deixou abertos. Cada linha tem o teste que a sustenta.

| Item aberto | Como foi fechado |
|---|---|
| 1. A camada determinística não roda teste, compilação, lint nem typecheck | Tool `project.test` (permissão `shell`), nó `verify-tests` no fim do grafo e check `exit-zero`. A métrica `testResults` passa a vir do exit code com `--verify-tests`; sem a flag, o caminho antigo continua e a regressão declara "derivado do artefato test-results, NÃO de execução". O comando vem do PROJETO e o binário de uma allowlist fixa: `spawn` com `shell: false`, e um campo `command` na entrada é ignorado (`project-test.test.ts`) |
| 2. Critérios de aceite falam da FORMA do artefato, não do objetivo | `--acceptance` / `IzanagiRunOptions.acceptance`. Prefixo conhecido vira check determinístico, prosa vira critério semântico. Alvo: as tarefas TERMINAIS de produto. Entrada malformada é recusada em voz alta na CLI e levanta erro no SDK (`acceptance.test.ts`) |
| 3. Decision Journal é write-only | Cada decisão leva o objetivo; `recordOutcome` carimba o veredito no fim do run; `findRelevant` recupera por semelhança de objetivo, só decisões com resultado. O planejamento tira da disputa o agente que falhou duas vezes no mesmo objetivo, inclusive nos nós vindos do template (`decision-journal.test.ts`) |
| 4. A camada Semantic da memória nunca é escrita pelo runtime | `appendKnowledge` grava conhecimento reutilizável com a mesma barra de recorrência da síntese de skill (3 execuções verificadas), idempotente pelo título. E `MemoryStore.search()` passa a ser consultado pelo Context Resolver, por tarefa, com teto de 2 entradas e 600 chars (`semantic-memory.test.ts`) |
| 5. Cost-aware planning não compara estratégias alternativas | `--min-quality` declara o piso; os modos até o sugerido viram candidatos; vence o mais barato que atinge o piso. Piso inalcançável não sobe o modo em silêncio. `planQuality` é monótona, e há teste que quebra se acrescentar um nó pouco verificado abaixar a nota (`plan-candidates.test.ts`) |
| 6. Reutilização de artefato entre runs | `reuseKey()` + `findReusable()` + `--reuse-artifacts`. A política de invalidação vem antes do cache: artefato inválido, fora do prazo ou de outro tipo é recusado, o conteúdo é revalidado contra o schema atual, e run sem survey é chave DIFERENTE de run com survey (`artifact-reuse.test.ts`) |
| 7. Lineage rasa e comparação só por score | `lineage()` atravessa ancestrais e descendentes em largura, com marca de visitado; `compare()` diz o que mudou entre versões (linhas, checksum), e "não deu para comparar" nunca vira "não mudou" (`lineage.test.ts`) |
| 8. `HUMAN_REQUIRED` não é um estado | Cada abort por teto marca QUAL teto, e o status do run vira `HUMAN_REQUIRED`. O veredito da avaliação continua `FAIL`: ela mede a entrega, o status carrega o fato do processo (`human-required.test.ts`) |
| 9. `maxCost` não é limite do Healer | `HealingInput.costUsd` / `maxCostUsd`, conferidos ANTES de decidir curar. `spend()` age depois da chamada, que é tarde demais para não fazê-la (`human-required.test.ts`) |
| 10. `PolicyEngine` é default-allow, e `requiresApproval` é ignorado | O default permanece, com o motivo escrito, e o caso perigoso ganhou regra própria: `EXTERNAL-TOOL-001` exige aprovação humana para tool registrada em runtime. `requiresApproval` passou a ter caminho: vira pausa por `izanagi approve`, não falha que o healing retentaria (`policy-external-tool.test.ts`) |
| 11. A comparação antigo vs novo cobre 3 de 8 dimensões | `ExecutionEvidence` ganhou `modelCalls`, `agentCalls` e `successRate`; `benchmark run --execute --compare` imprime as oito nos dois caminhos, sob o mesmo teto por caso. Chamadas contam por TENTATIVA, e nó reaproveitado não conta (`arena.test.ts`) |
| 12. As skills não declaram o metadado pelo qual são encontradas | As 22 mais acionadas pelas chains declaram `triggers` e `capabilities` em campo próprio. Três gates: os campos existem, acrescentam vocabulário que a description não tem, e o ranking encontra `tdd` por "red-green-refactor" (`skill-metadata.test.ts`) |
| 13. `allowedTools` não é exposto na CLI | `--allow-tool`, repetível e com forma separada por vírgula (`acceptance.test.ts`) |
| 14. Checksum de artefato é sha1 truncado, e não há campo de metadado livre | `checksum` (sha256 completo) ao lado de `hash`, que continua o que era porque é o que os registros gravados carregam; `metadata` livre com teto de 4KB, recusado INTEIRO quando estoura (`lineage.test.ts`) |

---

## Fechados na rodada de 2026-09-04

Doze itens que existiam no código e não tinham caller. Detalhe de cada um no `CHANGELOG.md`.

| Item | Como |
|---|---|
| `recordRetry()` sem caller: `maxRetries` morto e `telemetry.retries` sempre 0 | Contado no ponto da reexecução, ANTES de gastar a chamada. Teto barra. Aprovação pendente não conta |
| `maxAgents` contava e não barrava | Retorno de `recordAgent` passou a decidir |
| Teto de run estourado era retentado como falha transitória de `tool` | Regra `non-recoverable` para teto excedido, antes da regra de `tool` |
| `node.timeoutMs` / `budget.maxTimeMs` declarados em todo o planejamento e nunca aplicados | `orchestration/deadline.ts`, o menor dos dois. Interrompe a espera, e o limite está declarado |
| Plano B do Commander inalcançável pelo caminho de falha mais comum | 1ª falha de validação troca skill, 2ª replaneja |
| `RoutingContext` congelado no run inteiro | `contextForNode`: janela, risco, raciocínio, tools e histórico por tarefa |
| `LOCAL_MAX_CONCURRENCY` sem nenhuma referência | `--local` serializa o pool; `--max-concurrency` expõe o teto na CLI |
| `parseFrontmatter` não lia o formato que a `SkillFactory` escreve | Lista de bloco YAML. Ausência de valor segue string vazia, nunca `[]` |
| `optional` por id literal `'critic'` | Derivado do artefato produzido. `evaluation` nunca é reforço |
| Checkpoint só no fim da tentativa | Persistido ao fim de cada batch, antes de decidir sobre a falha |
| `VerificationEngine.isDone` sem caller, docstring contradizendo o código | `node.metadata.unverified` + mensagem A2A; docstring corrigido |
| Lista literal de 19 agentes decidindo se a Agent Factory gera | `AgentCapabilityRegistry.ids()`, com fallback no caminho legado |
| Cancelamento cooperativo inexistente (era o item aberto 1 desta lista) | `OrchestratorOptions.signal` / `IzanagiRunOptions.signal`, conferido no topo de cada batch e combinado com o timeout HTTP no cliente de modelo. Ctrl-C na CLI cancela em vez de matar o processo, e o checkpoint **não** é apagado num run cancelado: apagar tornaria `izanagi resume` impossível no único caso em que ele é claramente o que se quer |
| Falha `non-recoverable` era RETENTADA quando casava com padrão da memória | O corte por `non-recoverable` passou a vir antes do passo de padrão conhecido, que devolve `retryNow`. Valia para permissão negada e teto de run desde antes: a regra existia no topo do `KIND_RULES` e o fluxo a contornava |
| Registry descartava `model`, `permissions` e `evaluation` de 22/22 agentes | `modelHint`, `declaredPermissions` (prosa, não permissão de runtime), `evaluation` |
| `BenchmarkCase` sem `budget` nem `allowedTools` | Campos por caso, aplicados por `benchmark run --execute` |
| Verificação por tarefa não emitia evento | `task.verification.passed` / `.failed`, com aliases de SDK |
| Banner de versão dos docs sem gate: 8 minors de drift | `scripts/doc-version.ts`, teste de gate, aviso no `bump`, parada no `release` |

---

## Fechados nas rodadas anteriores

| Item original | Fechado em | Como |
|---|---|---|
| 🔴 1. Degradação registrada mas nunca aplicada | `8a5d04c` | Cada degrau muda a execução: contexto pela metade, saída a 60%, `demoteRole`, concorrência dividida, opcionais cortadas, pausa por aprovação. Limiar por degrau e pressão pela maior razão **por fase**. |
| 🔴 2. Artefato sem content store | `8a5d04c` | Conteúdo em `.izanagi/state/artifacts/<runId>/`, com `contentRef`, teto de 512KB e truncamento declarado. |
| 🔴 3. Paralelismo sem teto de concorrência | `8a5d04c` | Pool com ordem preservada e falha isolada, default 3, reduzido pela degradação. |
| 🟡 4. Protocolo A2A e crítica sem caller | `c108699` | `interpretCritique`: crítica bloqueante reprova o nó criticado com correção mínima. `ConversationLog` por referência de artefato. `critique` virou ArtifactKind com formato obrigatório. |
| 🟡 5. Juiz semântico não injetado | `e977b7a` | `verification/judge.ts` no papel `worker`. Saída ilegível vira `inconclusive`, nunca reprovação. `--no-judge` desliga. |
| 🟡 6. Replan não passa pelo Commander | `e803837` | `Commander.replan`: troca agente → sobe papel → quebra em duas. Só o delta da falha; `changes` vazio quando não há alternativa. |
| 🟡 7. Memória não informa o planejamento | `96714ff` | Padrão de falha sobe o modo um degrau; agente com histórico ruim sai da disputa. **Correção de 2026-09-04:** esta linha dizia "consulta no Decision Journal", e o código nunca fez isso: `DecisionJournal.search()` não tem caller. O journal é gravado no planejamento, não consultado. Ver item aberto 4. |
| 🟡 8. Skills resolvidas por run | `96714ff` | `resolveSkills` por tarefa (teto de 3), com memoização de manifesto. |
| 🔵 9. Cache além de resposta de modelo | `35ade52` | `validateArtifact` por `(kind, hash)`, teto 512, FIFO. Economiza CPU, não token. |
| 🔵 10. Producer headless não satisfazia schema | `35ade52` | `simulatedArtifact` derivado do schema real, com teste sobre TODO kind registrado. |
| 🔵 11. Estatística de agente global | `35ade52` | `AgentStats.byDomain`; ausência no domínio é ausência de sinal, não sinal ruim. |
| 🔵 12. Policy Engine fora do caminho de run | `641e198` | Nó `kind: 'tool'` por `ToolRegistry` + `PolicyEngine`, `TaskContract.permissions`, trust tier pela ORIGEM do arquivo. Corrigidos: `toText` devolvendo `undefined` e caminho relativo escapando da sandbox pelo cwd. |
| 🔵 13. Dashboard sem os campos novos | `6e0b0da` | Modo, verificação por tarefa, economia e conversa A2A no Run Explorer. Corrigidos os campos inexistentes na tabela de economia. |
| 🔵 14. Arena sem métricas de execução | `6e0b0da` | `benchmark run --execute`: verificação, recuperação, retries, healing, tokens e custo reais. Métrica ausente aparece como ausente. |
| 🔵 15. Sub-orquestradores hierárquicos | `5ae9b57` | `orchestration/subgraph.ts`: decomposição em execução com orçamento do pai DIVIDIDO, profundidade com teto do runtime, largura máxima 5, sub-tarefa não decompõe, pedido malformado recusado inteiro. |
| 🔵 16. `execute_code` | `1387bb0` | `tools/code-sandbox.ts`: processo isolado com Permission Model. FS restrito ao diretório de trabalho, subprocessos/workers/addons bloqueados, ambiente montado do zero, timeout com kill. Rede continua não isolada, e isso está testado como limite. |
| 🔵 17. Síntese de skills por trajetória | `4490dbf` | `evolution/trajectories.ts`: barra de recorrência (3 execuções verificadas), assinatura por caminho e não por objetivo, skill que declara o próprio limite. |
| ⏸ 19. Local-first ou serviço hospedado | `v3.17.0` | Decisão tomada: local-first. `--json`, código de saída com significado (0/1/2) e `--notify-webhook` fecham o caminho pelo agendador do SO, sem processo de longa duração. Payload leva metadado, nunca conteúdo. |
| 🔵 3b. Templates sem nós de tool em produção | `v3.18.0` | O planejamento gera `survey` (`fs:read`, cabeça do grafo) e `deliver` (`fs:write`, fim). O critério `file-exists` passou a significar "o runtime gravou isto" em vez de "existe um arquivo com esse nome". Menor privilégio verificado nó a nó. |
| 🔵 18. FTS5 e compressão neural | `4490dbf` | `izanagi benchmark memory` mede e aplica limiar declarado: busca p95 2.0ms sobre 296KB (FTS5 não se paga), compressão a 8.3% do original (neural não se justifica pelo tamanho). Bug encontrado pela medição: a busca tinha recall truncado em 4000 chars por arquivo. |
