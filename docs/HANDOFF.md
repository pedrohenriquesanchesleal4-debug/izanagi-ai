# Handoff: rearquitetura do runtime (v3.13.0 → v3.18.0)

> Escrito em 2026-09-02. Documento de passagem: o que mudou, onde cada coisa vive, o que foi decidido e por quê, o que sobrou. Feito para quem abrir o repositório sem ter acompanhado a sessão.
>
> Regra deste arquivo, herdada do `RUNTIME-PENDING.md`: **só entra o que é verificável no código**. Onde há número, ele foi medido. Onde não há, está dito que não há.

---

## 1. O que era e o que ficou

A v3.13.0 entregou as peças da rearquitetura (Commander, Task Contracts, roteamento por papel, verificação por evidência) e deixou registrado, com honestidade, que várias delas **existiam e não tinham caller**. Este handoff cobre o fechamento disso.

| | v3.13.0 | v3.18.0 |
|---|---|---|
| Crítica adversarial | Produzia texto que ninguém lia | Reprova o nó criticado, com correção mínima e reverificação |
| Protocolo A2A | Testado, sem caller | `ConversationLog` do run, por referência de artefato |
| Juiz semântico | Injetável, nunca injetado | Ligado por default (papel `worker`), `--no-judge` desliga |
| Replanejamento | Mesmo grafo com um nó reaberto | Plano B: troca agente → sobe papel → quebra a tarefa |
| Memória | Só no roteamento de skills | Informa modo e escolha de agente no planejamento |
| Skills | Uma chain para o run inteiro | Ranking por tarefa (teto 3) |
| Degradação de orçamento | Registrada, não aplicada | Cada degrau muda a execução |
| Artefato | Metadado em disco, conteúdo em RAM | Content store com `contentRef` e truncamento declarado |
| Paralelismo | `Promise.all` sem limite | Pool com teto configurável |
| Policy Engine | Fora do caminho de `run` | Nó `kind: 'tool'` com permissão, trust tier e sandbox |
| Execução de código | Inexistente (bloqueada por isolamento) | Processo isolado com Permission Model |
| Grafo | Plano | Sub-orquestração com teto de profundidade e orçamento dividido |
| Sucesso repetido | Virava estatística | Vira skill procedural por recorrência |
| Headless (sem API key) | Terminava `FAIL` sempre | `PASS` com verificação real |
| Uso agendado | Impossível | `--json` + exit code + webhook |
| Conhecimento do projeto | Nenhum: o agente escrevia sobre um repositório que nunca viu | Nó `survey` na cabeça do grafo, determinístico e com corte declarado |
| Resultado do run | Ficava em `.izanagi/state/`, invisível para o projeto | Nó `deliver` grava no projeto, e a verificação confere o arquivo escrito |
| Caminho seguro de tool | Existia, testado, sem ninguém passando por ele | Dois nós de tool gerados pelo planejamento, em todo run comum |

### Fluxo hoje

```
usuário ──> Commander (classifica · consulta memória · escolhe modo)
                │
                ├─ contratos por tarefa, com skills do próprio objetivo
                ▼
            Task Graph ──> pool com teto de concorrência
                │
                ├─ [survey]  tool · fs:read · 0 token · lê o projeto de verdade
                │
                ├─ nó de agente  ──> modelo do papel (commander/specialist/worker)
                └─ nó de tool    ──> ToolRegistry ─> PolicyEngine ─> sandbox
                │
                ├─ pediu decomposição? ──> subgrafo (orçamento do pai DIVIDIDO)
                ▼
            Verificação (determinística · evidência · juiz semântico)
                │
        ┌───────┴────────┐
     VERIFIED          FAILED ──> healing ──> Commander.replan (Plano B)
        │
        ├─ crítica bloqueante? ──> reprova o criticado + correção mínima
        ▼
    [deliver]  tool · fs:write · 0 token · grava a entrega; file-exists confere
        │
    trajetória registrada ──> 3ª recorrência verificada ──> skill procedural

  em volta: orçamento com degradação real · ConversationLog A2A · trace · cache
```

---

## 2. Onde cada coisa vive

Arquivos criados nesta rodada, com a responsabilidade de cada um:

