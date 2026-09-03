# Changelog

> All notable changes to the IZANAGI AI framework.

---

## [3.18.0]: 2026-09-02

O caminho seguro de tool existia desde a 3.15.0, era testado, e nenhum `izanagi run` passava por ele. Nesta versão o planejamento gera dois nós de tool em produção: um que **lê o projeto** antes de decidir, outro que **entrega arquivo** no fim.

### Added
- **`--output <dir>` / `output` no SDK — nó `deliver`.** Primeiro nó `kind: 'tool'` gerado pelo planejamento em produção. Grava o que o run produziu num documento único dentro do projeto, com contrato concedendo `fs:write` e mais nada. A verificação do nó confere o arquivo escrito: um critério `file-exists` sobre arquivo que ninguém escreveu passa quando o arquivo já existia por outro motivo; aqui ele passa a significar "o runtime gravou isto". O nome sai do objetivo, então repetir o mesmo objetivo reescreve a mesma entrega — entrega é produto, e o histórico continua em `.izanagi/state/`. `IzanagiRunResult.deliveredTo` só aparece quando a gravação realmente aconteceu.
- **`project.survey` — nó `survey` na cabeça do grafo.** Levantamento determinístico do repositório: stack por manifesto e por volume de arquivo, manifestos resumidos, árvore por extensão, entrypoints e o começo do README. Não custa token; tem teto de profundidade (3) e de entradas, e **declara o próprio corte** (`truncated` é campo obrigatório do schema). Só as raízes do grafo dependem dele — repetir o levantamento em cada prompt seria a duplicação de contexto que a arquitetura proíbe. Ligado por default quando o diretório tem manifesto reconhecido; `--no-survey` desliga; modo `direct` nunca paga.
- **Marcadores de input de tool** (`runtime/tools/input-refs.ts`): `{ $artifact: '<nó>' }` e `{ $deliverable: true }` resolvidos deterministicamente na hora da chamada, porque um nó de tool é declarado no plano antes de existir o que ele vai gravar. Referência a nó inexistente é erro, nunca string vazia. `code.execute` recusa marcador em qualquer campo do input: levar saída de modelo para dentro de código executado é injeção com outro nome.
- **Kinds de artefato `delivery` e `project-survey`**, com schema próprio. `delivery` exige `written` (o comprovante da escrita, não o conteúdo); `project-survey` exige `root`, `stack`, `tree` e `truncated`.
- **`OrchestratorOptions.workspaceDir`**: raiz do projeto do usuário, separada da raiz do framework.

- **`project.materialize` — nó `materialize`, o código do agente vira arquivo.** O Blueprint Engine já definia o contrato de materialização (declare a árvore, escreva cada arquivo completo, zero stub) mas só em `--prompt-only`: um texto para a pessoa colar em outra ferramenta. Dentro do runtime o contrato não existia, e o código entregue ia para o content store como texto. Agora o contrato da tarefa PEDE o formato (`### FILE: <caminho>` + bloco de código) e um parser determinístico o materializa. **A fronteira que torna isto defensável**: os arquivos vão para um subdiretório da SAÍDA (`<output>/<slug do objetivo>/`), nunca por cima do código do projeto — o que o runtime produz fica num lugar que o usuário nomeou e pode revisar, apagar ou copiar. **Tudo ou nada**: a validação roda sobre o manifesto inteiro antes de qualquer escrita, porque "6 arquivos escritos, 3 recusados" é o relatório que engana. Recusa caminho absoluto, escape de diretório, caminho duplicado, arquivo vazio e arquivo com marca de trabalho não feito. Só entra no plano quando existe artefato que pode carregar código (`implementation`, `fixes`, `database-schema`, `api-contract`).
- **Fundamentação medida e reportada em `izanagi run`**: dos caminhos que os artefatos citaram, quantos existem no projeto. É a única métrica que fala sobre o CONTEÚDO e não sobre a mecânica do runtime — verificação alta com fundamentação baixa é um run que cumpriu todos os critérios de schema descrevendo um projeto que não existe, e essa combinação é invisível em qualquer outra métrica. Conta REFERÊNCIAS e não artefatos (um plano que cita vinte caminhos e uma ADR que cita um não podem pesar igual). A Arena tem o campo e o agrega, mas **não o mede nos casos embutidos de propósito**: eles são tarefas sintéticas ("desenhe a arquitetura de um monólito modular para um SaaS de faturamento") que não falam do projeto onde o comando roda — um artefato correto para o caso citaria `src/modules/billing/` e sairia como não fundamentado em qualquer projeto real. O número existiria, pareceria significativo, e mediria a coisa errada; o relatório diz `n/a`. É o instrumento que a pergunta em aberto "o grounding melhora o resultado?" precisa para deixar de ser argumento e virar número.
- **`produced` no payload de `--json` e do webhook**: o que o run gravou no projeto — o documento entregue e os arquivos materializados —, em caminhos RELATIVOS. É o que faltava para um agendador saber se há trabalho novo no disco sem abrir o trace. Caminho é metadado e cabe na regra do payload; caminho absoluto não cabe, porque carrega o diretório do usuário para um endpoint que costuma ser um canal de equipe. Ausente quando nada foi gravado, e ausência ali significa "não gravou", não "não sei".
- **Teto total do documento entregue** (512KB). O teto por seção (128KB) sozinho não limitava nada: um run de nove nós produzia um documento de mais de um megabyte. Passado o teto, as seções seguintes entram como referência para `.izanagi/state/artifacts/` em vez de conteúdo — o leitor continua sabendo que o artefato existe e onde encontrá-lo inteiro.
- **Outcome `not-applicable` na Verification Engine.** Distinto de `unknown`, e a diferença não é cosmética: `unknown` é "havia uma pergunta e a resposta não foi obtida" (juiz ausente) e NUNCA vira aprovação; `not-applicable` é "a pergunta não existe para este artefato". Groundedness sobre uma ADR que não cita arquivo nenhum não está sem resposta — está respondida por vacuidade. Sem essa distinção, o check novo derrubava todo artefato de prosa para `UNVERIFIED` e um `izanagi run` headless completo caía de `PASS` para `FAIL`. Critério inaplicável sai da conta: não conta como aprovado (não houve prova) nem como pendente (não há o que provar).
- **Check determinístico `references-exist` (groundedness).** A Verification Engine perguntava se o artefato tem os campos do schema e o tamanho mínimo; não perguntava se o conteúdo corresponde a alguma realidade — e é por aí que a alucinação passava: um plano bem formatado, com todos os campos, citando `app/controllers/users_controller.rb` num projeto sem `app/`. O check extrai as referências de caminho e olha o disco. A pergunta NÃO é "todos os arquivos citados existem?" (um plano legítimo propõe arquivos novos, e reprovar isso viraria ruído contra o trabalho): é **"o LUGAR citado existe?"**. Cobrado só quando o run leu o projeto (`survey` ligado) — exigir um layout que nunca foi mostrado ao agente seria reprovar por informação que o runtime decidiu não dar. Artefato que não cita caminho nenhum fica `UNKNOWN`, nunca aprovado.

### Fixed
- **A telemetria de custo subestimava o gasto, e justamente na chamada que estourava o teto.** `ExecutionBudget.spend()` é chamado DEPOIS da resposta do modelo — os tokens já foram consumidos e o provider já cobrou —, mas recusava sem registrar quando o gasto passava de um teto. O run parava (certo), e reportava o consumo ATÉ a última chamada permitida (errado): num caso medido, `$0.001` de `$0.051` realmente gastos. Agora registra sempre e decide depois; parar continua sendo responsabilidade de quem chama, pelo `ok: false`. É a mesma classe do bug corrigido em `d1193ef` (resumo por fase divergindo da telemetria), num caminho que aquela correção não cobria.
- **O resultado do gasto do juiz semântico era ignorado.** Com a fase `evaluation` esgotada, cada nó seguinte continuava chamando o juiz: o teto de avaliação era decorativo. Agora o juiz é desligado no primeiro gasto recusado, com span `budget:judge-off` no trace, e o critério semântico volta a `UNVERIFIED` — nunca aprovação por omissão. Reprovar o nó seria pior: o trabalho dele não tem culpa do orçamento de verificação ter acabado.
- **`budgetLimits.maxTokens` era descartado em silêncio.** Custo, tempo, agentes, retries e tool calls do `budgetLimits` eram honrados; o teto de tokens era substituído pelo do plano sem erro nem aviso. Agora vale o MENOR dos dois: nenhum dos dois pode afrouxar o outro.
- **Estado de projeto vazava para dentro da instalação do framework.** `resolveFrameworkRoot` responde "de onde leio agentes e skills?" e cai na instalação do pacote quando o projeto não tem `.agents/` — correto para assets. O estado (`.izanagi/state`: trace, artefatos **com conteúdo**, memória, checkpoints, decisões, aprovações) usava a mesma raiz, então todo projeto sem `izanagi init` gravava dentro de `node_modules/izanagi-ai/`, compartilhado com todos os outros. Consequências reais: `izanagi trace` listava execução de outro projeto, artefato de um projeto era legível de outro, e `npm update izanagi-ai` apagava o histórico. Novo `resolveStateRoot` e `OrchestratorOptions.stateDir` (default `baseDir`, então nenhum caller existente muda). **Projeto inicializado não muda de lugar** — mover o estado apagaria o histórico de quem já usa; o que muda é só o caso quebrado. Encontrado procurando o trace de um run de teste e achando 300 traces de outros projetos no diretório do framework.
- **Sandbox de tool e `file-exists` resolviam contra a raiz do FRAMEWORK.** `baseDir` é `<projeto>/.agents` num projeto inicializado, ou a própria instalação do pacote quando não há uma. Um nó `fs.read` lia dentro de `.agents/` em vez do projeto, e um check `file-exists` procurava o arquivo no lugar errado. Rodando de dentro do checkout do framework as duas coincidem, que é exatamente por que passava despercebido.
- **Nó que terminava `failed` sem produzir artefato era invisível para a avaliação final.** `correctness` é a média das verificações registradas e `artifactValidity` a razão dos artefatos existentes: as duas ignoram quem não chegou a produzir nada. Na prática, um nó abortado por permissão negada deixava o run terminar `PASS` com score alto. Agora cada nó falho entra como regressão — nó `optional` fica de fora, porque reforço que falha não invalida evidência que passou.
- **Replanejamento apagava o contrato de um nó de tool.** `contractFor` por cima de um contrato de tool removeria `tool` e `permissions`, e o nó viraria uma chamada de modelo com o mesmo id: a "correção" seria uma regressão silenciosa. Nó de tool não tem plano B estrutural (não há agente para trocar nem papel para subir) e volta para a fila com o mesmo contrato, com o motivo registrado nas decisões.
- **Duas fixtures de teste mediam a coisa errada.** `orchestrator.test.ts` e `checkpoint.test.ts` não cobriam o schema de `critique`/`test-plan`: o nó produzia artefato inválido, terminava `failed`, e o run seguia `PASS`. Só apareceu quando nó falho passou a contar.

### Compatibility
- **Nenhuma quebra.** Sem `--output` e sem `--survey`, o plano é byte-a-byte o de antes e nenhum nó do grafo recebe permissão. `workspaceDir` tem default `baseDir`, então todo caller existente do `Orchestrator` mantém o comportamento exato — a CLI e o SDK declaram o valor novo.
- **Mudança de veredito possível**: um run cujo nó falhava sem produzir artefato passava a `PASS` e agora sai `FAIL`. Isso é a correção, não a regressão: o run reportava sucesso com uma tarefa não executada.

### Tests
- **Suíte de cenários ponta a ponta** (`e2e-scenarios.test.ts`): os dez cenários que a arquitetura precisa cobrir — trivial, médio, complexo, paralelo, falha, retentativa, escalada de papel, estouro de orçamento, parada antecipada e aprovação humana — cada um passando pelo Commander e pelo Orchestrator de verdade. Só o producer é injetado: substituir qualquer outra peça faria o teste medir a substituição em vez do runtime. Os outros arquivos testam peças; este testa comportamento observável de um run inteiro.
- 676 testes, 676 passando (104 novos: 23 em `delivery.test.ts`, 18 em `grounding.test.ts`, 17 em `groundedness.test.ts`, 20 em `materialize.test.ts`, 10 em `e2e-scenarios.test.ts`, 5 em `state-root.test.ts`, 5 em `arena.test.ts`).

---

## [3.17.1]: 2026-09-02

### Fixed
- **`docs/` ficava fora do pacote npm.** O README publicado apontava para `docs/HANDOFF.md`, `docs/RUNTIME-PENDING.md` e `docs/POLYGLOT.md`, e quem instalava do registry encontrava links quebrados: a lista `files` do `package.json` nunca incluiu o diretório. Encontrado inspecionando o tarball publicado da 3.17.0.

---

## [3.17.0]: 2026-09-02

