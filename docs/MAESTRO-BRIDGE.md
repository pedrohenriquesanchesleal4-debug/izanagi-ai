# MAESTRO BRIDGE: Integration Spec (v1)

> Coordenador: Izanagi Orchestrator · Data: 2026-09-22
> Escopo: substituir o subsistema Canvas por ponte para RunMaestro (runmaestro.ai).
> Usuário decidiu: remover canvas por completo; gerar specs E despachar; seletor de provider interativo no init (máquina sem Claude).

## 1. Decisão (ADR-lite, registro em `.agents/memoria/decisoes.md`)

- O framework para de orquestrar execução visual própria (canvas removido).
- Izanagi vira PLANEJADOR + TRADUTOR: `Commander().plan()` gera o grafo; `izanagi maestro export` converte grafo em Auto Run docs do Maestro; `izanagi maestro run|goal` despacha via `maestro-cli`.
- Maestro é o EXECUTOR (desktop app + CLI headless). Fonte canônica do workflow deixa de ser `.canvas` e vira objetivo + plano Commander.
- Providers alvo: claude-code (default) | codex | opencode | copilot-cli | factory-droid | hermes | pi | qwen3-coder | omp. Opencode é o CLI desta máquina; claude-code NÃO instalado (usuário não tem Claude).

## 2. Fatos Maestro (verificados em docs, CLI 0.17.4 local)

- CLI: `maestro-cli` (bundled com desktop app; nesta máquina: `C:\Users\pedro.leal\.local\bin\maestro-cli.cmd`). App desktop precisa rodando (exit 3 = app inacessível).
- `maestro-cli create-agent "<nome>" -d <cwd> -t <type> [--auto-run-folder <path>] [--json]` → cria agente. Requer app rodando.
- `maestro-cli run-doc <doc...> --agent <id|nome> [--model M] [--effort E] [--ignore-model-hints] [--loop] [--max-loops N] [--reset-on-completion] [--json] [--prompt T]` → executa docs Auto Run (headless).
- `maestro-cli auto-run <docs...> -a <id> [-p T] [--save-as <nome>] [--launch] [--loop] [--max-loops] [--reset-on-completion] [--worktree] [--create-pr] [--model] [--effort] [--ignore-model-hints]` → roda e/ou salva playbook.
- `maestro-cli goal-run <agent-id> "<objetivo>" [--exit-criteria T] [--max-iterations N] [--visible] [--wait] [--json] [--model] [--effort]` → modo Goal-Driven (sem doc/checkbox).
- `maestro-cli playbook <playbook-id> [--dry-run] [--no-history] [--wait] [--model] [--effort] [--ignore-model-hints] [--json]` → roda playbook salvo.
- `maestro-cli list agents|playbooks [-a] · show playbook <id> · remove-playbook <agent-id> <playbook-id>`.
- Exit codes: 0 ok · 1 generic · 2 usage · 3 app desktop não rodando · 4 app velho · 5 timeout.
- Eventos JSONL (stream de `--json`): `start` (playbook), `document_start` (document, taskCount), `task_start` (taskIndex), `task_complete` (success, summary, elapsedMs, usageStats), `document_complete` (document, tasksCompleted), `loop_complete` (iteration, tasksCompleted, elapsedMs), `complete` (success, totalTasksCompleted, totalElapsedMs, totalCost). Extras: `document_gated` (HITL em headless), `document_stalled` (reason, tasks restantes), `halt` (abort), `model_resolution` (tier ignorado). Goal: `goal_start`, `goal_iteration_start`, `goal_iteration_complete` (progress, rationale, complete, deadlock), `goal_complete` (success, exitReason, finalProgress, iterations).
- Default Auto Run folder do agente: `<cwd>/.maestro/playbooks`. Docs = `.md` com tasks `- [ ]`.
- Markers em docs:
  - `<!-- MAESTRO:MODEL tier="low|medium|high" effort="..." reason="..." -->` → override de modelo por documento/task. Run-scoped; respeita `--ignore-model-hints`.
  - `<!-- MAESTRO:HITL reason="..." artifact="..." -->` → aprovação humana; em headless vira `document_gated` e pula.
  - `<!-- maestro:halt: reason -->` → aborta run inteiro.
- NÃO existe `--parallel` no CLI: cada `run-doc` executa um doc num agente; paralelismo = N docs em N agents (desktop) ou N invocações CLI.
- Formato em disco do playbook salvo: não documentado publicamente (único schema público = `local-manifest.json`). Portanto: Izanagi MANDA docs `.md` direto na pasta do agente (`<cwd>/.maestro/playbooks/<slug>/`) e usa `--save-as` quando quiser virar playbook reutilizável. Nunca escrever `local-manifest.json` à mão.
- Env: run herda env do agente; docs NÃO setam env (sem `--env` per-run).

## 3. Arquitetura da ponte (arquivos novos, não tocar legado fora do contrato)

