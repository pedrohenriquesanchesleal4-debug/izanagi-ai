# Runtime: trabalho pendente

> Estado em **v3.16.0** (2026-09-02). Handoff vivo da rearquitetura do runtime: o que **ainda falta**, por que falta, e o que exatamente precisa ser feito para fechar.
>
> Regra deste arquivo: só entra o que é gap **verificado no código**. Nada aqui é aspiracional sem lastro. Ao fechar um item, remover daqui **e** atualizar `ROADMAP.md` na mesma mudança.

---

## Estado

Os dezoito itens da lista original foram fechados (tabela no fim). **Resta um**, e ele não é técnico: é uma decisão de produto que muda a natureza do Izanagi.

---

## ⏸ 1. Local-first ou serviço hospedado (decisão pendente)

**O que está em jogo:** modo daemon, execução por cron, e integração com canais (Slack, Telegram, webhooks). Todos os três dependem da mesma escolha: o Izanagi continua sendo uma **CLI local-first** que roda quando alguém invoca, ou vira um **serviço** que fica de pé recebendo trabalho?

**Por que não é uma decisão técnica:** cada caminho é implementável, e cada um custa coisas diferentes.

*Local-first* mantém a propriedade que sustenta o resto da arquitetura: o runtime roda na máquina de quem o usa, com as chaves de quem o usa, sem estado compartilhado. Sandbox, trust tier e Policy Engine foram desenhados nesse pressuposto. Custo: nada acontece sem alguém invocar.

*Serviço* destrava trabalho agendado, notificação, e uso por quem não abre um terminal. Custo: passa a existir um processo de longa duração com credenciais em repouso, autenticação, isolamento entre usuários, e uma superfície de ataque que hoje não existe. As decisões de segurança tomadas até aqui teriam que ser revisitadas, não estendidas.

**Decisão já registrada como pendente** na Fase 4 do `ROADMAP.md` (histórico multi-dispositivo). É a mesma escolha, e ela precisa ser feita **uma vez**, explicitamente, antes de qualquer linha de código nessa direção.

**O que destravaria:** uma resposta a "o Izanagi deve ficar de pé sozinho?". Se sim, o primeiro passo não é o daemon: é o modelo de autenticação e de isolamento entre execuções.

---

## Limitações conhecidas que NÃO são gaps

Coisas que alguém pode confundir com dívida ao ler o código. São escolhas, e o motivo está registrado.

- **Rede não é isolada na sandbox de código.** O Permission Model do Node não cobre rede: um script executado por `code.execute` pode fazer requisição de saída. Existe um teste que MEDE isso e quebra se o comportamento mudar. A mitigação é a permissão `shell` no contrato, que a `PolicyEngine` nega a trust tier `generated` e `community`. Isolar rede de verdade exige container ou firewall de processo — outra ordem de dependência.
- **Templates do Planner não geram nós de tool.** O caminho `kind: 'tool'` existe, é seguro e testado; quem monta grafo com tool é o SDK ou uma decomposição externa. Colocar tool nos templates exige saber QUAL tool cada workflow precisa, e isso depende do projeto.
- **Decomposição por LLM no planejamento não tem caller.** `Commander.plan({ decompose })` aceita decomposição externa, mas nem CLI nem SDK injetam uma. O planejamento em produção é template + heurística, e é determinístico por isso: planejar não gasta token. (Decomposição em EXECUÇÃO é outra coisa e existe — ver `orchestration/subgraph.ts`.)
- **Token Benchmark mede plano, não execução.** Continua separado de propósito. Consumo real sai de `izanagi budget <run-id>` ou de `izanagi benchmark run --execute`.
- **Cache de validação economiza CPU, não token.** Nenhuma chamada de modelo é evitada, e por isso não aparece na telemetria de economia.
- **Estatística por domínio depende de volume.** `agentStats(agent, domain)` só decide com amostra mínima no domínio; abaixo disso vale o agregado global.
- **A medição de compressão não avalia qualidade.** Mede razão de tamanho, não se o que sobrou é o que importava. Avaliar isso exigiria gabarito anotado, e é por isso que a reavaliação de compressão neural fica condicionada a essa medida existir.
- **Sub-orquestração só é oferecida a papel `commander` em modo `autonomous`.** Não é limitação técnica: é onde o planejamento tem mais chance de subestimar escopo e onde o orçamento comporta a divisão.

---

## Fechados

| Item original | Fechado em | Como |
|---|---|---|
| 🔴 1. Degradação registrada mas nunca aplicada | `8a5d04c` | Cada degrau muda a execução: contexto pela metade, saída a 60%, `demoteRole`, concorrência dividida, opcionais cortadas, pausa por aprovação. Limiar por degrau e pressão pela maior razão **por fase**. |
| 🔴 2. Artefato sem content store | `8a5d04c` | Conteúdo em `.izanagi/state/artifacts/<runId>/`, com `contentRef`, teto de 512KB e truncamento declarado. |
| 🔴 3. Paralelismo sem teto de concorrência | `8a5d04c` | Pool com ordem preservada e falha isolada, default 3, reduzido pela degradação. |
| 🟡 4. Protocolo A2A e crítica sem caller | `c108699` | `interpretCritique`: crítica bloqueante reprova o nó criticado com correção mínima. `ConversationLog` por referência de artefato. `critique` virou ArtifactKind com formato obrigatório. |
| 🟡 5. Juiz semântico não injetado | `e977b7a` | `verification/judge.ts` no papel `worker`. Saída ilegível vira `inconclusive`, nunca reprovação. `--no-judge` desliga. |
| 🟡 6. Replan não passa pelo Commander | `e803837` | `Commander.replan`: troca agente → sobe papel → quebra em duas. Só o delta da falha; `changes` vazio quando não há alternativa. |
| 🟡 7. Memória não informa o planejamento | `96714ff` | Padrão de falha sobe o modo um degrau; agente com histórico ruim sai da disputa; consulta no Decision Journal. |
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
| 🔵 18. FTS5 e compressão neural | `4490dbf` | `izanagi benchmark memory` mede e aplica limiar declarado: busca p95 2.0ms sobre 296KB (FTS5 não se paga), compressão a 8.3% do original (neural não se justifica pelo tamanho). Bug encontrado pela medição: a busca tinha recall truncado em 4000 chars por arquivo. |