Decisão de produto que estava pendente desde a Fase 4, tomada: **o Izanagi é local-first**. Não fica de pé, não escuta porta, não guarda credencial em repouso. Quem agenda é o cron ou o Task Scheduler do sistema, e esta versão entrega o que faltava para eles conseguirem consumi-lo.

### Added
- **`izanagi run --json`**: um único objeto JSON no stdout com runId, status, score, modo, duração, tokens, custo, verificação por tarefa, healing e artefatos. A saída humana é silenciada ANTES de qualquer impressão; `console.error` continua vivo, porque erro real precisa chegar ao stderr do agendador sem contaminar o stdout que ele parseia.
- **Código de saída com significado**: `0` concluiu (PASS / PASS_WITH_WARNINGS), `1` falhou, `2` aguarda decisão humana. É a interface mais barata com um agendador — sem isso o cron não sabe quando alertar. Aguardar aprovação sai como `2` e não como falha de propósito: alguém precisa aprovar, não consertar.
- **`izanagi run --notify-webhook=<url>`** (`runtime/notify/webhook.ts`): POST de fim de run com uma retentativa. `4xx` não é repetido (configuração errada não melhora repetindo), `5xx` é. Só `http`/`https` — um `file:` ou `data:` vindo de configuração é caminho de leitura de arquivo, não de notificação. Falha de notificação nunca derruba o run: o trabalho já foi feito e verificado quando a função é chamada.

### A regra do payload
O webhook leva **metadado, nunca conteúdo de artefato**: status, score, tokens, custo, verificação por tarefa e nome/tipo/validade dos artefatos. Um endpoint de notificação costuma ser um canal de equipe, um túnel de terceiro ou um serviço que ninguém auditou; mandar para lá o que os agentes produziram é exfiltração acidental com aparência de conveniência. Quem quer o conteúdo usa `izanagi explain <run-id> --artifacts`, na máquina onde o run aconteceu. Artefato sem validade avaliada vira `valid: false`, não `true` por conveniência de tipo.

### O que esta decisão explicitamente NÃO entrega
Receber comando de fora (daemon, bot de Slack respondendo, API pública). Isso exigiria autenticação, isolamento entre execuções e credenciais em repouso — e as decisões de segurança tomadas até aqui (sandbox, trust tier, Policy Engine) precisariam ser revisitadas, não estendidas.

### Changed
- `runRuntime()` passa a devolver o `OrchestrationResult` em vez de `void`, para o fecho do agendador poder montar o payload. Retrocompatível para quem ignorava o retorno.

### Compatibility
- Sem `--json` e sem `--notify-webhook`, o comportamento do `izanagi run` é byte-a-byte o de antes, inclusive o código de saída.

### Tests
572 testes passando (10 novos). O único vermelho continua sendo o `polyglot`, que exige executar um binário com shebang bash — não roda no Windows.

---

## [3.16.0]: 2026-09-02

Os três itens que restavam eram os de maior risco da lista: cada um destrava autonomia, e cada um erra caro se destravar demais. O que resta depois desta versão é uma decisão de produto, não um gap técnico.

### Added
- **Sub-orquestração** (`orchestration/subgraph.ts`): uma tarefa com `contract.decomposable` pode responder com `{ reason, decompose: [...] }` em vez do artefato, e o runtime abre um subgrafo. Os LIMITES são o ponto, porque agente decompondo à vontade é a colmeia que a arquitetura proíbe: orçamento do pai **dividido** entre os filhos com piso de 512 (decompor não libera gasto novo); profundidade com teto do RUNTIME (`maxOrchestrationDepth`, default 2) e não do agente; no máximo 5 sub-tarefas, com o excesso cortado; sub-tarefa nasce com `decomposable: false`; ids prefixados pelo pai; pedido malformado recusado INTEIRO; e falha de sub-tarefa sendo falha de quem pediu a decomposição. O filho herda restrições, política de verificação e critérios de aceite do pai — decompor não afrouxa o que o pai prometeu. Só papel `commander` em modo `autonomous` recebe a permissão, e o protocolo só entra no prompt quando ainda há profundidade disponível.
- **`code.execute` em sandbox** (`tools/code-sandbox.ts`): processo Node separado com o Permission Model ligado. O isolamento é do runtime, não de varredura de `import` sobre o código — varredura é evasível. Verificado por teste: filesystem restrito ao diretório de trabalho da execução, `child_process`/workers/addons/WASI bloqueados, ambiente montado do ZERO (nenhuma variável do pai atravessa, então nenhuma chave de API atravessa), timeout com SIGKILL, teto de saída com truncamento declarado, leitura do projeto opt-in e nunca acompanhada de escrita. Sem isolamento disponível (Node < 20) a execução é RECUSADA.
- **Síntese de skill por trajetória recorrente** (`evolution/trajectories.ts`): o simétrico de converter falha em padrão. A assinatura de uma trajetória é a sequência (agente → kind) das tarefas VERIFICADAS, não o texto do objetivo — dois runs sobre objetivos diferentes que percorreram o mesmo caminho são a mesma trajetória. A barra é RECORRÊNCIA (3 execuções, todas verificadas, nunca sintetizada antes), não sucesso: sintetizar a cada run bem-sucedido produziria uma biblioteca de skills genéricas competindo com as boas no ranking. A skill gerada descreve o caminho observado e declara o próprio limite.
- **`izanagi benchmark memory`** (`benchmarks/memory-benchmark.ts`): a medição que duas ideias do Hermes exigiam antes de virar código. Mede e aplica o limiar declarado no módulo — não opina. Neste repo, sobre corpus sintético de 240 entradas: busca textual p95 **2.0ms sobre 296KB** (abaixo do teto de 25ms: FTS5 não se paga neste volume) e compressão determinística levando 48000 chars a 3993, **8.3%** (abaixo do alvo de 35%: compressão neural não se justifica pelo tamanho). O comando declara o que NÃO mede: se o que sobrou na compressão é o que importava.

### Fixed
- **A busca de memória tinha recall truncado em silêncio.** `search()` operava sobre o conteúdo já cortado em 4000 chars por `listEntries`, então tudo que o projeto aprendeu depois das primeiras páginas de cada arquivo era invisível para a busca. É a pior forma de estar errado: busca lenta se percebe, busca cega não. Agora a busca varre o arquivo inteiro e devolve a JANELA em volta da ocorrência (não o começo do arquivo); o preview continua cortado, porque entrada inteira no contexto é o que a arquitetura proíbe. Depois do conserto a mesma medição alcança 296KB em vez de 16KB, com a mesma latência.
- **A sandbox concedia leitura de `os.tmpdir()` inteiro** — e o diretório de trabalho da execução vive lá dentro, então qualquer arquivo temporário de terceiro ficava legível pelo script. Removido; o Node não precisava dele.
- **O timeout da sandbox resolvia antes do processo morrer**, deixando o diretório de trabalho com handle aberto (EPERM na limpeza no Windows, resíduo em `.izanagi/state/sandbox/`). Agora o timeout marca e mata, e quem resolve é o `close`, com rede de segurança de 2s.

### Changed
- `MemoryStore.listEntries()` aceita `{ full: true }`. Sem a opção, o comportamento é o de antes (corte em 4000 chars).
- `SkillFactory.generate()` aceita `body` e `description` prontos. A síntese por trajetória usa isso porque o template genérico acrescentaria seções que a evidência não sustenta.
- `Orchestrator` aceita `generatedSkillsDir`: um run de teste não pode escrever no repositório de quem roda o teste.

### Compatibility
- `TaskContract.decomposable` é opcional e falso por padrão: contrato sem ele executa exatamente como antes.
- `RuntimeState.trajectories` e `AgentStats.byDomain` são opcionais; estado gravado antes continua legível.
- `ToolRegistry.execute()` virou `async` (breaking interno). `ToolDefinition.execute` pode devolver Promise. Fazer a execução de código de forma síncrona travaria o event loop e mataria o paralelismo dos outros nós do batch.
- Nenhum comando ou flag da CLI foi removido.

### Tests
562 testes passando. O único vermelho é `polyglot: bin Rust presente com --version barato`, que exige executar um binário com shebang bash — não roda no Windows, e é anterior a estas mudanças.

---

## [3.15.0]: 2026-09-02

O que sobrava depois da 3.14.0 era, quase tudo, "existe mas não está no caminho". Esta versão coloca as peças no caminho e passa a medir execução real. As sete limitações registradas na 3.14.0 foram fechadas; restam três, e nas três falta uma decisão ou um caso de uso, não código.

### Added
- **Policy Engine no caminho de `izanagi run`** (`orchestrator.ts`, `contracts/task-contract.ts`, `registry/capabilities.ts`): nó `kind: 'tool'` (contrato com `tool: { id, input }`) roteia por `ToolRegistry`, que aplica permissão, política e sandbox ANTES de executar — e não pelo `opts.produce()`, que é chamada de modelo. Tudo a jusante é o mesmo caminho de um nó de agente: validação, registro com lineage, Verification Engine, detecção de regressão, log A2A. `TaskContract.permissions` é menor privilégio por construção (contrato sem permissões executa tool nenhuma), e o trust tier vem da ORIGEM do arquivo do agente (`agents/generated/` → generated, `.agents/` → community, resto → builtin), nunca do que ele declara sobre si; agente desconhecido é `community`, o tier mais restritivo. O teto de tool calls é consumido antes da execução: descobrir o estouro depois seria contabilizar efeito colateral já aplicado no disco.
- **Simulação headless derivada do schema real** (`contracts/artifacts.ts`, `runtime/execute.ts`): `simulatedArtifact(kind, ctx)` deriva o conteúdo de `required` + `minSize` + `simulationHint`, e mora ao lado do schema. Um teste valida a simulação de TODO kind registrado contra o validador de verdade, então schema e simulação não divergem em silêncio. `SIMULATION_BANNER` vai no próprio conteúdo e o model continua `cli-headless`: simulação não se apresenta como execução.
- **Estatística de agente por domínio** (`memory/store.ts`, `orchestration/commander.ts`): `AgentStats.byDomain`. O run conta em todos os domínios que tocou; `agentStats(agent, domain)` devolve `undefined` sem histórico ali (ausência de sinal, não sinal ruim). O Commander usa o recorte quando a amostra do domínio é suficiente e cai no agregado quando não é.
- **Cache da validação determinística** (`contracts/artifacts.ts`): `validateArtifact` memoizado por `(kind, hash)`, teto de 512, eviction FIFO, `clearValidationCache()`. Ressalva no código e no relatório: economiza CPU, não token — nenhuma chamada de modelo é evitada, e por isso não entra na telemetria de economia.
- **Dashboard com os campos do runtime novo** (`dashboard/page.ts`): modo, verificação por tarefa (com o que ficou sem evidência conclusiva), economia e conversa A2A no Run Explorer. Teste novo trava o contrato entre `/api/runs/:id` e a página.
- **Izanagi Arena** (`benchmarks/arena.ts`, `izanagi benchmark run --execute`): a suíte roda cada caso pelo runtime real e o relatório traz, por caso e agregado, taxa de verificação, taxa de recuperação, retries, ações de healing, tokens e custo. Recuperação conta o CONSERTO (nó que falhou e terminou `succeeded`), não a ação de healing. O agregado soma totais, não faz média de médias. Métrica ausente aparece como ausente: relatório sem execução não exibe "verificação 0%", e o resumo diz explicitamente o que aquele relatório não mede.

### Fixed
- **`toText` podia devolver `undefined`**: `JSON.stringify(undefined)` não é string, então validar o retorno de uma tool que não devolve nada estourava com "Cannot read properties of undefined" em vez de reprovar o artefato.
- **Caminho relativo de tool escapava da sandbox**: `ensureInside` usava `path.resolve(target)`, que resolve contra o **cwd do processo**. `fs.write` com `"saida.txt"` gravava no diretório de onde o izanagi foi invocado, fora da zona declarada, e a checagem de contenção não tinha como perceber. Agora relativo resolve contra `baseDir`.
- **Tabela de economia do dashboard referenciava campos inexistentes**: `costUsd`, `degradations` e `retries` — os campos reais de `TokenTelemetry` são `estimatedCostUsd` e `degradationsApplied`. Metade da tabela sairia vazia.
- **Negativa de permissão entrava no caminho de cura errado**: `classifyFailure` não reconhecia "permissão negada"/"policy negou" e a falha caía no ramo genérico, gerando retentativa. Retry não abre porta fechada — só produz ruído de segurança no log e gasta orçamento. Agora é `non-recoverable`.

### Changed
- `izanagi run` sem API key deixou de terminar `FAIL` por um motivo alheio ao runtime. Medido no repo: o mesmo `--mode autonomous` que terminava `FAIL` com 3 tentativas e abort agora fecha `PASS` com 4/4 VERIFIED.
- `BenchmarkResult` e `BenchmarkReport` ganharam `execution?` (opcional): relatórios antigos continuam legíveis, e relatório sem execução continua sem métrica de execução.