```
src/runtime/maestro/
  types.ts            // MaestroDoc, MaestroTask, RunEvent, GoalEvent, ProviderChannel
  export-plan.ts      // Commander ExecutionGraph → Auto Run docs (.md + markers)
  events.ts           // parse de stream JSONL → resumo (stalled/halt/gated/cost)
  cli.ts              // wrapper fino subprocesso maestro-cli (spawn, exit codes, stderr)
  init.ts             // detecção de providers instalados + create-agent interativo
src/cli/commands/maestro.ts  // subcomando `izanagi maestro ...` (dispatcher fino)
src/runtime/tests/maestro-*.test.ts  // unitários (SEM invocar maestro-cli real)
```

### 3.1 `export-plan.ts` — mapeamento Commander plan → Auto Run docs

Entrada: `ExecutionGraph` (de `new Commander().plan({ objective, mode, acceptance, ... })`).

Regras de mapeamento:
1. **Skip nós `kind: 'tool'`** (`survey`, `materialize`, `deliver`, `verify-tests`, qualquer `kind: 'tool'`): Maestro roda direto no repo real com o agente; esses nós são overhead do runtime Izanagi. NUNCA viram task.
2. **Skip nós `kind: 'gate'`**: idem (validação é responsabilidade do agente Maestro + markers HITL).
3. **`kind: 'approval'` → task com marker** `<!-- MAESTRO:HITL reason="aprovação humana" artifact="<outputs??>" -->`. reason vem do `metadata.reason` quando houver, senão default.
4. **`kind: 'agent' | 'skill' | 'validator' | 'evaluator' | 'aggregator' | 'parallel'` → task checkbox** `- [ ] <descrição>`. Descrição = melhor campo disponível: `node.metadata?.description ?? node.id`.
5. **Agrupamento**: uma doc por `parallelBatch` (posição no array = ordem). Doc 1 = fase 1, doc 2 = fase 2... Tasks dentro da doc seguem `node.dependencies` quando forem sequenciais dentro da mesma batch? NÃO: dentro de uma batch todos são paralelos por definição; Maestro executa checkboxes de cima pra baixo. Ordem = ordem do vetor `node.order` filtrado pela batch (preservar topo). Se dentro da batch houver dependência real entre dois nós, o Commander não os colocaria na mesma batch (batch = topo). Confiar no grafo.
6. **Marker MAESTRO:MODEL por task** (aplicado no checkbox, antes do texto):
   - tier = `tierForModelHint(node.model)` quando `node.model` existir: premium→`high`, balanced→`medium`, fast→`low` (mapear via `ModelRouter` se disponível; senão mapa local).
   - `effort`: omitir (provider-dependent; usuário pode passar `--effort` na CLI).
   - `reason`: agente do nó (`node.agent`) ou papel inferido.
7. **Doc header**: `# <slug-do-objetivo> - <nome da fase>` + 1 linha de contexto (objetivo truncado) + observação de que tasks marcadas `- [x]` = concluídas.
8. **Saída**: diretório `<out>/<slug>/` com `01-<fase>.md`, `02-<fase>.md`, ... Slug gerado do objetivo (slugify simples, mesmo padrão do `delivery.ts`/materialize: `slug = objetivo.toLowerCase().normalize('NFD').replace(...)`).

### 3.2 `events.ts` — parse JSONL

- `parseRunEvent(line: string): RunEvent | null` — linha JSON → evento tipado; linha inválida → null (tolerância).
- `summarizeRun(events: RunEvent[]): RunSummary` — agrega: `totalTasksCompleted`, `totalCost`, `stalled: {document, reason, remaining}[]`, `halted: boolean`, `gated: {document, reason}[]`, `success`, `iterationCount`. Stalled/halt param o fluxo (exit não-zero na prática).

### 3.3 `cli.ts` — wrapper maestro-cli

- `resolveMaestroCli(): string` — PATH lookup (`maestro-cli`, `maestro-cli.cmd`) + fallback `C:\Program Files\Maestro\resources\maestro-cli.js` (node `%ProgramFiles%\Maestro\resources\maestro-cli.js`). Não encontrou → erro claro: "Instale Maestro (runmaestro.ai) e garanta `maestro-cli` no PATH."
- `runMaestro(args: string[], opts): Promise<{ code, stdout, stderr }>` — spawn com `stdio` capturado, timeout; mapeia exit codes 0-5 para mensagens PT-BR (3 = "app desktop Maestro não está rodando").
- `streamMaestro(args, onEvent)` — para `--json`: lê stdout linha a linha, chama `onEvent(parseRunEvent(line))`, resolve no `complete`/`goal_complete`/exit.

### 3.4 `init.ts` — criação de agente interativa

- `detectProviders(): ProviderChannel[]` — checa executáveis no PATH: `claude` (claude-code), `codex`, `opencode`, `copilot`, `factory-droid`, `hermes`, `pi`, `qwen3-coder`, `omp`. Retorna só os instalados (com caminho).
- Fluxo interativo (`izanagi maestro init` sem flags):
  1. lista providers detectados (numerados) + opção "outro (digitar type)". Se máquina sem Claude, claude-code NÃO aparece (ou aparece marcado "não instalado", não selecionável).
  2. pede nome do agente (default: nome da pasta do workspace).
  3. `maestro-cli create-agent "<nome>" -d <workspaceDir> -t <type> --auto-run-folder <workspaceDir>/.maestro/playbooks --json`.
  4. imprime id do agente criado + próximo passo (`izanagi maestro plan ...`).
