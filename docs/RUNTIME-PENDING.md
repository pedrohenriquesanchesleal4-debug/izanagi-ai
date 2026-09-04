# Runtime: trabalho pendente

> Estado em **v3.18.0 + rodada de 2026-09-04**. Handoff vivo da rearquitetura do runtime.
>
> Passagem completa da rearquitetura (o que mudou, decisões, números medidos, por onde continuar): [`HANDOFF.md`](HANDOFF.md).
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança.

---

## Estado

**Catorze itens abertos.** A versão anterior deste arquivo afirmava "nenhum item aberto", e a auditoria de 2026-09-04 contra os 49 itens de Definition of Done da especificação de evolução do runtime refutou isso: doze tetos e caminhos existiam no código sem caller nenhum. Esses doze foram fechados naquela rodada, mais o cancelamento cooperativo, que era o primeiro item aberto desta lista e foi fechado na mesma sessão (tabela no fim). Os catorze abaixo são o que a mesma auditoria encontrou e **não** fechou.

A correção do próprio arquivo importa tanto quanto os consertos: um documento de pendências que afirma estar vazio é a pior versão da família de defeitos que este runtime existe para combater. Três afirmações da versão anterior não se sustentavam no código, e estão corrigidas: **retries honrado pelo `budgetLimits`** (o teto era morto), **consulta no Decision Journal no planejamento** (o journal é write-only) e a implicação de que a camada determinística cobre teste e compilação (não cobre).

---

## Itens abertos

Em ordem de valor por esforço. Cada um tem o critério de pronto.

### 1. A camada determinística não roda teste, compilação, lint nem typecheck

Os checks determinísticos são `artifact-valid | min-size | contains | not-contains | matches | json-field | file-exists | references-exist`. Nenhum subprocesso do projeto roda no runtime, e `command` é excluído por decisão registrada. Consequência medida: a métrica `tests` da avaliação é derivada de um artefato `test-results` que um AGENTE ESCREVEU. Ninguém executou teste.

Isso interage com uma decisão de segurança já tomada: `code.execute` bloqueia subprocessos de propósito, então ele não roda `npm test`, e afrouxar o isolamento para caber neste item seria trocar uma garantia real por uma métrica.

*Pronto quando:* existir um check determinístico que execute o comando de teste do projeto sob política explícita (permissão própria, allowlist de comando, timeout, orçamento) e a métrica `tests` passar a vir do exit code, com o caminho antigo marcado como derivado de artefato.

### 2. Critérios de aceite falam da FORMA do artefato, não do objetivo

O Commander gera critérios para todo nó, derivados do schema real do artefato: `contains "title"`, `min-size 200`, `not-contains "TODO"`. Nada no plano verifica o que o usuário pediu: "adicionar paginação em GET /users" não gera nenhum critério sobre paginação. E não existe caminho para o usuário FORNECER critérios: nenhuma flag de CLI, campo de SDK ou input aceita `acceptance`. Ou seja, o "o Commander gera quando o usuário não fornece" é sempre.

*Pronto quando:* `IzanagiRunOptions.acceptance` e uma flag de CLI equivalente injetarem critérios no contrato dos nós relevantes, com validação recusando critério determinístico sem check (o `validateContract` já faz isso).

### 3. Decision Journal é write-only

Existe, é estruturado, tem teto de 500 entradas e **não** é enviado ao modelo, que é o comportamento certo. Mas `DecisionJournal.search()` não tem caller e `forRun` só é lido por `izanagi explain`: é log de auditoria para humano, não retrieval. Faltam também campos que a especificação pede: `goal`, `plan`, `verification`, `failure`, `correction`. Verificação e correção vivem em `this.verifications` e no `ConversationLog`, sem chave comum além do `runId`.

*Pronto quando:* o planejamento consultar o journal por objetivo semelhante (recuperação SELETIVA, como `findRelevantFailures` já faz) e as decisões carregarem o resultado da execução que elas causaram.

### 4. A camada Semantic da memória nunca é escrita pelo runtime

`MemoryStore` lê `.agents/memoria/semantica.md` e nenhum código do runtime escreve nesses markdowns. O que o runtime grava é `addLearning` numa lista plana. E `MemoryStore.search()` (o retrieval textual sobre semantic/episodic) não tem caller em runtime: só a CLI e o benchmark. Durante um run, a única recuperação é padrão de falha.

*Pronto quando:* houver um caminho que escreva conhecimento reutilizável na camada semântica com barra de recorrência declarada (a síntese por trajetória já tem uma: 3 execuções verificadas) e `search()` for consultado pelo Context Resolver, filtrado por tarefa.

### 5. Cost-aware planning não compara estratégias alternativas

A estimativa existe, é injetada em produção e usa o MESMO caminho de roteamento da execução, então o número não é decorativo. O que não existe é a comparação: não há geração de 2+ planos candidatos nem escolha do mais barato entre equivalentes. O único ajuste é descer a escada de modo, que é redução de ESCOPO (menos nós, menos verificação), não uma estratégia equivalente mais barata. E não existe piso de qualidade configurável (`minQuality` / `qualityFloor`: zero ocorrências no código), então "respeitando a qualidade mínima configurada" não tem o que respeitar.