### Compatibility
- `TaskContract.permissions` e `TaskContract.tool` são opcionais: contrato sem eles executa exatamente como antes.
- `OrchestratorOptions.environment` e `trustTierOf` são opcionais. Sem `trustTierOf`, um nó de tool com agente declarado é tratado como `community`.
- `AgentStats.byDomain` é opcional: estado gravado antes desta versão continua legível, e o agregado global continua valendo.
- `MemoryStore.agentStats(agent)` mantém a assinatura; o segundo parâmetro é opcional.
- Nenhum comando ou flag da CLI foi removido.

### Tests
516 testes passando. O único vermelho é `polyglot: bin Rust presente com --version barato`, que exige executar um binário com shebang bash — não roda no Windows, e é anterior a estas mudanças.

---

## [3.14.0]: 2026-09-02

Fechamento do runtime: as peças que existiam e eram testadas passam a estar **ligadas** e a mudar a execução. As onze limitações registradas na v3.13.0 foram resolvidas; o que sobrou está em [`docs/RUNTIME-PENDING.md`](docs/RUNTIME-PENDING.md).

### Added
- **Critique loop** (`runtime/orchestrator.ts`): a saída de um nó crítico passa por `parseCritique` e vira decisão de runtime. Crítica bloqueante (`high`/`critical`) reprova o nó CRITICADO — não o crítico — com `formatCorrection` como correção mínima. O alvo sai de `issue.artifact` quando o nome bate com um nó do grafo, senão da dependência do crítico. O crítico volta para a fila com `attempts` zerado: quem apontou o problema é quem verifica o conserto. Teto de UMA rodada de correção por nó, para crítico e executor não entrarem em ping-pong.
- **Retentativa dirigida** (`runtime/orchestration/context-resolver.ts`): `resolve()` aceita `correction`. Com ela, o contexto deixa de ser os insumos do grafo e passa a ser a entrega anterior do próprio nó + a lista de correções.
- **`critique` como ArtifactKind** (`runtime/contracts/artifacts.ts`): schema com `status` e `issues` obrigatórios, e contrato de saída JSON injetado no prompt do nó crítico. Crítica em prosa reprova na verificação e a retentativa cobra o formato.
- **Conversation Log** (`runtime/protocol/conversation.ts`): registro do protocolo agente-a-agente do run (`task`/`result`/`critique`/`correction`). Toda mensagem carrega REFERÊNCIA de artefato (`runId:nodeId`) e resumo de até 240 chars, nunca o conteúdo produzido. Persistido em `RunTrace.conversation`.
- **Juiz semântico default** (`runtime/verification/judge.ts`): `createModelJudge` roda no papel `worker`, recebe o artefato resumido e um critério por vez, com saída `{"pass": bool, "reason": string}`. Ligado por default na CLI e no SDK via `createSemanticJudge`; `--no-judge` / `noJudge: true` desligam. Saída ilegível, `pass` não booleano, erro de rede ou timeout viram `inconclusive` (a engine trata como `unknown`), nunca reprovação.
- **`Commander.replan`** (`runtime/orchestration/commander.ts`): replanejamento produz Plano B, não Plano A com um nó reaberto. Escada determinística: troca o agente (os já queimados no nó saem da disputa via `metadata.triedAgents`) → sobe o papel → quebra a tarefa em `<id>-draft` + `<id>`, preservando o id original para as dependências a jusante continuarem válidas. Da segunda tentativa em diante, troca agente E sobe papel. Recebe só o delta da falha (nó, causa, critérios não comprovados, referência do artefato, tentativa) e declara `changes: []` quando não há alternativa estrutural.
- **Memória no planejamento**: `CommanderInput.memory` (interface estreita `PlanningMemory`). Padrão de falha conhecido para o objetivo sobe o modo UM degrau; agente com taxa de sucesso abaixo de 40% em pelo menos 3 runs sai da disputa, com salvaguarda contra excluir todos; a consulta entra nas decisões do plano e no Decision Journal.
- **Skills por tarefa**: `CommanderInput.resolveSkills` popula `node.skills` com o ranking do objetivo de CADA tarefa (teto de 3), no lugar da chain do run replicada em todos os nós. Nó determinístico (gate/evaluator/validator) não carrega skill.
- **CLI**: `izanagi run --no-judge`; `izanagi explain <run-id> --conversation` mostra o log A2A inteiro (crítica e correção aparecem por default).

### Changed
- **`VerificationEngine.verify()` agora é `async`** (o juiz é uma chamada de rede). `SemanticJudge` continua aceitando implementação síncrona: o tipo admite valor ou Promise. `VerificationResult` ganhou `judgeTokens`/`judgeModel`, cobrados da fase `evaluation` — verificar não é produzir, e misturar as duas esconderia o preço da verificação semântica na telemetria.
- **`SkillResolver.loadSkill` memoiza manifesto por alias** (`clearCache()` invalida). Sem isso, ranquear skills por tarefa em vez de por run multiplicaria ~170 leituras de disco pelo número de nós do grafo.
- **Producer headless devolve crítica estruturada** para nós de kind `critique`, declarando ser simulação. Os demais kinds tipados continuam não satisfazendo o schema (limitação registrada no handoff).

### Fixed
- **`minSize: 60` no schema de `critique` reprovava a crítica que APROVA**: `{"status":"approved","issues":[]}` tem 33 chars. Baixado para 20 — quem garante qualidade aqui são os campos obrigatórios, não o tamanho.
- **Reprovação da Verification Engine não casava com a taxonomia de falha**: `classifyFailure` não reconhecia "verificação"/"verification", então um critério de aceite não comprovado caía no ramo genérico e abortava o nó na primeira tentativa em vez de entrar no caminho de cura de validação (skill corretiva + retentativa).
- **Recomendação de crítica na avaliação final nunca aparecia**: o código testava `ctx.artifacts.has('critique')`, mas `critique` é o KIND do artefato e a chave do mapa é o id do nó (`critic`). Agora sai das críticas realmente interpretadas, com severidade e se houve correção.

### Compatibility
- `OrchestratorOptions.replan` e `judge` são opcionais: sem eles, o Orchestrator segue o caminho anterior (`Planner.replan` legado, critério semântico `UNVERIFIED`).
- `CommanderInput.memory` e `resolveSkills` são opcionais: sem eles, o Commander decide como antes e a chain do run continua valendo byte-a-byte.
- `RunTrace.conversation` é opcional; traces antigos continuam legíveis.
- Nenhum comando ou flag da CLI foi removido.
- Único breaking interno: `VerificationEngine.verify()` virou `async`. O único caller de produção é o Orchestrator.

### Tests
488 testes passando. O único vermelho na suíte é `polyglot: bin Rust presente com --version barato`, que exige executar um binário com shebang bash — não roda no Windows, e é anterior a estas mudanças.

---

## [3.13.0]: 2026-09-01

Rearquitetura do runtime: de "framework de agentes" para runtime de execução de trabalho. O modo de execução passa a ser proporcional ao problema, cada tarefa paga o preço do papel que exerce, e nenhuma tarefa termina sem evidência.

### Added
- **Commander** (`runtime/orchestration/commander.ts`): LEVEL 0 da hierarquia. Classifica complexidade (1 a 5) e domínios, escolhe o modo de execução (`direct` / `assisted` / `orchestrated` / `autonomous`), gera um Task Contract por tarefa com critérios de aceite derivados do schema REAL do artefato, estima o custo do plano e **degrada o modo** quando a estimativa estoura `--max-cost`. Determinístico: planejar não consome token. Uma decomposição externa (LLM ou plugin) pode ser injetada, mas passa por validação estrutural e cai no template quando não conforma.
- **Task Contract** (`runtime/contracts/task-contract.ts`): contrato formal por tarefa com objetivo, papel, insumos por referência, restrições, saída esperada, dependências, orçamento (tokens/tempo/tool calls/custo), política de verificação e critérios de aceite.
- **Roteamento por papel** (`runtime/model/router.ts`): `routeForRole` escolhe o tier pelo papel (commander→premium, specialist→balanced, worker→fast), com queda explícita de tier quando o catálogo disponível não tem aquele nível. Pin por papel via `.izanagi/izanagi.config.json` → `roles` ou `IZANAGI_MODEL_{COMMANDER,SPECIALIST,WORKER}` (env vence config). `escalateRole` sobe worker→specialist→commander; a retentativa de um nó ESCALA o papel em vez de repetir o modelo que já falhou. `costUsd`/`estimateCostForRole` dão custo real de catálogo.
- **Context Resolver** (`runtime/orchestration/context-resolver.ts`): contexto mínimo por tarefa. Cada nó recebe objetivo, restrições e SOMENTE os artefatos dos quais depende, resumidos com preservação de começo e fim, referenciados por id.
- **Agent Capability Registry** (`runtime/registry/capabilities.ts`): descoberta de agentes em disco com capacidades, skills, chains, classe de custo, papel e domínios; matching bilíngue por domínio.
- **Agent-to-Agent Protocol** (`runtime/protocol/messages.ts`): mensagens tipadas com referência de artefato em vez de cópia de texto; crítica estruturada com parsing tolerante e correção mínima só dos problemas bloqueantes.
- **Verification Engine 2.0** (`runtime/verification/engine.ts`): verificação em três camadas (determinística, evidência, semântica) contra os critérios de aceite do contrato. Critério semântico **sem juiz configurado fica `UNVERIFIED` e nunca conta como aprovação**.
- **Budget Controller** (`runtime/token/execution-budget.ts`): custo em USD, tetos de tool call/agente/retry, tempo de parede e escada de degradação (contexto → saída → modelo → paralelismo → tarefas opcionais → aprovação humana). Gasto que estouraria um teto é recusado sem ser contabilizado.
- **Response Cache** (`runtime/cache/response-cache.ts`): cache local determinístico por hash de (provider, modelo, system, mensagens, teto, temperatura), com TTL, eviction e versão de esquema na chave. Opt-in (`--cache` / `IZANAGI_CACHE=1`).
- **Early stopping**: tarefa opcional (crítica adversarial, revisão redundante) é pulada quando todas as suas dependências terminaram `VERIFIED`.
- **Telemetria de economia** persistida no trace: tokens de entrada/saída, custo estimado, cache local e do provider, chars de contexto poupados, tarefas paralelas, escaladas de modelo, retries e degradações aplicadas.
- **SDK programático** (`src/sdk.ts`): `izanagi.run({ objective })` executa a mesma engine da CLI sem saída no terminal e devolve artefatos por id, telemetria, verificação e trace; `izanagi.plan({ objective })` estima modo, contratos e custo SEM executar nem gastar token. O handle é uma Promise que também assina eventos do run (`task:start`, `run:complete`, `healing:start`).
- **CLI**: `izanagi run` ganha `--mode`, `--budget`, `--max-cost`, `--model`, `--local`, `--cache` e `--no-commander`. Comandos novos: `izanagi models` (catálogo + roteamento por papel + custo por 10k tokens) e `izanagi budget [run-id]` (para onde foi o orçamento, por fase, com verificação por tarefa).
- **Token Benchmark** (`izanagi benchmark tokens`): compara o plano do caminho legado com o do Commander em três dimensões separadas (chamadas de modelo, teto de tokens, custo em USD), de forma determinística. O relatório declara explicitamente o que NÃO mede.

### Fixed
- **Nós dependentes não recebiam a saída dos predecessores**: o grafo tinha dependência topológica sem transferência de informação (o nó `implementation` dependia de `architecture` mas o prompt só continha a tarefa original do run). Corrigido pelo Context Resolver.
- **Lista de agentes fixa dentro do orchestrator**: `agentIds()` era um array literal que ignorava agentes do projeto do usuário e de `agents/generated/`. Substituído pelo Agent Capability Registry lido do disco.
- **Categoria escolhida por ordem de detecção, não por intenção**: "auditar a segurança da API" caía no template de backend porque `api` aparecia antes de `segurança` na tabela de sinais. Agora existe uma ordem de intenção explícita.
- **Custo saturado no score do Model Router**: a contribuição de custo era `min(0.2, ...)`, então qualquer modelo abaixo de $0.016/1k empatava no teto e um modelo self-hosted de custo zero perdia para um pago por 100ms de latência. Agora é proporcional. Encontrado pelo próprio Token Benchmark.
- **Portão duplicado de validação**: com contrato presente, a reprovação acontecia duas vezes (schema e verificação) e escondia o relatório de verificação justamente no caso em que ele é mais útil. Agora a Verification Engine é o portão único quando há contrato.

### Compatibility
- Sem plano do Commander, o `Orchestrator` segue **exatamente** o caminho legado (Planner por categoria, um modelo para o run inteiro). Todos os testes anteriores passam sem alteração.
- `ModelRouter.route()`, `PhaseTokenBudget`, `validateArtifact`, `ArtifactRegistry`, `Healer`, `CheckpointStore`, `ApprovalStore` e `DecisionJournal` mantêm assinatura.
- Nenhum comando da CLI foi removido. `--runtime` continua aceito como no-op.
- Campos novos em `RunTrace` (`mode`, `telemetry`, `verification`) são opcionais: traces antigos continuam legíveis, e `izanagi budget` diz explicitamente quando um run é anterior ao Token Economy Engine.