- Flags: `--name`, `--channel <type>` (pula interação), `--workspace <dir>` (default cwd).

### 3.5 `iziagi maestro` CLI — contrato de subcomandos

```
izanagi maestro init [--name N] [--channel TYPE] [--workspace DIR]     # cria agente Maestro
izanagi maestro plan "<objetivo>" [--mode M] [--acceptance A] [--out DIR]   # Commander → docs Auto Run
izanagi maestro run <doc...> --agent <id> [--model M] [--effort E] [--json] # roda doc gerado
izanagi maestro goal <agent-id> "<objetivo>" [--exit-criteria T] [--max-iterations N] [--json]
izanagi maestro list agents|playbooks [-a ID]                          # passthrough
izanagi maestro show playbook <id> | remove-playbook <agent> <id>      # passthrough
```

- `plan` default `--out`: `./.maestro/playbooks/<slug>/`.
- `run` aceita caminho de doc OU id de playbook (se `playbook:` prefix ou não existe `.md`, delega a `playbook <id>`).
- Help completo no `maestro.ts` (padrão dos demais comandos: texto ANSI + exemplo).

## 4. Contrato de integração com cli/index.ts (coordenação central)

- `src/cli/index.ts`: import `maestroCommand`; `case 'maestro': await maestroCommand(baseDir, rest, stateDir);`. Remover `case 'canvas'` + import (feito pelo agente A da remoção).
- `src/index.ts`: remover exports de `./runtime/canvas/*` (feito por A).
- `src/sdk.ts`: remover `executeWorkflow` + `orchestrate` (feito por A).
- `src/cli/commands/maestro.ts` + `src/runtime/maestro/*` + testes: arquivos NOVOS (feito por B, agente de implementação). NÃO tocar `cli/index.ts`/`index.ts`/`sdk.ts` (A faz).
- Help do framework (`src/cli/index.ts` linha ~246): trocar linha do canvas pela linha do maestro (A faz na remoção).

## 5. Remoção do Canvas (contrato do agente A)

Apagar (git rm ou remove file):
- `src/runtime/canvas/` inteiro (17 arquivos: api, condition, compiler, context-policy, diagnostics, editor-page, executor, layout, message-bus, model-capabilities, model-config, parser, scheduler, server, types, validate, workflow-events).
- `src/cli/commands/canvas.ts`.
- `src/runtime/tests/canvas-*.test.ts` (todos: api, compiler, executor, layout, parser, scheduler, + quaisquer outros `canvas-*.test.ts` no dir).
- `canvases/` (example-architecture.canvas, minha-feature.canvas e o dir inteiro).
- Edits: `src/cli/index.ts` (remover import + case + linha do help), `src/sdk.ts` (remover imports canvas + método `orchestrate`), `src/index.ts` (remover exports canvas).
- Limpar referências residuais "canvas" só onde forem imports mortos / menções de código (não reescrever docstrings alheias fora do tocado). Checar com grep após remoção: nenhum `from './runtime/canvas` / `runtime/canvas/` restante em `src/`.
- NÃO remover: `budget-cache.test.ts` (não é canvas), `src/runtime/dashboard/` (painel é outro subsistema), `model/router.ts` (ainda usado).
- Verificar: `npm run build` + `npm test` verdes (suite encolhe: canvas tests saem; esperado).

## 6. Verificação (gate de qualidade)

- `npm run build` sem erros.
- `npm test` verde (inclui novos `maestro-*.test.ts`).
- Testes unitários maestro cobrem: mapeamento (tool/gate skip, approval→HITL, batch→docs, tier map), slug, parse de eventos (task_complete/halt/stalled/gated/goal_complete), sumarização, detecção de providers (mock PATH), wrapper CLI (mock spawn, exit 3 mensagem).
- Testes NUNCA spawnam `maestro-cli` real (CI sem desktop app).
- Anti-slop: CLI ajuda em PT-BR, sem em-dash, sem checklist vazio (docs gerados têm tasks reais do grafo).
- `izanagi maestro plan "<objetivo>"` gera docs válidos (checkboxes + markers) em `.maestro/playbooks/<slug>/`.

## 7. Riscos

- App desktop Maestro precisa rodando p/ create-agent/run (exit 3). Mitigação: mensagem clara no wrapper.
- Formato playbook salvo não documentado: Izanagi não escreve manifest; usa docs `.md` direto + `--save-as` quando o usuário quiser.
- OpenCode sem reasoning-effort: `--effort` ignorado pelo provider (ok, pass-through).
- Provider sem tabela de tier (codex/copilot/opencode): Maestro emite `model_resolution` e usa modelo configurado do agente; docs gerados com MAESTRO:MODEL ainda funcionam como dica (respeitados conforme provider).