| Arquivo | Responsabilidade |
|---|---|
| `runtime/protocol/conversation.ts` | Log A2A do run. Mensagem carrega referência de artefato e resumo de 240 chars, nunca conteúdo |
| `runtime/verification/judge.ts` | Juiz semântico apoiado em modelo. Saída ilegível vira `inconclusive`, nunca reprovação |
| `runtime/orchestration/subgraph.ts` | Decomposição em execução: parsing, construção do subgrafo, agregação |
| `runtime/tools/code-sandbox.ts` | Processo isolado com Permission Model do Node |
| `runtime/evolution/trajectories.ts` | Assinatura de caminho, barra de recorrência, corpo da skill procedural |
| `runtime/benchmarks/arena.ts` | Métricas de execução real: verificação, recuperação, retries, custo |
| `runtime/benchmarks/memory-benchmark.ts` | Medição de busca e compressão, com limiar declarado |
| `runtime/notify/webhook.ts` | Notificação de fim de run, payload de metadado, exit code |
| `runtime/tools/project-survey.ts` | Varredura determinística do projeto: stack, manifestos, árvore por extensão. Teto de profundidade e de entradas, corte declarado |
| `runtime/tools/input-refs.ts` | Marcadores `$artifact`/`$deliverable` no input de tool. `code.execute` recusa marcador (injeção) |
| `runtime/orchestration/grounding.ts` | Nó `survey` na cabeça do grafo; só as RAÍZES dependem dele |
| `runtime/orchestration/delivery.ts` | Nó `deliver` no fim: documento único, destino validado, comprovante de escrita verificado |

Arquivos que mudaram de comportamento e valem uma leitura antes de mexer:

- `runtime/orchestrator.ts` — ganhou `interpretCritique`, `executeTool`, `runSubgraph`, `recordTrajectory`. É o arquivo mais denso do runtime.
- `runtime/orchestration/commander.ts` — `replan`, memória no planejamento, skills por tarefa, marcação de decomponível.
- `runtime/orchestration/context-resolver.ts` — correção dirigida, contrato de saída de crítica, protocolo de decomposição.
- `runtime/memory/store.ts` — stats por domínio, trajetórias, e a correção do recall da busca.
- `runtime/tools/registry.ts` — `code.execute` e `execute()` assíncrono.

---

## 3. Bugs reais encontrados

Nenhum destes foi procurado: todos apareceram escrevendo o teste da feature ao lado. Estão aqui porque cada um vale mais que a feature que o revelou.