---

## [3.10.1]: 2026-08-23

### Changed
- **Documentação auditada para a era poliglota**: README reescrito em torno da topologia poliglota (instalação, variáveis de ambiente e comandos de teste por núcleo), `docs/POLYGLOT.md` sincronizada com as medições atuais, SYSTEM/RULES/CONTRIBUTING/ROADMAP e `core/*.md` revisados contra a realidade do repositório.
- **Actions do CI unificadas e pinadas por SHA**: `actions/checkout@v7.0.1` e `actions/setup-node@v6.1.0` em todos os workflows, eliminando o warning de deprecação do Node 20 nos runners.

---

## [3.10.0]: 2026-08-23

### Added
- **Progressive disclosure nas skills v2**: front-matter `references:` declara os arquivos de apoio de cada skill em `.skills/<name>/`; `izanagi-next skill show <name> [--ref <arquivo>]` exibe skill e references sob demanda; `skill-migrator --check` valida a sincronia sem escrever.
- **Gate anti-racionalização na fase 4 do `izanagi-next run`**: o artefato final passa pelo Anti-Rationalization Engine antes da entrega. Blocker reprova o gate e dispara auto-heal (N=2); Major/Minor são advisory; `rust-core` ausente degrada o gate para advisory com exit 0.
- **Provenance OIDC no publish npm**: `publish.yml` ganha `id-token: write` escopado ao job e publica com `--provenance` (fail-closed); attestation SLSA v1 verificável no registry.

### Fixed
- **Rodapé de proveniência determinístico nos exporters**: os adapters gerados por `izanagi export` incluem um rodapé gerado deterministicamente, idempotente byte-a-byte entre máquinas (elimina diffs falsos entre execuções/regenerações).

---

## [3.9.0]: 2026-08-23

### Added
- **Anti-Rationalization Engine em Rust** (`crates/izanagi_core`): scanner determinístico regex-free de racionalizações (33 padrões / 8 categorias), exposto como operação NDJSON `scan-rationalizations` com subcomandos `--file=<path>`/`--stdin` e flags `--version`/`--help`; exposto nos bindings WASM; 30 testes novos.

### Changed
- **Consolidação CI/CD (ADR-006)**: `publish.yml` vira CD exclusivo de tag `v*`/release (guard idempotente, least privilege) e o pipeline poliglota (`polyglot.yml`) absorve o teste sandbox do `npm run verify`.

### Fixed
- Higiene de repositório: `.gitignore` cobre os artefatos de build poliglotas; comentário de `engines` corrigido no workflow legado; removida a negação órfã de `agents/generated/c-systems-engineer.json` (arquivo não existe desde a 2.13.0).

---

## [3.8.0]: 2026-08-23

### Added
- **`izanagi polyglot status [--json|--strict]`**: auditoria de saúde dos 7 componentes poliglotas (binários Rust, orquestrador Go, engine Python, pacotes TS); `--strict` sai com exit 1 se algo estiver ausente.
- **`docs/POLYGLOT.md`**: referência canônica da topologia poliglota — contratos IPC, error codes (-32001..-32005), tabela de variáveis de ambiente, gaps conhecidos e resumo dos ADRs.

### Changed
- **Gates de qualidade Rust ativados no CI**: `cargo fmt` aplicado integralmente + 4 fixes semânticos do clippy (zero `#[allow]`); `fmt-check` e `clippy -D warnings` agora bloqueiam o pipeline; guard de idempotência e least privilege também reforçados no workflow legado.

### Fixed
- **postinstall tolerante a checkout sem `dist/`** (bug de CI): a auto-ativação do `izanagi-ai` não falha mais quando executada a partir de um checkout recém-clonado sem build prévio.

---

## [3.7.0]: 2026-08-23

### Added
- **Topologia poliglota ao lado do runtime npm legado** (Strangler Fig, ADR-001):
  - `crates/izanagi_core` (Rust): quality engine com 7 heurísticas anti-slop sobre TS/Python/Go, protocolo NDJSON stdin/stdout (`validate`/`rules`/`version`) e bindings WASM feature-gated.
  - `crates/izanagi_mcp` (Rust): cliente MCP JSON-RPC 2.0 sobre stdio (discovery + invocação pontual), agora com subcomando `call --tool=<name>` coberto por testes E2E.
  - `go-services/swarm_orchestrator` (Go): orquestrador de swarm (Uber Fx) com pipeline architect→engineer→qa→security via JSON-RPC 2.0 sobre UDS e event push.
  - `python-engine/ast_analyzer` (Python ≥3.10): análise semântica multilíngue (símbolos, complexidade ciclomática, imports) com tree-sitter + fallback estrutural.
  - `packages/sdk` (`@izanagi/sdk`, clientes tipados strict para os 4 núcleos + catálogo de skills) e `packages/cli` (binário `izanagi-next`, run em 4 fases com auto-heal N=2), mais o `skill-migrator` determinístico (skills v1→v2).
- **Catálogo de skills v2 (`.skills/<name>/SKILL.md`)**: 106 módulos migrados deterministicamente do legado `skills/` com seções Triggering Criteria / Step-by-Step Workflow / Verification Steps / Common Rationalizations / Red Flags (ADR-004).
- **CI poliglota GitHub Actions** (`.github/workflows/polyglot.yml`): jobs paralelos para npm legado, Rust+WASM, Go, Python e pacotes TS, com `requirements-dev.txt` pinado.
- **Topologia `.agents/agents/*.yaml` via `agent-migrator`**: os 22 agentes derivados JSON→YAML por migrador determinístico idempotente (ADR-005); `--check` detecta drift YAML↔JSON.

### Fixed
- **`doctor`**: a heurística de raiz não confunde mais os YAMLs derivados (`.agents/agents/*.yaml`) com uma instalação completa (que exige agentes em JSON); regressão coberta por testes.

---

## [3.6.0]: 2026-08-18

