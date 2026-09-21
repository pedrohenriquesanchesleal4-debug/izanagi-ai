# Canvas Orchestration — Guia de Uso

> Orquestração visual de multi-agentes sobre o runtime real do Izanagi.
> O `.canvas` (JSON Canvas 1.0 + namespace `izanagi`) é a camada de CONTROLE:
> a execução é sempre do runtime, nunca do arquivo.

## O que é

Um workflow declarativo em JSON: nós (agentes, orquestrador, avaliador, tool,
condition, parallel, input/output...) e arestas (com tipo de mensagem e
condição de roteamento). É LEÍVEL por humanos, versionável e compatível com
apps que respeitam o spec JSON Canvas 1.0 (campos desconhecidos são
preservados).

## Como entrar e usar

```
npm run build                          # 1º sempre (bin/izanagi.js usa dist/)

# Criar um workflow novo a partir de template:
node bin/izanagi.js canvas create meu-projeto

# Validar (zero execução):
node bin/izanagi.js canvas validate canvases/example-architecture.canvas

# Inspecionar (DAG, entradas/saídas, capacidades):
node bin/izanagi.js canvas inspect canvases/example-architecture.canvas

# Executar (sem provider configurado = headless, simula conteúdo dos nós):
node bin/izanagi.js canvas run canvases/example-architecture.canvas

# Executar o workflow de exemplo com producers reais:
node bin/izanagi.js canvas run canvases/example-architecture.canvas --task "Sistema SaaS com checkout"

# Planejar SEM executar (DAG + modelos por nó + orçamento):
node bin/izanagi.js canvas dry-run canvases/example-architecture.canvas

# Executar trecho do workflow:
node bin/izanagi.js canvas run arquivo.canvas --from-node architect --until-node qa

# Exportar com auto-layout:
node bin/izanagi.js canvas export arquivo.canvas --layout horizontal

# Ver o trace de um run:
node bin/izanagi.js canvas trace <run-id>
```

## Ver o orquestrador funcionando AO VIVO (editor visual)

```
npm run build
node bin/izanagi.js canvas ui --port 4322
# abre http://localhost:4322 no navegador
```

No editor:

1. Abra `example-architecture` (ou crie um novo).
2. Clique **Run**. O workflow executa CONTRA O RUNTIME: cada nó muda de cor
   conforme o evento real (`node.started` azul pulsante, `node.completed`
   verde, `node.failed` vermelho, retry âmbar).
3. Arestas com `izanagi.messageType` **animam** no envio: a mensagem
   agente-a-agente é um fato do message bus, não uma decoração.
4. Painel **Mensagens** mostra o tráfego A2A em tempo real (SSE do servidor);
   selecione um nó para ver modelo resolvido (auto/manual/inherit), latência,
   tokens, tentativas e resumo do artefato.
5. Pausa/resume respeitam `human-review`/aprovação; stop aborta o run de fato.
6. O **dry-run** no editor mostra o plano (batches paralelos + modelos) sem
   chamar modelo nenhum.

Tudo o que o editor exibe veio de eventos reais do runtime: não há estado
fabricado. Fechou o navegador? `node bin/izanagi.js canvas trace <run-id>`
replaya a timeline do run na CLI.

## API programática

```ts
import { CanvasWorkflow, executeWorkflow } from 'izanagi-ai';

const wf = await CanvasWorkflow.load('./workflow.canvas');
const result = await executeWorkflow(wf, {
  task: 'Sistema SaaS com checkout',
  dryRun: false,            // ou true para planejar sem executar
  budget: 60_000,           // teto de tokens
  onWorkflowEvent: (e) => console.log(e.type, e),  // timeline ao vivo
});
console.log(result.status, result.score, result.metrics);
// SDK:
await izanagi.orchestrate({ workflow: './workflow.canvas', input: { ... } });
```

## Regras de segurança

- O canvas NUNCA carrega segredos/API keys: só ids de agentes, skills e
  provider/model. Chaves vivem em env/config como em qualquer run.
- Condições de aresta usam gramática sandboxed: `result.score >= 0.8`,
  `state.status == 'succeeded'` — sem `eval`/JS arbitrário.
- Loop exige `maxIterations` + timeout; condição de término avalia o estado
  REAL acumulado (nunca um contador estético).
- Contratos de tool/permissão são declarados no canvas e aplicados pelo runtime.