| Bug | Por que importava |
|---|---|
| **Busca de memória com recall truncado** | `search()` operava sobre o conteúdo já cortado em 4000 chars. Tudo que o projeto aprendia depois das primeiras páginas era invisível. Busca lenta se percebe; busca cega, não. Depois do conserto: 296KB alcançáveis contra 16KB, mesma latência |
| **Caminho relativo escapava da sandbox** | `ensureInside` resolvia contra o **cwd do processo**, não contra a zona declarada. `fs.write` com `"saida.txt"` gravava no diretório de onde o izanagi foi invocado |
| **Sandbox concedia `os.tmpdir()` inteiro** | O diretório de trabalho vive lá dentro, então qualquer temp de terceiro ficava legível pelo script |
| **`toText` devolvia `undefined`** | `JSON.stringify(undefined)` não é string. Validar retorno vazio de tool estourava em vez de reprovar o artefato |
| **Timeout da sandbox resolvia cedo** | A Promise resolvia antes do processo morrer: handle aberto, EPERM na limpeza no Windows, resíduo acumulando |
| **Verificação reprovada abortava na 1ª tentativa** | `classifyFailure` não reconhecia "verificação", então critério não comprovado caía no ramo genérico em vez do caminho de cura de validação |
| **`minSize: 60` reprovava crítica que aprova** | `{"status":"approved","issues":[]}` tem 33 chars |
| **Recomendação de crítica nunca aparecia** | Testava `ctx.artifacts.has('critique')` — `critique` é o *kind*, a chave do mapa é o id do nó (`critic`) |
| **Tabela de economia do dashboard** | Referenciava `costUsd`/`degradations`; os campos reais são `estimatedCostUsd`/`degradationsApplied`. Metade sairia vazia |
| **Sandbox de tool resolvia contra a raiz do FRAMEWORK** | `baseDir` é `<projeto>/.agents`, ou a instalação do pacote — não o projeto. Um nó `fs.read` lia dentro de `.agents/`, e `file-exists` procurava o arquivo no lugar errado. Rodando de dentro do checkout do framework as duas coincidem, e é por isso que nenhum teste pegou |
| **Estado de projeto morava na instalação do framework** | Mesma confusão de raiz, outro efeito: sem `izanagi init`, trace, artefato COM CONTEÚDO, memória e checkpoint iam para `node_modules/izanagi-ai/`, compartilhados entre todos esses projetos. `izanagi trace` listava execução alheia e `npm update` apagava o histórico. Encontrado procurando o trace de um run de teste e achando 300 de outros projetos |
| **Nó falho sem artefato era invisível para a avaliação** | `correctness` é a média das verificações registradas, `artifactValidity` a razão dos artefatos existentes: as duas ignoram quem não produziu nada. Um nó abortado por permissão negada deixava o run terminar `PASS` com score 0.98. Duas fixtures de teste estavam verdes exatamente por isso |
| **A telemetria de custo mentia para baixo** | `spend()` é chamado DEPOIS da resposta do modelo, mas recusava sem registrar ao estourar o teto: a chamada que estourou sumia da conta por ter estourado. Medido: $0.0010 reportados de $0.0510 gastos |
| **O teto de avaliação não limitava nada** | O resultado do gasto do juiz semântico era ignorado, então com a fase `evaluation` esgotada cada nó seguinte continuava chamando o juiz |
| **`budgetLimits.maxTokens` era descartado em silêncio** | Custo, tempo, agentes, retries e tool calls do mesmo objeto eram honrados; só o teto de tokens era substituído pelo do plano, sem erro nem aviso |
| **A memória contava retentativa como recorrência** | Um incidente com três retries virava "3 ocorrências" do padrão. A memória passava a medir teimosia do runtime, e recorrência é justamente o que decide se um padrão vira conhecimento |
| **Decompor podia AUMENTAR o orçamento** | O piso de 512 tokens por sub-tarefa, sem teto de largura, fazia 5 sub-tarefas de um pai com 2000 somarem 2560 — quebrando a regra que o piso servia |
| **A telemetria afirmava paralelismo cortado** | O tamanho do batch era contado antes do teto de concorrência: pool de 1 reportava "paralelo 5", justamente sob a degradação que reduz paralelismo |
| **O cache guardava resposta reprovada** | Na retentativa ela não voltava (a correção muda a chave), mas o run seguinte com o mesmo objetivo recomeçava do que já se sabia ruim, deterministicamente |
| **Groundedness reprovava documento correto** | Resolver referência só contra a raiz do repo dava 0 de 17 caminhos fundamentados no `docs/HANDOFF.md` deste projeto: ele cita `runtime/x.ts`, que existe em `src/runtime/x.ts` |
| **Replan apagaria o contrato de um nó de tool** | `contractFor` por cima de contrato de tool removeria `tool` e `permissions`: o nó viraria chamada de modelo com o mesmo id, e a "correção" seria a regressão |

---

## 4. Decisões que valem conhecer antes de mexer

Cada uma foi tomada com um motivo, e mudá-las sem esse motivo em mente vai quebrar algo que hoje funciona.

**Uma raiz, uma pergunta.** `baseDir` responde "de onde leio agentes e
skills?", `workspaceDir` "qual é o projeto de trabalho?", `stateDir` "onde vive
o estado deste projeto?". Rodando de dentro do checkout do framework as três
coincidem — que é como a confusão sobreviveu tanto tempo e produziu dois bugs
diferentes. Ambos os campos novos têm default `baseDir`, então nenhum caller
existente mudou de comportamento.

**Número que se reporta é número que aconteceu.** Gasto recusado por teto ainda
é gasto: registrar depois de ter acontecido é o que mantém a telemetria igual à
fatura. Paralelismo contado é o executado, não o pedido. Recorrência conta
incidentes, não retentativas. Métrica sem medida aparece como ausente, nunca
como zero.

**Ausência não é aprovação.** Juiz que não respondeu devolve `inconclusive`, não reprovação nem aprovação. Métrica sem execução aparece como ausente, nunca como `0%`. Artefato sem validade avaliada é `valid: false`, não `true` por conveniência de tipo. Recall truncado era exatamente a violação disso.

**Toda autonomia tem teto do runtime, não do agente.** Crítica reabre um nó UMA vez. Sub-tarefa não decompõe. Profundidade de orquestração é do `Orchestrator`. Recursão decidida por quem está dentro dela não termina.

**Decompor não libera orçamento.** O subgrafo divide o teto do pai, com piso de 512 por sub-tarefa. Sem isso, pedir decomposição vira a saída mais barata para qualquer agente.