### Fixed
- **`resolveFrameworkRoot(cwd)` false-positived on any `.agents/` folder, even one containing only `.agents/memoria/`** (written by the runtime itself on `izanagi run`, with `izanagi init` never having been called). Every CLI command (`doctor`, `run`, `agent list`...) then looked for `RULES.md`/`skill-resolver.json` inside that incomplete `.agents/` and failed silently: reproducible inside this repo's own checkout after any local test run. Fixed to require `.agents/core` (the marker `izanagi init`'s `core` pack always writes) before treating `.agents/` as the framework root.
- **`AGENTS.md`/`SYSTEM.md`/`RULES.md` version banners were still `2.11.0`/`1.0.0`/`1.0.0`**, unchanged since before 3.0.0 despite real content edits landing in that window. Unified to `3.6.0`.
- **Stale counts**: test count said `165`/`152` in different files (real: `262`); "vs. 21 core" in `README.md`/`SYSTEM.md` (real: 22, since `/ai-engineer` shipped in 3.1.0); `AGENTS.md` referenced a dead example agent (`agents/generated/c-systems-engineer.json`) removed back in 2.13.0; `izanagi export`/`init` CLI-target lists omitted `opencode` despite it being the default adapter.
- **`agents/senior-engineer-agent.json`'s `optionalSkills` had `"architect-agent"`/`"database-agent"`** (agent filenames, not skill aliases: unresolvable in `skill-resolver.json`): the same bug class 2.13.0 fixed in `pm`/`devops`/`database` but missed here. Renamed to the real aliases (`architect`/`db`). A repo-wide scan now confirms 0 unresolved `requiredSkills`/`optionalSkills` references across all 22 agents.
- **`dist`/`src/exporters.ts` templates for all 6 CLI adapters, and the real `CLAUDE_AGENT_TRIGGERS` delegation strings, violated the framework's own Rule 13 (zero em-dash "—" as text ornament)**: ~90 instances, found by asking "does the generator follow the rule it enforces on output?" It didn't. Purged; also widened `truncate(a.role, 70)` to `140` in `claudeMainTemplate` (the old limit cut agent descriptions mid-sentence in `CLAUDE.md`'s table). Rule 13 and the `anti-ai-slop` skill now also explicitly ban `"--"` (double ASCII hyphen, which many editors/renderers auto-convert to an em-dash): single `"-"` for compounds/ranges/bullets is unaffected.
- **`agents/generated/` had accumulated 8 junk agents from old ad-hoc `izanagi agent create` testing** (`500-specialist`, `banco-specialist`, `login-specialist`, `produco-specialist`, `simples-specialist`, `testes-specialist`, `x-specialist`, `y-specialist`: e.g. `x-specialist`'s entire purpose was `"Implementar módulo X"`), the same class of mess 2.13.0 cleaned up once already. Since `loadIzanagiAgents()` scans `agents/generated/`, every one of these was being exported as a real native subagent into `.claude/`, `.opencode/`, and `.codex/` in this very repo. Deleted the source files and every already-exported artifact, regenerated clean.

### Added
- **`izanagi-ai` now activates itself on `npm install`.** New `postinstall` script (`src/scripts/postinstall.ts`): when the package is installed as a real dependency (detected by `getPackageDir()` sitting inside a `node_modules` folder, not a dev checkout) and the target project hasn't already run `izanagi init` (no `.agents/core`), it silently runs the equivalent of `izanagi init --cli all` in the consumer's project (`process.env.INIT_CWD`, which npm sets to where `npm install` was invoked from: not `process.cwd()`, which inside a postinstall hook is the package's own directory). Generates every CLI adapter (not just one) since postinstall has no way to know which AI tool the user will open next, and the cost of unused adapter files is near zero. Wrapped in try/catch: never fails the consumer's `npm install`. This closes the exact gap that caused a real user's project to have `izanagi-ai` installed with zero `.claude/`/`AGENTS.md` at the project root: the framework existed only inside `node_modules`, invisible to any AI CLI, until `izanagi init` was run by hand.
- **Native `/agents` orchestrator command for Claude Code** (`.claude/commands/agents.md`, generated by a new `claudeOrchestratorCommandTemplate()` in `exporters.ts`). Mirrors `.opencode/agent/agents.md`'s Supervisor + Swarm protocol (5-step decompose → route → coordinate-by-artifact → validate → deliver), adapted to Claude Code's real dispatch mechanism (parallel Agent tool calls in one response, not opencode's own invocation syntax): Claude Code had no equivalent entry point for the multi-agent swarm mode before this.
- **`CLAUDE.md`'s "Agentes nativos" section rewritten** to state delegation as the default (answering directly as a generalist is the exception), added a task-type → agent(s) → chain quick-reference map, and explicitly named Rule 3 (Skill Composition Obrigatória) as the reason an agent's declared `Chains` sequence must run to completion, not just its first skill.
- **New skill `payments-billing`**: Stripe/Paddle/Mercado Pago integration (webhook signature verification, idempotency via event-id table + client `Idempotency-Key`, ack-then-process, subscription lifecycle with dunning, "never trust the browser redirect, only the webhook"). The framework promises a complete SaaS vertical slice but had no skill for the single most common thing a paid SaaS needs beyond auth+CRUD. Wired into `senior-engineer`'s `fullstack` chain and the `fullstack_crud`/new `billing_integration` compositions.
- **New skill `editorial-layout`**: magazine/editorial grid composition (asymmetric type scale, structural white space, purposeful broken grid, non-card layout patterns) as a concrete alternative to the "hero + 3 cards" tell.
- **New skill `conversion-copywriting`**: the positive complement to `anti-ai-slop`'s catalog of what to avoid: headline/CTA/microcopy structure built on the "would this sentence fit any product in the world?" specificity test.
- Both new design skills wired into `senior-engineer`'s `fullstack` chain, `animation`'s `optionalSkills`, and the `web_cinematic`/`fullstack_crud` compositions: not just added to the library unused.

106 skills (was 103), 258 resolver aliases (was 248), 16 compositions (was 15). `izanagi doctor` PASSED (0 errors, 0 warnings), 0 unresolved agent→skill references, all 262 tests pass: verified after every step, including a fresh `npm run build` from `src/`.

---

## [3.5.0] — 2026-08-17

### Added
- **Default-on Unicode hygiene on every file write.** New `runtime/text/unicode-hygiene.ts`: `sanitizeText()` strips invisible Unicode control/formatting characters (zero-width space/joiner, bidi overrides, BOM, ...) and normalizes homoglyph spaces (non-breaking space, em/en spaces, ideographic space, ...) that LLM output sometimes contains — a zero-width space inside an identifier, or a non-breaking space where indentation expects a plain space, both cause silent, hard-to-debug breakage. Wired into `tools/registry.ts`'s `fs.write` (the one choke point every generated file passes through) and `contracts/artifacts.ts`'s `makeArtifact()`. Always on, no opt-in, pure regex — zero new dependencies, zero network/LLM calls. Rewritten once already: a first char-by-char implementation cost ~260ms on a 1.5MB file; the regex-based version costs <4ms on the same file.
- Evaluated `github.com/guillaumemeyer/watermarks-remover` for a broader "AI watermark removal" feature and deliberately did not adopt its architecture: it's a Python microservice with per-approach Docker images running real watermark-detection ML models (SynthID, MarkLLM, CtrlRegen, MarkDiffusion), and its statistical-watermark-removal path rewrites text via an LLM call — real token cost, against this framework's zero-dependency, zero-extra-token design.

---

## [3.4.0] — 2026-08-17

### Fixed (CRITICAL)
- **The 3 commits after the 3.3.0 release (crash-safe MemoryStore/Tracer persistence, dashboard live SSE updates, dashboard visual polish) were pushed to GitHub but never published to npm** — `izanagi-ai@3.3.0` on the registry was missing all of it. Caught because the version number hadn't changed, so nothing signaled a re-publish was needed. This release ships everything below.

### Added
- **Crash-safe persistence**: `MemoryStore` now calls `save()` from every mutator (`recordAgentRun`/`recordSkillRun`/`recordModelRun`/`recordFailure`/`invalidateFailure`/`archiveFailure`/`addLearning`) instead of relying on one explicit `.save()` at the end of a run. `Tracer.flush()` persists a partial `RunTrace` snapshot after every span closes. Closing the CLI mid-run (Ctrl+C, crash, closed terminal) no longer loses that run's progress.
- **`izanagi dashboard` live updates**: new `/api/events` Server-Sent Events endpoint backed by `fs.watch` on the state directories (the dashboard and `izanagi run` are separate processes, so this is the channel that actually works across them — the in-memory Event System isn't reachable from a different process). The page now has a "● live" indicator and refreshes the visible run/benchmark list automatically.
- **Dashboard Execution Graph** now renders `trace.graph.parallelBatches` as real side-by-side lanes instead of a flat span list (falls back to spans for older traces without a graph). Runs without an `evaluation` field render a "running" badge instead of breaking. Memory panel gained a Models table (`recordModelRun` stats existed but were never surfaced anywhere).
- **Dashboard visual polish**: refined palette, pill badges, animated live-dot, and a real stats bar (total runs, pass rate, avg score, in-progress count, runs needing healing) computed client-side from the same data already fetched — no invented numbers.

---

## [3.3.0] — 2026-08-16

### Added
Izanagi Evolution — audited the runtime against a 7-phase roadmap (Foundation →
Reliability → Observability → Model Runtime → Memory → Arena → Platform)
before writing any code. Found ~70% already implemented (ArtifactRegistry,
EvaluationEngine, Healer, ModelRouter, MemoryStore, BenchmarkRunner all
pre-existed); closed the real, specific gaps only — no reimplementation, no
invented metrics/benchmarks/results, one commit per phase:

- **Foundation**: `FailureCategory` (12-value failure-origin taxonomy,
  `runtime/recovery/healing.ts`), `ArtifactRef` provenance (`id`/`producer`/
  `createdAt`/`status`, populated from the existing `ArtifactRegistry`).
- **Reliability**: `ArtifactRegistry.detectRegression()` — a healed retry that
  scores worse than the version it replaced now fails the node instead of
  silently "succeeding" (roadmap's `HEALING_REJECTED` concept). Verified the
  heal→retry→evaluate verification loop already existed end-to-end.
- **Observability**: real-time Event System (`runtime/observability/events.ts`)
  — `EventBus` emitting `run.*`/`node.*`/`evaluation.*`/`diagnosis.*`/
  `healing.*`/`verification.*`/`quality_gate.*`; new `OrchestratorOptions.onEvent`
  hook (the dashboard below consumes the underlying data, not this hook yet).
- **Model Runtime**: `OllamaAdapter`, `LMStudioAdapter`, `OpenRouterAdapter`,
  `CustomOpenAICompatibleAdapter` (`runtime/llm/client.ts`) — local providers
  require explicit opt-in (`IZANAGI_OLLAMA_ENABLED=1` etc.) so the existing
  zero-config headless mode can't silently break.
- **Memory**: failure-pattern lifecycle — `MemoryStore.invalidateFailure()` /
  `archiveFailure()`, new `izanagi memory invalidate|archive <pattern>`.
- **Arena**: `BenchmarkRunner.runBaselines()`/`compareBaselines()` (N producers
  head-to-head, genuine ties return no forced winner), `izanagi benchmark
  report <id>`, `izanagi arena` as a literal alias for the existing benchmark
  CLI (roadmap's naming, zero reimplementation).
- **Platform (foundation only, not the full phase)**: `izanagi dashboard
  [--port N]` — a local `node:http` server (zero new dependencies) reading
  straight from `TraceStore`/`ArtifactRegistry`/`MemoryStore`/benchmark
  reports, serving a single embedded-HTML page (Run Explorer, Arena panel,
  Memory panel). Deliberately not built: hosted multi-user platform, auth,
  Skill/Agent Registry UI, plugin extensibility — scoped down to match how
  the rest of the framework already works (local-first, single-user) after
  asking the user directly instead of guessing.

250/250 tests passing (57 new across the 7 phases), `izanagi doctor` PASSED
after every phase, no breaking changes to any existing CLI command or public
API.

---

## [3.2.0] — 2026-08-16

### Added
- **`checkNestedDuplicate()` (`src/cli/checks.ts`)**, wired into both `izanagi doctor` and `izanagi init`, detects the `<name>/<name>` nested-duplicate folder pattern (e.g. `izanagi-ai/izanagi-ai/`) — created when `git clone <repo>` is run from inside a directory already named after the repo, or `izanagi init <dir>` is pointed at a subfolder instead of the current directory. Found by dogfooding: a real project ended up with the framework's `.git`/`.claude`/`package.json` one level below where the CLI was actually opened, so Claude Code (and every other adapter) discovered an empty outer folder and never surfaced the 22 native agents, slash-commands, or the 103-skill library "out of the box" — exactly the symptom users have reported as "skills/agents aren't showing up automatically." `doctor` now surfaces this as a warning with the exact fix (flatten `<nested>` into the parent, reopen the CLI there); `init` warns before installing into a destination that already has this shape.

---

## [3.1.0] — 2026-08-15

### Fixed (CRITICAL)
- **`izanagi init` never actually generated a Claude Code adapter unless `--cli claude` was passed explicitly or a `.claude/` folder already existed.** `installToProject()`'s CLI auto-detection only checked for existing adapter folders in the target project (`.cursor`, `.claude`, `.github`, `.codex`, `.kimi`) before falling back to `opencode` as the default — so a brand-new project, or `izanagi init` invoked non-interactively (as Claude Code itself does when running shell commands, since stdin isn't a TTY), silently got the `opencode` adapter instead. This is very likely why users reported "skills and agents aren't showing up automatically in Claude." Fixed by detecting the CLI's own env vars first (`CLAUDECODE`/`CLAUDE_CODE_ENTRYPOINT` for Claude Code, with best-effort checks for Cursor/Codex/Copilot too) before falling back to folder-based detection. Verified end-to-end: `CLAUDECODE=1 izanagi init <dir>` (non-interactive, no `--cli` flag) now generates `.claude/` correctly.
- **`exportToClaude()` only ever exported a hardcoded subset of 10 "curated" skills to `.claude/skills/`** (`CLAUDE_SKILLS`), even though the library has 103. This is very likely the second half of the "skills aren't showing up" report — asking Claude to list its skills only ever surfaced ~10. Claude Code's own progressive-disclosure design (name+description always loaded, full body only read when a skill activates) makes exporting the whole library cheap, so `exportToClaude()` now calls the new `listAllSkillNames()` and exports all 103. `CLAUDE.md`'s own "Skills" section rewritten to stop duplicating the skill list inline (redundant with what Claude Code already loads natively from `.claude/skills/*/SKILL.md`).
- **All 22 agent JSON definitions had a `model` field pinned to a specific dated Claude snapshot ID** (`claude-sonnet-4-20250514`, `claude-sonnet-4-6`, `claude-opus-4-1-20250805`) that no longer resolves in current Claude Code installs — invoking any of these as a native subagent failed outright with "model not found," which would read exactly like "the agent/skill isn't being used." Replaced with the generic tier aliases (`sonnet` / `opus`) that Claude Code resolves to the current model in that tier server-side, so this can't go stale the same way again.
- **`.manifest` generation double-counted skills.** `generate-manifest.ts` deduplicated resolved skill-resolver aliases by the *raw target string* (e.g. `skills/foo` and `skills/foo/SKILL` are two different alias targets that both resolve to the same `skills/foo/SKILL.md` file) instead of the *resolved path* — so 44 skills were counted twice, inflating the long-claimed "212 skills" figure. Real count is 103 in `skills/` (168 across all 11 catalogued categories including `architecture/`, `coding/`, `database/`, etc.). Fixed the dedup key; corrected the "212 skills" claim to 103 everywhere in README.md/AGENTS.md/ROADMAP.md (and the `Skill Library` pack description, which also claimed a stale "111+").

### Added
- **New agent: `/ai-engineer`** (`agents/ai-engineer-agent.json`) — Software Engineer specialized in features that call, orchestrate, or evaluate an LLM: RAG pipelines, embeddings/vector DBs, autonomous agents with tool-calling/MCP, versioned prompt engineering, and LLM output evaluation/guardrails. Deliberately scoped apart from `senior-engineer` (generic full-stack/CRUD/UI) to avoid overlap — its own identity explicitly calls out the boundary and hands off to `senior-engineer` for non-AI plumbing. Wired into `CLAUDE_AGENT_TOOLS`/`CLAUDE_AGENT_TRIGGERS` (`src/exporters.ts`) and the agent count/table updated in AGENTS.md/README.md/SYSTEM.md/ROADMAP.md (21 → 22).

All 217 tests pass; `izanagi doctor` PASSED (0 errors, 0 warnings); `izanagi init`/`izanagi export --cli all` re-verified end-to-end in this repo's own `.claude/`, `.codex/`, `.cursor/`, `.github/`, `.kimi/`, `.opencode/` (dogfooded — all previously stale from before this release, regenerated clean).

---

## [3.0.0] — 2026-08-15

### Fixed (CRITICAL)
- **Every runtime CLI command (`run`, `doctor`, `memory`, `trace`, `eval`, `benchmark`, `agent`, `skill`, `workflow`, `resume`, `approve`, `reject`, `explain`, `chat`, `create`, `compile`) operated on the installed package's own directory, not the user's project.** `src/cli/index.ts` computed `baseDir` from `path.resolve(__dirname, '../../')` (the izanagi-ai install location) and passed it to every command, never consulting `process.cwd()`. Found by smoke-testing `izanagi init` + `izanagi doctor` end-to-end in a fresh scratch project: doctor reported the framework repo's own trace/memory counts instead of the empty scratch project's. In a real npm install (global or `npx`), this meant every runtime command after `init` would read/write inside `node_modules/izanagi-ai` instead of the user's actual project — the CLI only ever appeared to work when run directly from inside the framework's own repo checkout, where the two paths coincide by accident.
- Fix: wired in `resolveFrameworkRoot(cwd)` (already existed in `src/installer.ts`, unused) — prioritizes the project's own `.agents/` (created by `izanagi init`) and falls back to the package directory otherwise. `packageDir` (via `getPackageDir()`) is now used only for the CLI's own `package.json` version lookup.
- Bumped as a major version: this changes the resolved root directory for every runtime command, a fundamental (if previously-broken) behavior change.

---

## [2.13.0] — 2026-08-15

### Added
- `exportToOpencode()` (`src/exporters.ts`) + `izanagi export --cli opencode`: `.opencode/agent/*.md` (the 21 specialist agents + the "Izanagi Multi-Agent Orchestrator" invoked via `/agents`) are now generated from `agents/*.json`, the same way as every other CLI adapter. Previously `src/installer.ts` only did a one-time static copy from a frozen snapshot shipped in the npm package — any fix to an agent's identity/handoffs/tools never reached opencode/Kimi CLI users. Verified against opencode's actual docs first: the `mode` frontmatter field (primary/subagent/all) defaults to `all` when omitted, which all files already had, so automatic description-based dispatch was never actually broken — the real bug was pure staleness, not a missing config field.

### Fixed
- **`AgentFactory.generate()`** (`izanagi agent create`) wrote the genome file to `agents/generated/` unconditionally, even when `validateGenome()` failed — contradicting agent-architect's own "Sem aprovação, sem registro" rule and inconsistent with `SkillFactory`, which correctly withholds the file on failure. Now gated the same way.
- **`loadIzanagiAgents()`** only scanned `agents/*.json`, so an agent successfully registered via `izanagi agent create` in `agents/generated/` was runnable via `izanagi run` but invisible to `exportToClaude()`/`exportToCodex()`/etc. — never reachable as a native subagent without a manual file move. Now scans `agents/generated/` too (matching `SkillResolver.loadAgent()`'s existing behavior).
- Removed 9 junk files that had accumulated in `agents/generated/` from past ad-hoc CLI testing (single-word test prompts like "500", "banco" — not real agents); would have been exported as garbage subagents the moment the fix above went live.
- Tool-grant mismatches in `CLAUDE_AGENT_TOOLS` (`src/exporters.ts`): `adversarial-critic` was missing `Bash` despite its identity mandating an active "try to actually break it" execution phase; `bug-hunter` was missing `Write` despite its own always-rule requiring it to create new regression-test files; `product-reasoner` was missing `Write` despite claiming to persist a requirements artifact.
- `agents/pm-agent.json`, `devops-agent.json`, `database-agent.json`: `optionalSkills` listed `"architect-agent"` (an agent filename, not a skill/alias) — renamed to the real alias `"architect"`.
- Softened `agent-architect`'s identity/never-list claim of an automated `minScore` evaluation gate before registration — the actual code only checks structural genome completeness; `minScore` is genuinely unmeasurable before an agent has ever run, and is really consumed later by the separate, manual `izanagi eval` command. Text now describes what's real vs. what `minScore` is actually for.
- `SYSTEM.md`: Policy Engine and Evidence System sections claimed guarantees ("Wired em `ToolRegistry.execute()`") that don't hold — `Orchestrator.executeNode()` calls the LLM producer directly and never touches `ToolRegistry`/`PolicyEngine`/the Evidence module in the real `izanagi run` path. Both are real, tested, working subsystems in isolation, just not wired into the reachable execution path yet; marked with explicit caveats instead of overclaiming an enforced security boundary.
- `izanagi --help`: pointed the documented `create agent`/`create skill` example at the real, validated `agent create`/`skill create` Factory pipelines instead of the bare unvalidated scaffold command.
- `skills/feature-flags`: Split.io → Harness FME (acquired/rebranded), a stale vendor name the 2.11.0 fact-check pass missed.
- `skills/sequence-diagram-builder`: fixed a real Mermaid.js semantics error (dashed arrows mean "reply", not "async" — the file's own worked example contradicted its own checklist item).
- 31 of 103 skills still carried legacy frontmatter (`version`/`compatibility`/`triggers`/`token_budget`) and an English "> Version... Priority..." banner left over from an older skill-authoring generation. Stripped to `name`+`description` only, matching the other 72 already-normalized skills (all fields have safe defaults in `resolver.ts`).

All 217 tests + AgentFactory/SkillFactory-specific tests pass; `izanagi doctor --deep` still PASSED (0 errors, 0 warnings) after every change in this release.

---

## [2.12.0] — 2026-08-14

### Fixed
- **`.claude/agents/<slug>.md` (the file the Agent tool actually auto-delegates to) now renders each agent's `identity` field**, not just the one-line `role`. Every densely-researched agent identity (OWASP Top 10:2025, WCAG 2.2 SC numbers, TypeScript strict flags, Testing Trophy, etc.) was previously discarded at the primary invocation path — only the manually-typed `/<slug>` slash command had it.
- Fixed a systemic `-agent` slug-suffix bug: 26 `handoffs[].to` entries and 5 chain steps across 15 agent JSON files pointed at non-existent subagent names (e.g. `senior-engineer-agent` instead of the real `senior-engineer`) — any orchestration reading declared handoffs would fail to resolve roughly two-thirds of them.
- `techlead-agent.json` had `handoffs: []` despite being a declared inbound target from 3 other agents, with no path back after a failed review; added handoffs to `senior-engineer`/`qa`.
- Disambiguated overlapping agent triggers: the four new-project entry points (`discovery`/`product-reasoner`/`architect`/`pm`) and the five post-delivery review agents (`qa`/`security`/`techlead`/`adversarial-critic`/`evaluator`) previously matched the same generic requests with no signal for which to pick.
- `senior-engineer`'s TDD rule was gated on "before declaring done" (allowed write-then-test); reworded to a red-before-code gate matching `bug-hunter`'s stronger phrasing. Added `architecture-patterns` to its core skills (was optional-only, so `implement`/`bug`/`refactor` chains never touched it).

### Changed (token economy)
- Removed the "Sempre/Nunca (consolidado de todos os agentes)" block from `CLAUDE.md` — duplicated all 21 agents' rules (including single-agent-only ones) into an always-loaded section.
- Removed `ui-ux-pro-max`/`motion-design`/`animation-web`/`webgl-3d` from `CLAUDE_SKILLS` — niche visual/3D skills paying a fixed cost every session regardless of task, already reachable on-demand via the owning agents.
- `CLAUDE.md`: 7921 -> 5899 bytes this release (11891 at the start of the 2.11.x token-economy pass).
- Regenerated stale `.codex/instructions.md`/`.github/copilot-instructions.md` (were listing 12 of 21 agents, stale path from a different machine).

### Changed (output quality / anti-AI-slop)
- `RULES.md` rule 12 contradicted rules 14-16: it mandated `bg-zinc-950`+glassmorphism+bento as THE anti-generic answer, while 14-16 ban any default aesthetic and require a bespoke per-niche direction. Reworded rule 12 (and its 4 echoes across the CLI export templates) to state the principle without prescribing one look as default.
- `skills/frontend/SKILL.md`'s "every public page must follow" snippet was itself the exact AI-slop cliché its sibling skill `anti-ai-slop` flags as a tell; marked as a reference example for one specific direction, not a copy-paste template. Its form/button/feedback/typography examples switched from default Tailwind gray/blue to the file's own declared brand tokens, plus a warning against Inter-only typography.
- Added "See also" cross-references between `animation-web`/`motion-design`/`webgl-3d` SKILL.md files pointing at `core/skill-composer.md`'s chains.

---

## [2.11.1] — 2026-08-14

### Added
- `caveman` (ultra-compressed communication, ~65% output token cut) added to `CLAUDE_SKILLS` — always-loaded alongside `economia-tokens`, the two token-economy skills (input side + output side).

### Changed
- **`CLAUDE.md` no longer mandates reading `AGENTS.md` in full before every task** (was an unconditional ~12.6KB read on top of `CLAUDE.md` itself, every session). `AGENTS.md`/`SYSTEM.md`/`RULES.md` are now referenced on-demand for the specific topics `CLAUDE.md` doesn't already cover (release flow, full folder structure, internal engines).
- Agent table's role column and always-loaded skill list descriptions in `CLAUDE.md` truncated harder (full untruncated role -> 70 chars, 120 -> 60 chars) since the full detail is already reachable on-demand via `.claude/agents/<slug>.md` and each skill's own file — no functionality lost, just deferred to when it's actually needed.
- `CLAUDE.md`: 11891 -> 7921 bytes (-33%).
- Fixed stale agent/skill counts in `izanagi export --help` (said 12 agents/13 skills; actual is 21/14).

### Removed
- Stray `caveman/README.md` from the skill export — no other skill in the library ships one; not part of the `SKILL.md` convention.

---

## [2.11.0] — 2026-08-14

### Added
- **Subagents nativos do Claude Code** (`.claude/agents/*.md`): os 21 agentes agora exportam no formato nativo (`name`/`description`/`tools`/`model`) além dos comandos slash — aparecem no Agent tool e o Claude Code delega sozinho pela `description` (padrão "Use PROACTIVELY quando..."), sem precisar chamar por nome. `tools` é escopado por papel (nunca herda acesso total).
- Cada `.claude/agents/<slug>.md` lista suas skills por caminho (`skills/<nome>/SKILL.md`), lidas sob demanda só quando o agente é ativado — segunda camada de progressive disclosure além da já existente (skill body só carrega quando a skill é ativada).

### Changed
- **Export de skills pro Claude Code deixa de resumir o corpo.** O resumidor (`parseSkillMarkdown`) quebrava listas/parágrafos em texto corrido ilegível; o corpo agora é cópia fiel do SKILL.md original — carregamento sob demanda já é gratuito, resumir só destruía a qualidade.
- **Descrições de todas as 103 skills reescritas**: uma frase, gatilho de uso explícito ("Use quando..."), sem fluff de marketing ("Inspirado em X, Nk stars") — cada skill tem custo fixo (~100 tokens) em toda sessão só por existir; a descrição precisa carregar sinal, não enfeite.
- **21 agentes tiveram a `identity` aprofundada** com pesquisa grounded em fontes reais e atuais (2026): OWASP Top 10:2025, OAuth 2.1/PKCE, Expand-Contract migrations, INVEST/BDD, ISO/IEC 25010, Cognitive Load Theory, Opportunity Solution Tree, entre outras — nomeando ferramentas/padrões/versões específicas em vez de "melhores práticas" genérico.
- **20 skills de maior tráfego aprofundadas** com referências reais e correções factuais (ex.: GSAP é gratuito para uso comercial desde a aquisição pela Webflow em abr/2025; Google descontinuou FAQ rich results em mai/2026; OWASP Top 10:2025 consolidou SSRF em Broken Access Control).
- Regra "Study-First" (`RULES.md`/`AGENTS.md`) deixa de mandar carregar as 4 arquivos de `.agents/memoria/` inteiros em toda tarefa — só `contexto.md` sempre, o resto por domínio da tarefa.
- `agents/*.json`: removidos os campos `constraints`/`requiredSkills`, redundantes com `never`/`skills`.

### Fixed
- `izanagi doctor`/`izanagi chat /doctor` detectavam "modo projeto instalado" (`.agents/` como raiz) pela simples existência da pasta `.agents/`, mesmo quando ela só continha `.agents/memoria/` local — passava a procurar `SYSTEM.md`/`RULES.md`/`skill-resolver.json` no lugar errado e falhava com "missing". Agora exige `.agents/agents/` (instalação completa) antes de trocar a raiz.
- `core/skill-resolver.json` tinha uma edição local não commitada (nunca enviada) que derrubava os aliases de 248 para 116, quebrando `routing.test.ts` — restaurado para a versão consolidada do commit `ae86d8a`.

## [2.10.4] — 2026-08-12

### Added
- **Policy Engine** (`src/runtime/security/policy.ts`): permissão contextual (ambiente dev/ci/produção, trust tier builtin/generated/community), distinta do Security Scanner (que só detecta conteúdo perigoso). Wired em `ToolRegistry.execute()`.
- **Trust tiers no Skill Scanner**: `scanDirectory` infere builtin/generated/community pela origem e `decideByTrustTier()` aplica bloqueio escalonado (mesmo nível de risco pode ser permitido para builtin e bloqueado para community) — inspirado no modelo de tiers do Hermes Skills Hub.
- **Checkpoint/Resume real** (`src/runtime/recovery/checkpoint.ts`): o Orchestrator salva o progresso a cada rodada de batches; `resumeRunId` retoma sem replanejar nem reexecutar nós já concluídos, restaurando budget/artefatos/modelo. `izanagi resume <run-id>`.
- **Decision Journal** (`src/runtime/memory/decisions.ts`): decisão + alternativas realmente consideradas (com score) + razão + confiança, para model-routing e agent-routing. `izanagi explain <run-id>`.
- **Artifact Registry** (`src/runtime/artifacts/registry.ts`): artefatos rastreáveis (produtor, hash, dependências, versão em retry/replan) — `consumers()`/`history()` respondem rastreabilidade sem reconstruir a partir do trace.
- **Human-in-the-loop real**: novo `GraphNode.kind: 'approval'` pausa a execução (não é falha, não aciona self-healing) até decisão via `izanagi approve <run-id>` / `izanagi reject <run-id> --reason="..."`, retomando pelo mesmo mecanismo de checkpoint.
- CLI: `izanagi resume`, `izanagi approve`, `izanagi reject`, `izanagi explain`.

### Changed
- **BREAKING (comportamento, não API):** `izanagi run` agora executa via Adaptive Runtime (graph + adaptive routing + evaluation + trace + self-healing + memory) **por padrão** — antes disso era necessário `--runtime`/`-r`, e sem essa flag o comando só imprimia um plano estático e gravava `izanagi-prompt.md`, sem de fato executar nada. Elimina o caminho paralelo entre "run estático" e "run --runtime". `--runtime`/`-r` continuam aceitas como no-op de compatibilidade.
- Novo modo `izanagi run "..." --prompt-only` (`-p`) preserva o comportamento antigo de só compilar `izanagi-prompt.md` para colar em outra ferramenta de IA, sem executar nada.
- `ModelRouter.route()` respeita `IZANAGI_MODEL` (override manual) e `ModelRouter.loadProjectProviders()` lê `.izanagi/izanagi.config.json → models` — extensibilidade de catálogo que já era documentada mas nunca implementada.
- `MemoryStore` passa a rastrear performance por modelo (`recordModelRun`/`modelStats`/`historicalPerformance()`), preenchendo `RoutingContext.historicalPerformance`, que antes existia no tipo mas nunca era populado.

### Fixed
- `GraphNode.condition` e `BenchmarkValidator.check` eram avaliados via `new Function(...)` — execução de código arbitrário sobre dados que podem vir de `.agents/benchmarks/*.json` de terceiros. Substituído por um avaliador de expressão seguro (parser/AST próprio, sem `eval`).
- `TraceStore.list()` tinha um comparador de sort inconsistente (nunca retornava 0), causando ordenação não-determinística de runs com o mesmo timestamp — corrigido com desempate por sequência monotônica.
- Removida a duplicação de roteamento de modelo entre `Orchestrator` e `cli/commands/run.ts` — o producer da CLI agora consome `ctx.model`/`ctx.provider` do próprio Orchestrator em vez de rotear de novo e aplicar fallback manual.
- `izanagi run`/`resolve` não era `await`ado no dispatcher da CLI (fire-and-forget em uma função async) — corrigido.
- Removida autodependência de `izanagi-ai` no próprio `package.json`.

### Removed
- 5 agentes placeholder de teste comitados por engano em `agents/generated/`.

---

## [2.10.0] — 2026-08-11

### Added
- **Agent Genome (PHASE 7)**: os 18 agentes core agora declaram os 13 campos formais do genome (purpose, capabilities, requiredSkills, optionalSkills, inputs, outputs, constraints, permissions, handoffs, memory, evaluation, tokenBudget, compatibility) — base para scoring e roteamento adaptativo.
- **Agent Factory via CLI**: `izanagi agent create "<requisito>" [--name=slug] [--skills=a,b]` gera agentes com genome completo em `agents/generated/`, detecta lacuna vs. os 18 core (recusa lacuna já coberta) e é descoberto automaticamente por `loadAgent`/`agent list`.
- **Skill Factory via CLI**: `izanagi skill create <nome> --gap="..." [--force]` cria skills em `skills/generated/<nome>/SKILL.md` com frontmatter de manifesto, security scan pré-escrita (persiste só com severidade LOW) e recusa de lacuna já coberta; bug de sobrescrita entre skills corrigido (subdir por skill + mkdir do parent).
- **Tool Registry (MCP-ready)**: `src/runtime/tools/registry.ts` — tools builtin `fs.read`/`fs.write`/`fs.ls` com fluxo discover → permission → validate → execute, sandbox de zona (anti path-traversal) e permissões least-privilege.
- **Evaluation Engine — veredito UNKNOWN**: sem métricas mensuradas o runtime agora emite **UNKNOWN** com recomendação explícita de evidência (antes: nunca retornava o veredito).
- **Skill Scanner — DEFENSIVE_CONTEXT**: exemplos educativos/defensivos (não/evite/auditar...) deixaram de ser falsos positivos; `izanagi doctor --deep` passou a varrer as 212 skills sem falso positivo.
- **Testes**: 14 novos (factories: 6, tools: 7, scanner defensivo) — total 136 testes de runtime passando.

### Fixed
- **DNG-001**: regex `\/\b` nunca casava comandos destrutivos → padrão corrigido.
- **PER-001**: `Array.includes('*')` não detectava wildcards em permissões → `some(p => p.includes('*'))`.
- **SkillFactory**: todas as skills eram gravadas no mesmo arquivo e `writeFileSync` falhava sem subdir → subdir por skill + `mkdirSync` do parent.
- **Resolver/CLI**: `loadAgent` e `agent list` não enxergavam `agents/generated/` → agora varrem o diretório gerado.

### Documentation
- SYSTEM.md: novas seções (Execution Pipeline, Agent Factory & Skill Factory, Benchmarks & Regression, Model Router, Tool Registry, Doctor --deep) + tabela de módulos atualizada.
- README.md: tabela de comandos da CLI reescrita (agent create, skill create --gap, workflow, eval, benchmark, trace, memory, doctor --deep).

---
## [2.9.6] — 2026-08-11

### Fixed
- **Healing Engine**: skill_replacement agora aplica de fato a substituicao de skill no no (reescreve node.skills com a skill de fallback) em vez de apenas registrar a intencao; validacao usa validateArtifact em PT-BR com healing por artefato invalido.
- **Orchestrator**: avaliacao final consome o artefato test-results para reportar regressoes (testes falhando -> FAIL/BLOCKED com recomendacao); healing de validacao respeita retryNow com tentativas limitadas.
- **Skill Scanner**: regras reais funcionando — DNG-001 (comando destrutivo), PER-001 (permissoes wildcard), SCR-001 (scripts no frontmatter), NET-001/002, SEC-001, INJ-001/003, DNG-002/003/004.
- **LLM Executor**: adapters reais OpenAI/Anthropic/OpenRouter com validacao de env key, timeout e propagacao de erro HTTP (antes: stub inerte).
- **Memory/Trace**: agent stats persistidos e traces JSONL com load/list/retry de escrita.
- **Documentacao**: SYSTEM.md reescrito com a arquitetura real do runtime, AGENTS.md atualizado para 18 agentes / 212 skills / 15 composicoes, README.md reescrito.

### Added
- **122 testes de runtime** (node --test dist/runtime/tests/*.test.js): orchestrator (ciclo completo, retry, abort, skill_replacement, regressoes), evaluation, artifact contracts, resolver, scanner, memory, tracer, llm.
- **Frontmatter de metadados** (name, description, version, compatibility, triggers, token_budget) em 27 skills que nao declaravam.

### Enhanced
- Composicoes do resolver mapeadas por categoria de runtime (implementation, testing, debugging, database_design).
- .agents/memoria/ sincronizada com os aprendizados reais da sessao.

---
## [2.8.0] — 2026-08-10

### Added
- **14th Specialized Agent (`/qa`)**: QA & Test Automation Engineer (`agents/qa-agent.json` + `.opencode/agent/qa.md`) for automated unit testing, integration tests, E2E (Playwright), accessibility (WCAG), and quality gates.
- **Multi-Agent Swarm Default & Orchestrator Hardening**: Enforced parallel concurrent multi-agent delegation as default in Agents Orchestrator (`/agents`), forbidding monolithic single-agent execution on complex SaaS/application requests.
- **Advanced GitHub & AI Agent Curadoria**: Expanded `references/repos-ai-agents.md` with top open-source AI agent standards, prompt banks (grill-me, humanizer, websiteprompts), and modern UI component systems (21st.dev, Cult UI, Skiper UI, React Bits).
- **Persistent Memory Protection**: Automated persistent session checkpoints in `.agents/memoria/` to guarantee zero loss on hardware or application crashes.
- **New skill `design-directions`** (Style Selector): presents 3-5 BESPOKE design directions per industry (palette, typography, layout signature, motion signature) for the user to choose BEFORE any code — never a single template.
- **New skill `anti-ai-slop`**: full catalog of AI-generated design tells (Inter default, purple gradients, hero + 3 cards, rounded-2xl uniformity, "Build the future" copy) with detect/fix workflow and the identity test.
- **New skill references** for `design-directions` and `anti-ai-slop` (2026 curated sources: avoid-ai-design, Superdesign, 925studios, BSWEN/Anthropic grading).

### Enhanced
- **`economia-tokens` rewritten with real context engineering**: prompt caching (static first, dynamic last), lost-in-the-middle awareness (~32K), sliding window, model routing, output constraints, and a conscious exception (economy never sacrifices deliverable depth).
- **Agents Orchestrator rewritten as Supervisor + Swarm**: task decomposition, parallel dispatch with isolated context per agent, coordination via on-disk artifacts, aggregation, and mandatory Design Experience Flow (Style Selector → Anti AI-Slop → experience over speed).
- **Skill chains updated** (`web_cinematic`, `webgl_experience`, `fullstack_crud` + animation/senior-engineer/discovery agents) to include `design-directions` first and `anti-ai-slop` before QA.
- **RULES.md rules 13-16**: detailed anti-AI-slop catalog, dynamic industry-tailored design system, mandatory Style Selector, and AI-tells audit.
- **SYSTEM.md principles 13-15**: Style Selector, Anti AI-Slop, Token Economy.
- **Blueprint Engine & Materialization Contracts** synchronized across all 14 agents to enforce zero stubs, zero checklists, and full vertical-slice SaaS delivery (Landing Page + Auth + Dashboard + Backend + README + QA).
- **agents/INDEX.md** updated to 14 agents.

---

## [2.3.3] — 2026-08-03

### Fixed
- **Skill Resolver**: alias `learning` apontava para `skills/continuous-learning-engine` (inexistente — skill consolidada em `continuous-improvement`). Agora aponta para `skills/continuous-improvement/SKILL`.
- **`verify-build`**: `npm run verify` quebrava com `TypeError: selectedPackIds is not iterable` porque `installToProject` era chamado sem o segundo argumento. Agora passa todos os pack IDs no teste de instalação em sandbox.

### Removed
- **`skills/privacy-engineer`**: duplicata morta de `skills/security-privacy` (mesmo escopo LGPD/GDPR, marcada `disabled` no `.manifest`, sem uso em nenhuma chain). Removida skill + alias `privacy-engineer` do resolver.
- **`.manifest`**: catálogo estático obsoleto (versão 2.2.1, 55 paths quebrados, sem leitura em nenhum código). Removido do pacote e do repositório.

## [2.3.2] — 2026-08-02

### Added
- Portado `skills/tdd/references/writing-good-tests.md` (técnicas de escrita de testes de alta qualidade).
- Portado `skills/webapp-testing/examples/*.py` (4 exemplos Playwright: sandbox server, discovery de elementos, console logging, automação HTML estático) com paths adaptados para `outputs/`.

## [2.3.1] — 2026-08-02

### Added
- Portado `skills/ui-ux-pro-max/references/quick-reference.md` + `pro-rules.md` (regras UX da Apple/HIG de alto impacto em texto).

### Fixed
- URL `http://highscalability.com` → `https://highscalability.com` (mixed content).

## [2.3.0] — 2026-08-02

### Added
- **Discovery Agent** (`/discovery`): pré-produção completa antes de codar — entrevista, pesquisa web, preview e prompt de implementação.

## [2.2.1] — 2026-07-31

### Fixed
- /animation opencode agent: color: green era inválido no schema (só aceita hex ou tokens do tema) — agora color: "#22c55e" 

## [2.2.0] — 2026-07-31

### Changed
- **Package renamed back: `Izanagiai` → `izanagi-ai`** — o framework volta ao nome original Izanagi AI (repo GitHub `izanagi-ai`, site `SiteIzanagi`)
- **Bins renomeados**: `Izanagi`/`Izanagiai` → `izanagi`/`izanagi-ai` (comandos agora são `izanagi init`, `izanagi run`, etc.)
- CLI internamente renomeada: `Izanagi AI CLI`, config do projeto em `.izanagi/izanagi.config.json` (era `.Izanagi/Izanagi.config.json`)
- Documentação (AGENTS.md, README, CONTRIBUTING) atualizada para o novo nome/comandos

### Fixed
- `--help` imprimia "Unknown option" junto com a ajuda (caso `--help` compartilhava bloco com `default:`)

## [2.1.1] — 2026-07-31

### Added
- **Animation Engineer agent** (`agents/animation-agent.json`): sites cinematográficos — scrollytelling, scroll-driven animations, 3D WebGL e motion design
- **3 novas skills** (com `references.md` pesquisado em 2026):
  - `animation-web` — scroll image sequences estilo Apple, GSAP ScrollTrigger, Lenis, pinned sections, preloaders (referências: uiprompts.app, Skiper UI, KokonutUI, Apple product pages)
  - `webgl-3d` — Three.js / React Three Fiber, shaders, partículas, GLTF/Draco, perf budgets (referências: Bruno Simon, The Monolith, DeepSee, KINESIS)
  - `motion-design` — decisão de biblioteca GSAP vs Anime.js v4 vs Motion vs Lottie vs CSS, timing/easing/stagger
- **Agente opencode `/animation`** (`.opencode/agent/animation.md`): ativado digitando `/animation` no opencode; copiado automaticamente para projetos pelo `izanagi init`
- Classificação de tasks de animação/3D no `izanagi run` (ex: `izanagi run "site animado com 3d"` → Animation Engineer)

### Changed
- AGENTS.md atualizado: 11 agentes, skills ativas incluem animation-web/webgl-3d/motion-design

## [2.1.0] — 2026-07-31

### Added
- **Pack system** on `izanagi init`: interactive multi-select of skill packs (arrow keys, space, `a`/`n`) or `--packs a,b,c` flag. `core` is always included.
- `izanagi init <dir>` now creates the project directory if it doesn't exist, plus `.izanagi/izanagi.config.json` and `opencode.json` (auto-loads the framework in opencode)
- `izanagi run [agent] --task "<task>"`: run a specific agent (incl. custom ones created via `izanagi create`) with full skill chain resolution against `core/skill-resolver.json`
- Context resolution: CLI commands now prefer the project's `.agents/` (created by init) with fallback to the installed package
- Interactive pack selector with graceful fallback for non-TTY environments

### Changed
- **Package renamed `izanagi-ai` → `Izanagiai`** (bins `Izanagi`/`Izanagiai` unchanged) — reverted in 2.2.0
- `AGENTS.md` and `README.md` rewritten with the new CLI commands and pack system
- Commands `compile`, `list`, `doctor` now resolve agents/skills from project `.agents/`, cwd or installed package

### Removed
- **Postinstall auto-copy removed** — this was the cause of duplicated files (`.agents/` + package contents). `.agents/` is now created only by `izanagi init`

### Fixed
- `izanagi run "task"` (without `--task`) now works again alongside `run [agent] --task "..."`

## [2.0.8] — 2026-07-23

### Added
- `izanagi create <agent|skill> <name>` command to scaffold new agents and skills
- `coding/` directory (13 language/framework skills) to npm package and `izanagi init`

### Fixed
- `bin/izanagi.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

## [2.0.7] — 2026-07-23

### Changed
- Bump version to 2.0.7

### Fixed
- `bin/izanagi.js` import path fix (previously attempted, incomplete)

## [2.0.6] — 2026-07-23

- Bump version to 2.0.6

### Fixed
- `bin/izanagi.js` import path: changed `../src/cli/index.js` → `../dist/cli/index.js` to fix `ERR_MODULE_NOT_FOUND` on published package

## [2.0.0] — 2026-07-22

### Changed
- Version bump to v2.0.0 (all Phases 1-6 implemented)
- Cleansed project-specific references for public release
- Fixed all broken paths in decision-engine skill chain matrix
- Registered 31 orphan skills in INDEX.md and skill-resolver.json
- Corrected count mismatches across INDEX.md, CHANGELOG.md, ROADMAP.md
- Updated ROADMAP.md to reflect actual implementation state

## [1.0.0] — 2026-07-17

### Added

#### Core
- `SYSTEM.md` — Foundation: identity, principles, architecture, token budget, quality gates, memory, evolution.
- `RULES.md` — 9 golden rules, skill declaration, communication, memory, quality, security, error recovery.
- `README.md` — Entry point, quick start, principles table.
- `decision-engine.md` — 15 category classification, skill chain matrix, keyword routing, 70% confidence threshold.
- `context-engine.md` — 4-section context window, load prioritization, compression algorithm, relevance scoring.
- `token-manager.md` — 4-tier budget, priority-based allocation, real-time monitor, compression triggers.
- `compression-engine.md` — 4 compression levels (lossless → emergency), 5 strategies, decision preservation.
- `reflection-engine.md` — Post-task self-review, 5-dimension scoring, pattern detection (50-task rolling window).
- `evolution-engine.md` — 6 pattern → action mappings, 4 change types, auto-apply rules, full traceability.
- `quality-gates.md` — 5 gates (security, style, clarity, conciseness, completeness), security is fatal.
- `planning-engine.md` — Atomic step decomposition, topological sort, effort estimation, circular dependency detection.

#### Memory (6)
- `memory-manager.md` — 3-tier (session/project/long-term), JSON storage, knowledge graph, recall engine.
- `session-compression.md` — 200-token session summary, decision/error/action preservation.
- `conversation-summarizer.md` — 68:1 compression, extraction priority, YAML summary format.
- `context-recovery.md` — Session recovery flow, recovery prompt template.
- `smart-recall.md` — Relevance scoring (keyword 0.4 + recency 0.3 + relation 0.3).
- `long-term-project-memory.md` — Persistent project context across sessions.

#### Optimization (3)
- `token-reducer.md` — 6 reduction techniques, format selection matrix (8 types).
- `prompt-optimizer.md` — 4 optimization passes (noise, implicit, ambiguity, structure).
- `cost-optimizer.md` — Token cost tracking, infrastructure optimization strategies.

#### Architecture (10)
- `clean-architecture.md` — Layers, directory structure, dependency rule.
- `hexagonal-architecture.md` — Ports & Adapters, testability, infrastructure swap.
- `cqrs-specialist.md` — Read/write separation, when to use/avoid.
- `event-driven-architect.md` — Events, brokers (RabbitMQ/Kafka/Redis), idempotency.
- `ddd-specialist.md` — Building blocks, ubiquitous language, aggregate example.
- `microservices-expert.md` — When to use/avoid, key patterns, service template.
- `monolith-expert.md` — Modular monolith, migration path to microservices.
- `repository-pattern.md` — Interface contract, implementation, rules.
- `unit-of-work.md` — Transactional consistency, commit/rollback, clear.

#### Coding (13)
- `backend-engineer.md` — Multi-language (PHP, Node, Python, C#), conventions, checklist.
- `frontend-engineer.md` — React + TS + Tailwind, state management (5 states), a11y, performance.
- `api-designer.md` — REST conventions, response envelope, auth decision tree, rate limiting, OpenAPI.
- `laravel-specialist.md` — Eloquent, Form Requests, Policies, conventions, patterns.
- `php-specialist.md` — PHP 8.x features, PSR-12, PHPStan level max config.
- `javascript-specialist.md` — ES2022+, functional patterns, checklist.
- `typescript-specialist.md` — Strict mode, discriminated unions, branded types, tsconfig.
- `python-specialist.md` — Python 3.11+, typing, dataclasses, async.
- `react-specialist.md` — Hooks, RSC, compound components, performance checklist.
- `vue-specialist.md` — Composition API, Pinia, TypeScript, conventions.
- `nodejs-specialist.md` — Express/Fastify, error handling, services, checklist.
- `java-specialist.md` — Java 17+, Spring Boot 3, records, virtual threads.
- `csharp-specialist.md` — .NET 8, Minimal APIs, primary constructors, records.

#### Security (3)
- `security-engineer.md` — OWASP Top 10, secrets detection (7 regex), security report.
- `owasp-auditor.md` — Full OWASP Top 10 audit, CVSS severity, CVE references.
- `pentest-reviewer.md` — 5 attack categories (IDOR, priv esc, mass assignment, SSRF), report format.

#### Quality (12)
- `senior-code-reviewer.md` — 6-dimension scoring, 4 severity levels, YAML report.
- `clean-code-validator.md` — 6 validation categories, function size heuristic, before/after examples.
- `solid-validator.md` — 5 principles with checklists, score, refactoring recommendations.
- `dry-kiss-yagni-validator.md` — 3 principles with checks and examples.
- `complexity-analyzer.md` — Cyclomatic complexity (McCabe), cognitive complexity, thresholds.
- `bug-prevention.md` — 4 prevention layers, 8 bug patterns with detection and prevention.
- `design-pattern-advisor.md` — Decision tree, pattern suggestions, anti-patterns.
- `refactoring-specialist.md` — 12 code smells, 3 techniques, safety checklist, plan template.
- `technical-debt-analyzer.md` — 6 debt categories, estimation formula, prioritized backlog.
- `breaking-change-detector.md` — API and database breaking changes, detection flow.
- `performance-optimizer.md` — Audit workflow, bottleneck types, caching strategy (4 levels).
- `scalability-expert.md` — 4 scaling dimensions, horizontal scaling checklist, sharding.

#### Testing (4)
- `unit-test-engineer.md` — Pest/Jest/pytest/xUnit, Arrange-Act-Assert, edge case checklist, naming convention.
- `integration-test-engineer.md` — Scope, Laravel/Pest example, database testing.
- `e2e-test-engineer.md` — Cypress/Playwright, critical journeys, example.
- `mocking-specialist.md` — 5 double types, frameworks (Mockery, Jest, Mockito, Moq), rules.

#### DevOps (8)
- `devops-engineer.md` — 8-step workflow, Docker, CI/CD, monitoring, backup, security hardening, runbook.
- `docker-expert.md` — Multi-stage, image optimization, compose for dev, security.
- `kubernetes-specialist.md` — Deployment template, resources (ConfigMap, Secret, Ingress, HPA).
- `git-expert.md` — Trunk-based vs Git Flow, commit conventions, useful commands.
- `git-flow-specialist.md` — Branch structure, workflow, commands.
- `ci-cd-specialist.md` — Pipeline stages, GitHub Actions example, quality gates.
- `linux-specialist.md` — Server hardening, performance tuning, commands.
- `windows-specialist.md` — IIS, PowerShell, Windows-specific config.

#### Database (6)
- `database-engineer.md` — Naming conventions, data types, index strategy, migration safety levels.
- `sql-optimizer.md` — EXPLAIN ANALYZE, index rules, sargable predicates, query rewrites.
- `postgresql-specialist.md` — JSONB, full-text search, partitioning, CTEs.
- `mysql-specialist.md` — InnoDB, EXPLAIN FORMAT=JSON, performance tuning.
- `sqlserver-specialist.md` — T-SQL, execution plans, indexed views.
- `redis-specialist.md` — Data structures (5 types), use cases, eviction policies.

#### Engineering Roles (4)
- `principal-engineer.md` — Technical vision, org-level standards, decision framework.
- `staff-engineer.md` — Deep technical excellence, large feature delivery, mentorship.
- `tech-lead.md` — Team leadership, daily rhythm, engineering-product bridge.
- `cto-advisor.md` — Strategic advice, stakeholder communication, budget and risk.

#### Debugging (3)
- `bug-hunter.md` — 8-step protocol, binary isolation, debugging decision tree, bug report format.
- `debug-specialist.md` — 6-step protocol, error pattern library (4 patterns), quick diagnostics CLI.
- `root-cause-analyzer.md` — 5 Whys, Fishbone, Premortem, 7 root cause categories, pattern detection.

#### Teaching (6)
- `professor-mode.md` — 4-level detection (beginner→expert), 4 teaching strategies, interactive exercises.
- `mentor-mode.md` — 4 guidance principles, Socratic questioning, learning roadmap generator.
- `code-explainer.md` — 4 explanation levels (overview→expert), YAML format, pattern highlighting.
- `interactive-teaching.md` — 6 exercise types, interaction flow with correction feedback.
- `adaptive-teaching.md` — Difficulty/pace/style adaptation rules based on performance.
- `learning-tracker.md` — Persistent learning record, confidence scoring, progress report.

#### Analysis (5)
- `requirement-analyzer.md` — Extraction process, functional/non-functional categorization, structured format.
- `risk-analyzer.md` — Probability × Impact matrix, risk register, mitigation planning.
- `dependency-analyzer.md` — Security, freshness, compatibility, license audit, report format.
- `tradeoff-analyzer.md` — 6 criteria with weights, weighted scoring, recommendation.
- `alternative-solution-generator.md` — 3+ options format with pros/cons/effort per option.

#### Documentation (6)
- `documentation-writer.md` — 5 documentation types, README template.
- `technical-writer.md` — Diátaxis framework (tutorials/how-to/reference/explanation), writing principles.
- `readme-generator.md` — Automated sections, badge generation, stack extraction.
- `uml-generator.md` — PlantUML + Mermaid class/component/use case diagrams.
- `sequence-diagram-builder.md` — PlantUML + Mermaid sequence diagrams with actor flow.
- `er-diagram-builder.md` — PlantUML + Mermaid ER diagrams from schema.

#### Project Management (3)
- `project-manager.md` — Milestones, sprint tracking, velocity, stakeholder communication.
- `task-planner.md` — Atomic task breakdown, estimation guidelines (1-8 points), acceptance criteria.
- `release-planner.md` — Version bump rules, release checklist, changelog entry format.

#### UX/Observability (5)
- `ux-reviewer.md` — 10 Nielsen heuristics, severity-graded report.
- `accessibility-reviewer.md` — WCAG 2.2 AA (perceivable/operable/understandable/robust), audit tools.
- `logging-expert.md` — Structured JSON logging, what to log/not log by level.
- `observability-expert.md` — 3 pillars (logs/metrics/traces), RED metrics, dashboard structure.
- `monitoring-specialist.md` — Alert rules (critical/warning), incident response (6 steps).

#### Self-Improvement (6)
- `self-correction.md` — Error detection, correction protocol (acknowledge/explain/correct/prevent/log).
- `self-critique.md` — 8 critique questions, proactive revision process.
- `continuous-improvement.md` — Improvement cycle, effectiveness tracking.
- `hallucination-detection.md` — 4 confidence levels (90%+ to <50%), detection patterns.
- `confidence-estimator.md` — Source reliability scoring, communication patterns per confidence level.
- `continuous-learning-engine.md` — 3 learning sources, knowledge gap detection.

#### Skills (1)
- `INDEX.md` — Complete registry of all 111 skills with status and file paths.

---

### Stats

| Category | Skills |
|----------|--------|
| Core | 8 |
| Architecture | 10 |
| Coding | 13 |
| Security | 3 |
| Quality | 12 |
| Testing | 4 |
| Database | 6 |
| DevOps | 8 |
| Engineering Roles | 4 |
| Debugging | 3 |
| Teaching | 6 |
| Memory | 6 |
| Optimization | 3 |
| Analysis | 5 |
| Documentation | 6 |
| Project Management | 3 |
| UX/Observability | 5 |
| Self-Improvement | 6 |
| **Total** | **111** |