*Pronto quando:* `Commander.plan` produzir candidatos, `estimate` pontuar cada um, e a escolha registrar no Decision Journal por que o mais barato foi (ou não foi) aceito contra um piso declarado.

### 6. Reutilização de artefato entre runs

`ArtifactRegistry.readContent` só é chamado por `izanagi explain`. Nenhum caminho de execução consulta artefato de run anterior por hash/kind para evitar recomputar. Um segundo run do mesmo objetivo sobre o mesmo projeto refaz tudo.

*Pronto quando:* existir chave por `(kind, hash dos insumos)` e política de invalidação declarada. Sem a invalidação isto vira cache que devolve resposta velha com cara de nova, que é pior que não ter cache.

### 7. Lineage rasa e comparação só por score

O lineage é de um salto (arestas `dependencies` + `consumers`), sem travessia de ancestrais ou descendentes. "Comparação" é score e validade entre versões, não diff de conteúdo. As arestas já estão gravadas, então o esforço é baixo.

### 8. `HUMAN_REQUIRED` não é um estado

A especificação pede que exceder limites de healing termine em `HUMAN_REQUIRED`. Hoje termina em `abort` e veredito `FAIL`. O único estado de espera humana é `BLOCKED`, e vem de outro caminho (nó `approval` ou a degradação `require-human-approval`). Um run que esgotou retries deveria ser distinguível de um run que falhou por bug: hoje não é.

### 9. `maxCost` não é limite do Healer

`HealingInput` tem tempo, tokens e tentativas, e não tem custo. O teto de custo só age por `ExecutionBudget.spend`, ou seja depois de a chamada acontecer. A decisão de curar não consulta o custo.

### 10. `PolicyEngine` é default-allow, e `requiresApproval` é ignorado

Sem regra casada, a política permite. Isso só é relevante quando existir tool de terceiro registrada por `ToolRegistry.register` (as builtin são todas cobertas por regra), e a rodada de 2026-09-04 acrescentou uma camada acima: `allowedTools` recusa a tool antes de a política opinar. Ainda assim, `PolicyDecision.requiresApproval` existe e `registry.execute` só olha `allowed`: não há caminho de tool para aprovação humana.

### 11. A comparação antigo vs novo cobre 3 de 8 dimensões

`token-benchmark.ts` compara de verdade (não é só medição do atual): reproduz a heurística legada e contrasta com o Commander. Mas só em tokens (teto), model calls e custo de catálogo. **Faltam latência, agent calls, retries, taxa de sucesso e taxa de verificação**, e não existe campo para eles. As métricas de execução moram na Arena e nunca são comparadas contra o caminho legado: não há `legacyExecution` em lugar nenhum.

*Pronto quando:* existir um relatório com as oito dimensões medidas nos dois caminhos, sob o mesmo provider.

### 12. As skills não declaram o metadado pelo qual são encontradas

Medido nas 106 skills de `skills/`: **só `name` e `description` são declarados**. Zero têm `triggers`, `capabilities`, `inputs`, `outputs`, `permissions`, `risk` ou `token_budget`. Todo o resto vem de default no `readSkill`, então o haystack de `rankSkills` inclui `manifest.triggers` e `manifest.capabilities` que são sempre arrays vazios: o ranking escolhe entre 106 descrições soltas.

O parser deixou de ser o gargalo na rodada de 2026-09-04 (`parseFrontmatter` passou a ler lista de bloco, que é o formato que a `SkillFactory` escreve). O que falta é o catálogo declarar. No catálogo v2 (`.skills/`) os gatilhos existem como PROSA dentro da `description` ("Gatilhos de ativação: ..."), o que funciona para relevância léxica e não para nenhum consumidor estruturado.

*Pronto quando:* o `SkillManifest` do disco declarar triggers e capabilities em campo próprio nas skills mais usadas, e existir teste que quebre se o campo voltar a ficar vazio em massa.

### 13. `allowedTools` não é exposto na CLI

A allowlist de tools existe no `Orchestrator`, no SDK e no `BenchmarkCase`. `izanagi run` não tem flag para ela.

### 14. Checksum de artefato é sha1 truncado, e não há campo de metadado livre

`ArtifactRecord.hash` é sha1 truncado em 12 hex (48 bits) e faz o papel de checksum. Não existe campo `metadata` livre no registro, então quem produz um artefato não tem onde anexar contexto que não seja um campo previsto.

---

## Limitações conhecidas que NÃO são gaps

Coisas que alguém pode confundir com dívida ao ler o código. São escolhas, e o motivo está registrado.