**Confiança vem da origem, não da declaração.** Trust tier sai do diretório de onde o agente foi lido (`agents/generated/` → generated, `.agents/` → community, resto → builtin). Um agente não declara o próprio tier. Agente desconhecido é `community`, o mais restritivo.

**Isolamento é do runtime, não de varredura de string.** A sandbox usa o Permission Model do Node. Varrer `import` no código seria evasível e daria falsa segurança.

**Metadado sai, conteúdo fica.** O webhook leva status, tokens, custo e nomes de artefato. Nunca o que os agentes produziram — endpoint de notificação costuma ser canal de equipe ou serviço não auditado.

**A barra para virar conhecimento é recorrência.** Trajetória só vira skill na 3ª execução verificada. Sintetizar a cada sucesso produziria skills genéricas competindo com as boas no ranking.

**Medir antes de trocar.** FTS5 e compressão neural têm limiar declarado no código. `izanagi benchmark memory` aplica o limiar ao número medido e diz o que ele sustenta.

---

## 5. Números medidos

Reproduzíveis neste repositório, hoje:

```
izanagi benchmark memory
  busca textual:   p95 2.0ms sobre 296KB   → abaixo do teto de 25ms
  compressão:      48000 → 3993 chars (8.3%) → abaixo do alvo de 35%

izanagi benchmark run architecture --execute
  Arena: verificação 100% · retries 0 · tokens 3360 · 42ms

izanagi run "..." --mode autonomous          (headless, sem API key)
  antes: FAIL, 3 tentativas, abort
  agora: PASS, 4/4 VERIFIED, 10 mensagens A2A

izanagi run "..." --json
  JSON único no stdout · stderr vazio · exit 0

izanagi run "adicionar paginacao em GET /users" --output docs   (projeto Node de fixture)
  grafo: [survey] -> [execute] -> [verify] -> [evaluation] -> [deliver]
  5/5 VERIFIED · survey detectou name/version/scripts reais e a stack por contagem
  entrega gravada e conferida por file-exists sobre o arquivo que a tool escreveu
```

Testes: **674, todos passando no Linux**. O vermelho é `polyglot: bin Rust presente com --version barato`, que escreve um binário falso com shebang bash e tenta executá-lo — não roda no Windows. É anterior a esta rodada e independente dela.

---

## 6. O que NÃO foi feito, e por quê

Nada aqui está aberto por falta de tempo. Está aberto por escolha, e a escolha tem motivo.

**Rede não é isolada na sandbox.** O Permission Model do Node não cobre rede: medi, `fetch` funciona com `--permission` ligado. Existe um teste que registra esse limite e **quebra se o comportamento mudar** — limite testado é um limite; limite só documentado é esperança. Mitigação: `code.execute` exige permissão `shell`, que a política nega a `generated` e `community`. Isolar de verdade exige container ou firewall de processo.

**Templates do Planner não geram nós de tool.** O caminho existe, é seguro e testado. Colocar tool nos templates exige saber qual tool cada workflow precisa, e isso depende do projeto de quem usa.

**Decomposição por LLM no planejamento não tem caller.** `Commander.plan({ decompose })` aceita, mas nem CLI nem SDK injetam. O planejamento em produção é template + heurística, e é determinístico por isso: planejar não gasta token. (Decomposição em **execução** é outra coisa e existe.)

**Token Benchmark mede plano, não execução.** Separado de propósito. Consumo real sai de `izanagi budget <run-id>` ou de `benchmark run --execute`. Os dois números nunca dividem o mesmo campo.

**A medição de compressão não avalia qualidade.** Mede razão de tamanho, não se o que sobrou era o que importava. Isso exigiria gabarito anotado, e é por isso que a reavaliação de compressão neural fica condicionada a essa medida existir.

**Sem daemon, porta ou credencial em repouso.** Decisão de produto tomada nesta rodada: local-first. Receber comando de fora exigiria autenticação, isolamento entre execuções e credenciais paradas — e as decisões de segurança já tomadas precisariam ser revisitadas, não estendidas.

---

## 7. Por onde continuar

Em ordem de valor por esforço, com o critério de pronto de cada um.

**0. Medir o grounding contra a ausência dele.** A v3.18.0 pôs o survey no
caminho por um argumento (agente que nunca viu o projeto inventa stack e
caminho), não por um número. **O instrumento já existe**: `izanagi run`
reporta `Fundamentação X% (n/m)` — dos caminhos que os artefatos citaram,
quantos existem no projeto. (Nos casos embutidos do benchmark ele sai `n/a` de
propósito: são tarefas sintéticas que não falam do projeto onde o comando roda,
e medi-las contra ele daria um número que parece significativo e não é.) O que falta é o provider real e o par:
mesmo objetivo, mesmo provider, uma execução com `--survey` e outra com
`--no-survey`. *Pronto quando:* houver dois relatórios em
`.izanagi/state/benchmarks/` com a fundamentação medida nos dois e a diferença
registrada.

**1. Rodar a Arena contra um provider real.** Tudo que existe hoje foi exercitado headless ou com producer de teste. `izanagi benchmark run --execute` com uma API key configurada produziria os primeiros números de verificação e recuperação sobre execução de verdade. *Pronto quando:* existir um relatório salvo em `.izanagi/state/benchmarks/` com `execution.verificationRate` vindo de chamadas reais, e um segundo relatório para comparar.

**2. Exercitar o critique loop com modelo real.** O parsing é tolerante e testado, mas nenhum modelo de verdade produziu uma crítica ainda. É onde o formato costuma quebrar. *Pronto quando:* um run `--mode autonomous` com provider real registrar uma correção dirigida no `izanagi explain --conversation`.

**~~3. Primeiro nó de tool num template.~~** Fechado na v3.18.0, e não como o
item previa. A ideia original era um nó de verificação rodando o teste do
projeto via `code.execute` — mas a sandbox bloqueia subprocessos de propósito,
então `code.execute` não roda `npm test`, e forçar isso significaria afrouxar o
isolamento para caber num item de roadmap. O que fechou o item foi outra coisa,
e melhor: o nó `deliver` grava a entrega e a verificação confere o arquivo
escrito, e o nó `survey` lê o projeto antes de qualquer decisão. A frase do item
("em vez de um critério `file-exists`") estava certa pelo motivo errado: o
problema nunca foi o `file-exists`, foi conferir arquivo que ninguém escreveu.

**~~4. Cache de resultado de tool.~~** Avaliado na v3.18.0 e recusado com
motivo: nenhuma tool builtin é função pura da entrada. `fs.read`, `fs.ls` e
`project.survey` dependem do disco, que é mutável; `fs.write` e `code.execute`
têm efeito colateral, e cachear um write significaria não escrever. Um cache
correto para as de leitura precisaria de `mtime`+`size` na chave, e o `stat`
custa quase o que a leitura pequena que ele evitaria custaria. Está em
`RUNTIME-PENDING.md` como decisão medida, não como pendência.

**5. Estatística por domínio com volume real.** `agentStats(agent, domain)` já existe mas só decide com amostra mínima. Precisa de runs acumulados para significar algo.

**Não faça sem um caso concreto:** aumentar `maxOrchestrationDepth` além de 2, afrouxar a barra de recorrência da síntese de skills, ou permitir que sub-tarefa decomponha. Os três parecem melhorias e são as três formas conhecidas de transformar isto numa colmeia.

---

## 8. Verificação rápida

Para quem pegar o repositório e quiser confirmar que está tudo de pé:

```bash
npm ci
npm run build
node --test "dist/runtime/tests/*.test.js"     # 674 testes (no Linux, todos verdes; 1 vermelho conhecido no Windows: polyglot)

izanagi benchmark memory                        # medição de busca e compressão
izanagi run "auditar a segurança da API" --mode orchestrated --json
echo $?                                         # 0 concluiu · 1 falhou · 2 aguarda aprovação
izanagi explain <run-id> --conversation         # quem falou com quem
izanagi budget <run-id>                         # para onde foi o orçamento
```

---

## 9. Documentos irmãos

| Arquivo | O que responde |
|---|---|
| [`RUNTIME-PENDING.md`](RUNTIME-PENDING.md) | O que ainda falta (nada aberto) e o que é escolha com motivo registrado |
| [`../ROADMAP.md`](../ROADMAP.md) | Fases 8 a 12, com o entregue e as limitações de cada uma |
| [`../CHANGELOG.md`](../CHANGELOG.md) | Mudança por versão, com Compatibility e breaking changes |
| [`../SYSTEM.md`](../SYSTEM.md) | Engines internas, quality gates, arquitetura de memória |
| [`../ARCHITECTURE.md`](../ARCHITECTURE.md) | Topologia e decisões estruturais |