- **Rede não é isolada na sandbox de código.** O Permission Model do Node não cobre rede: um script executado por `code.execute` pode fazer requisição de saída. Existe um teste que MEDE isso e quebra se o comportamento mudar. A mitigação é a permissão `shell` no contrato, que a `PolicyEngine` nega a trust tier `generated` e `community`. Isolar rede de verdade exige container ou firewall de processo: outra ordem de dependência.
- **O prazo por nó interrompe a espera; o CANCELAMENTO chega até a requisição.** Os dois vivem em `orchestration/deadline.ts` e a diferença está declarada lá: prazo (`timeoutMs`) tira o nó do caminho do grafo e é retentável; cancelamento (`signal`) é do run inteiro, aborta a chamada em voo e é `non-recoverable` (curar seria desobedecer quem cancelou).
- **Templates do Planner não geram nós de tool.** O planejamento gera três (`survey`, `materialize`, `deliver`), e eles são do Commander, não dos templates. Colocar tool nos *templates de workflow* exige saber QUAL tool cada workflow precisa, e isso depende do projeto de quem usa. Os três nós do Commander valem para qualquer categoria porque não presumem nada sobre o domínio.
- **Decomposição por LLM no planejamento não tem caller.** `Commander.plan({ decompose })` aceita decomposição externa, mas nem CLI nem SDK injetam uma. O planejamento em produção é template + heurística, e é determinístico por isso: planejar não gasta token. (Decomposição em EXECUÇÃO é outra coisa e existe: ver `orchestration/subgraph.ts`.)
- **Token Benchmark mede plano, não execução.** Continua separado de propósito. Consumo real sai de `izanagi budget <run-id>` ou de `izanagi benchmark run --execute`. O que É gap é a comparação antigo vs novo não cobrir as oito dimensões: item 12.
- **Cache de validação economiza CPU, não token.** Nenhuma chamada de modelo é evitada, e por isso não aparece na telemetria de economia.
- **Cache de resposta é opt-in desligado por default.** `cacheHits`/`cacheMisses` saem 0/0 num run normal, e a CLI rotula "(desligado)" em vez de mostrar 0% de aproveitamento: zero medido e zero por não ter medido são coisas diferentes.
- **Estatística por domínio depende de volume.** `agentStats(agent, domain)` só decide com amostra mínima no domínio; abaixo disso vale o agregado global.
- **A medição de compressão não avalia qualidade.** Mede razão de tamanho, não se o que sobrou é o que importava. Avaliar isso exigiria gabarito anotado, e é por isso que a reavaliação de compressão neural fica condicionada a essa medida existir.
- **A materialização não toca a fonte do projeto, e isso é a decisão.** Os arquivos declarados pelo agente vão para `<output>/<slug>/`. Aplicar por cima do código exigiria uma garantia que nenhuma verificação determinística consegue dar hoje; quem quer aplicar revisa e copia, que é onde uma pessoa olha o diff.
- **O manifesto só é reconhecido no formato combinado** (`### FILE: <caminho>` + bloco de código, que o contrato da tarefa pede). Inferir caminho do texto ao redor ou do nome da linguagem na cerca seria adivinhar o destino de um arquivo que vai ser gravado: erro que só aparece depois de gravado.
- **`references-exist` mede LUGAR, não semântica.** Confere que o diretório citado existe; não confere que a função citada exista dentro do arquivo. Isso exigiria análise sintática por linguagem, e o `python-engine/ast_analyzer` já faz parte disso.
- **O survey conta, não julga.** Devolve stack, contagem por extensão e manifestos; não devolve "o projeto usa arquitetura X". Quem interpreta é o agente a jusante, e a separação é deliberada: um levantamento que já conclui é um levantamento que já errou.
- **Grounding não foi medido contra ausência de grounding.** A comparação honesta (mesmo objetivo, mesmo provider, com e sem `--survey`, contra um gabarito de acerto) exige provider real. Está no "por onde continuar", não nos números.
- **Cache de resultado de tool não existe, e não é esquecimento.** Nenhuma tool builtin é função pura da entrada: `fs.read`/`fs.ls`/`project.survey` dependem do disco (mutável), `fs.write` e `code.execute` têm efeito colateral, e cachear um write significaria não escrever. Um cache correto para as de leitura precisaria de `mtime`+`size` na chave, e o `stat` custa quase o mesmo que a leitura pequena que ele evitaria. Decisão medida, não pendência.
- **Sub-orquestração só é oferecida a papel `commander` em modo `autonomous`.** Não é limitação técnica: é onde o planejamento tem mais chance de subestimar escopo e onde o orçamento comporta a divisão.
- **`UNVERIFIED` deixa o nó seguir como `succeeded`.** Sem juiz semântico (o default sem provider, e o de `--no-judge`) todo critério semântico fica sem evidência conclusiva, e derrubar o nó transformaria "não medi" em "está errado". O que a rodada de 2026-09-04 acrescentou foi o nó CARREGAR o fato (`node.metadata.unverified` + mensagem A2A de tipo `evidence`), para que aprovado sem prova seja distinguível de comprovado.
- **Sem daemon, porta ou credencial em repouso.** Local-first é decisão de produto. Quem agenda é o cron ou o Task Scheduler do sistema, e `--json` + exit code com significado (0/1/2) + `--notify-webhook` fecham esse caminho. O payload do webhook leva metadado, nunca conteúdo de artefato.

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
