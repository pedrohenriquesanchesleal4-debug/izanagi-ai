# Arquitetura Poliglota do Izanagi AI — Referência Canônica

> Escopo: topologia, contratos de integração e procedimentos de build/verificação dos núcleos poliglotas (`crates/`, `go-services/`, `python-engine/`, `packages/`) e sua relação com o framework npm legado.
> Fontes: código real deste repositório + ADRs em `.agents/memoria/decisoes.md`. Nenhuma feature futura é descrita como existente; lacunas conhecidas estão marcadas como **Gap**.
> Última auditoria com execução local: 2026-08-23.

---

## Índice

1. [Visão geral e topologia](#1-visão-geral-e-topologia)
2. [Componentes por linguagem](#2-componentes-por-linguagem)
3. [Contratos de integração](#3-contratos-de-integração)
4. [Pipeline de execução da izanagi-next](#4-pipeline-de-execução-da-izanagi-next)
5. [Quality gates e anti-generacidade](#5-quality-gates-e-anti-generacidade)
6. [Skills v2 e Agents YAML](#6-skills-v2-e-agents-yaml)
7. [Build e verificação local](#7-build-e-verificação-local)
8. [CI e Release](#8-ci-e-release)
9. [Decisões arquiteturais (ADRs)](#9-decisões-arquiteturais-adrs)

---

## 1. Visão geral e topologia

O Izanagi AI vive em duas camadas que coexistem por estratégia **Strangler Fig** (ADR-001):

- **Legado npm** (`src/`, `core/`, `agents/`, `skills/`, CLI `izanagi` publicado como `izanagi-ai`): fonte canônica dos agentes e skills, intocado e publicável.
- **Topologia poliglota** (crescimento novo): um SDK TypeScript (`packages/sdk`) que ponteia quatro núcleos nativos — quality gate **Rust**, orquestrador de swarm **Go**, cliente MCP **Rust** e analisador semântico **Python** — consumidos pela CLI de nova geração (`packages/cli`, binário `izanagi-next`).

Não há npm workspaces na raiz nesta fase (decisão ADR-001: zero risco ao pacote publicado). O SDK importa-se por caminho relativo dentro de `packages/`; ambos os pacotes são `"private": true`.

### Topologia

```text
                        ┌──────────────────────────────────────────────────────┐
                        │              TypeScript (Node >= 22)                 │
                        │   packages/cli — @izanagi/cli-next                   │
                        │   binário: izanagi-next                              │
                        └───────────────────────────┬──────────────────────────┘
                                                    │ import relativo
                        ┌───────────────────────────▼──────────────────────────┐
                        │              packages/sdk — @izanagi/sdk             │
                        │  RustCoreClient · OrchestratorClient · McpClient ·   │
                        │  SemanticAnalyzer · loadSkillCatalog                 │
                        └──┬──────────────┬──────────────┬──────────────┬──────┘
           subprocess       │              │ UDS          │ subprocess    │ subprocess
           NDJSON stdin/out │   JSON-RPC   │ JSON-RPC     │ NDJSON stdio  │ CLI + JSON
                            │              │ + push event │               │
              ┌─────────────▼───┐   ┌──────▼─────────┐   ┌▼────────────┐ ┌▼─────────────────┐
              │ RUST            │   │ GO             │   │ RUST        │ │ PYTHON           │
              │ crates/         │   │ go-services/   │   │ crates/     │ │ python-engine/   │
              │ izanagi_core    │   │ swarm_         │   │ izanagi_mcp │ │ ast_analyzer     │
              │ bin: izanagi-   │   │ orchestrator   │   │ bin:        │ │                  │
              │      core       │   │                │   │ izanagi-mcp │ │                  │
              │ quality gate    │   │ pipeline       │   │ cliente MCP │ │ AST treesitter   │
              │ (7 heurísticas) │   │ architect →    │   │ JSON-RPC    │ │ + fallback       │
              │                 │   │ engineer → qa  │   │ stdio       │ │ estrutural       │
              │                 │   │ → security     │   │             │ │                  │
              └─────────────────┘   └────────────────┘   └─────────────┘ └──────────────────┘

  Catálogo de skills/agents (arquivos, não serviços):
    .skills/<name>/SKILL.md          formato v2 (106 módulos)   ← packages/skill-migrator
    .agents/agents/<slug>.yaml       derivação v2 (22 YAMLs)    ← packages/agent-migrator
    agents/*.json                    fonte canônica legado (22 agentes)
```

Fluxo típico de uma tarefa: a `izanagi-next` roteia skills pelo front-matter, compõe o payload, submete ao orquestrador Go pelo socket Unix e valida os artefatos produzidos com o gate Rust. O núcleo Python analisa código semanticamente (símbolos, complexidade, imports); o núcleo MCP descobre/invoça tools de servidores MCP externos.

---

## 2. Componentes por linguagem

| Caminho | Linguagem | Papel | Entrypoints | Testes |
|---|---|---|---|---|
| `crates/izanagi_core` | Rust | Quality Engine: validação estrutural estática de TS/Python/Go contra 7 heurísticas anti-slop | lib `izanagi_core::analyze`; binário `izanagi-core` (NDJSON stdin/stdout); bindings WASM sob feature `wasm` | `cargo test --workspace` (81 testes na verificação de 2026-08-23: 59 lib core + 7 lib mcp + 15 mock_server) |
| `crates/izanagi_mcp` | Rust | Cliente MCP: JSON-RPC 2.0 sobre stdio delimitado por newlines; ciclo spawn → handshake → request → teardown | binário `izanagi-mcp` (modos discovery e `call --tool=`) | inclusos no `cargo test --workspace` |
| `go-services/swarm_orchestrator` | Go 1.26 | Orquestrador de swarm: pipeline concorrente multi-estágio por canais, exposto via JSON-RPC 2.0 sobre Unix Domain Socket com push de eventos; wiring com Uber Fx | `main.go` → `app.Run()` | `go build ./... && go vet ./... && go test ./...` |
| `python-engine/ast_analyzer` | Python ≥3.10 | Analisador semântico multilíngue (py/ts/tsx/go): símbolos, complexidade ciclomática, imports, chunks para embedding | `python -m ast_analyzer analyze <path>`; console script `ast-analyzer` | `pytest tests/ -q` no `python-engine/` (70 passed na verificação) |
| `packages/sdk` | TypeScript | `@izanagi/sdk`: clientes tipados strict para os quatro núcleos + catálogo de skills. Zero dependências runtime | `composePipeline()` em `src/index.ts` | `npm test` (= tsc + `node --test dist/tests/*.test.js`; 41 testes na verificação) |
| `packages/cli` | TypeScript | `@izanagi/cli-next`: CLI sobre o SDK — pipeline de 4 fases com auto-heal, listagem de agents/skills, checagem de gates | `src/index.ts` → `dist/cli/src/index.js` (`bin: izanagi-next`) | smoke manual (`help`, `agent list`, `skill list`, `gates check`); sem suíte automatizada própria (**Gap**) |
| `packages/skill-migrator` | Node (ESM, `.mjs`) | Conversor determinístico idempotente skills v1 → v2 | `cli.mjs` (`--src --dest --dry-run --clean --json`) | dry-run + sha256 da árvore (documentado no README do pacote) |
| `packages/agent-migrator` | Node (ESM, `.mjs`) | Gerador determinístico idempotente dos YAMLs v2 a partir de `agents/*.json` | `cli.mjs` (`--src --dest --check --json`) | modo `--check` (round-trip interno byte-a-byte) |
| raiz (`package.json`, `src/`, `core/`, …) | TypeScript | Framework npm legado `izanagi-ai` (v3.7.0), fonte canônica de agentes/skills | `bin/izanagi.js`; scripts `npm run build/test/verify/doctor` | `npm test` na raiz |

---

## 3. Contratos de integração

Todo IPC entre as partes é texto JSON delimitado por newline — não há protobuf nem gRPC nesta fase (ver ADR-002 e **Gap** na seção 9).

### 3.1 Orquestrador Go — JSON-RPC 2.0 sobre UDS

Fonte da verdade: `internal/server/rpc.go`, `internal/server/server.go`, `internal/domain/domain.go` (confirmados por leitura e por sondagem E2E contra o servidor real).

#### Métodos

| Método | Params | Result / Erro |
|---|---|---|
| `orchestrator.submit` | `{taskId, task, agentChain?}` — `agentChain` opcional; default = cadeia canônica | Result `{accepted:true, taskId}`; erros mapeados de sentinels do domínio |
| `orchestrator.status` | `{taskId}` | Result `TaskStatus {taskId, state, stage, error?, events[]}`; `-32001` se desconhecida |
| `orchestrator.cancel` | `{taskId}` | Result `{cancelled, taskId}`; já-terminal ⇒ `cancelled:false` (sem erro); desconhecida ⇒ `-32001` |

Regras do fio (validadas em server.go):

- Todo request deve carregar `"jsonrpc":"2.0"` exato; caso contrário `-32600`.
- Batch requests (frames `[...]`) são rejeitados com `-32600`.
- Notifications (sem `id` ou `id:null`) executam efeitos colaterais mas **nunca** recebem resposta.
- O servidor faz **push** da notificação `event` para todo cliente conectado; params = `domain.Event`:

```json
{ "jsonrpc": "2.0", "method": "event",
  "params": { "taskId": "probe1", "type": "stage.completed",
              "data": {"role":"qa","artifactPath":"…/03-qa.md"}, "at":"2026-08-23T04:17:49Z" } }
```

Tipos de evento emitidos (`domain.go`): `task.submitted`, `stage.started`, `stage.completed`, `stage.failed`, `task.completed`, `task.failed`, `task.canceled`, `task.dropped`.

#### Error codes

| Código | Constante (`rpc.go`) | Significado |
|---|---|---|
| `-32700` | `codeParseError` | Frame ilegível (JSON inválido) |
| `-32600` | `codeInvalidRequest` | Request object inválido / batch / `jsonrpc` errado |
| `-32601` | `codeMethodNotFound` | Método inexistente |
| `-32602` | `codeInvalidParams` | Params malformados, taskId fora do padrão, prompt vazio |
| `-32001` | `codeUnknownTask` | TaskId desconhecido |
| `-32002` | `codeTaskConflict` | TaskId já ativo (não-terminal) |
| `-32003` | `codeQueueFull` | Fila de ingresso saturada |
| `-32004` | `codeShuttingDown` | Orquestrador em drain/shutdown |
| `-32005` | `codeSocketInUse` | **Reservado**: declarado em `rpc.go` mas nunca usado num frame de erro — a colisão de socket falha o boot em `Server.Start()` (erro de processo, não RPC) |

Padrão de taskId (compartilhado por Go e TS): `^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$` (`domain.go::ValidateTaskID`; espelhado em `packages/sdk/src/contracts.ts::TASK_ID_PATTERN`). Estados de task: `queued | running | done | failed`.

#### Socket paths — mismatch documentado

Há **dois defaults diferentes** e **duas envs diferentes** (uma por lado). Confirmado em código:

| Lado | Default | Variável de ambiente |
|---|---|---|
| Servidor Go (`internal/app/app.go`) | `/tmp/izanagi-orch.sock` | `IZANAGI_ORCHESTRATOR_SOCK` |
| SDK/CLI TS (`packages/sdk/src/environment.ts`) | `/tmp/izanagi-swarm.sock` | `IZANAGI_ORCHESTRATOR_SOCKET` |

Consequência prática: com defaults, cliente TS e servidor Go **não se encontram**. Para casá-los, aponte ambos para o mesmo path:

```bash
# terminal do servidor
IZANAGI_ORCHESTRATOR_SOCK=/tmp/izanagi.sock ./swarm_orchestrator
# terminal do cliente TS
IZANAGI_ORCHESTRATOR_SOCKET=/tmp/izanagi.sock node dist/cli/src/index.js run --agent=… --task="…"
```

(ou `socketPath` explícito no `OrchestratorClientOptions`). Este assimetria é conhecida e registrada em `.agents/memoria/contexto.md`; não há ainda unificação de default no código (**Gap**).

#### Pipeline interno (Go)

- Cadeia canônica (`domain.DefaultChain()`): `architect → senior-engineer → qa → security`. Cada papel tem seu próprio pool de workers sobre canal buffered (`Options.WorkersPerStage`, default 2, máx 32; `QueueDepth`, default 64, máx 10 000).
- Executor default (`FileArtifactExecutor`): renderiza markdown determinístico por estágio e grava atomicamente (temp+rename) em `<IZANAGI_ARTIFACTS_DIR>/<taskId>/NN-<role>.md` (default root: `.agents/artifacts`). Sem chamada externa/LLM — maquinaria real de pipeline cuja saída alimenta o contexto do próximo estágio.
- Shutdown graceful (SIGINT/SIGTERM): drena tasks aceitas; tarefas não-terminais são persistidas em `<artifacts>/pending-tasks.json`; segundo sinal força saída.

Env vars do servidor Go: `IZANAGI_ORCHESTRATOR_SOCK`, `IZANAGI_ARTIFACTS_DIR`, `IZANAGI_STAGE_WORKERS`, `IZANAGI_QUEUE_DEPTH`.

### 3.2 Quality gate Rust — NDJSON stdin/stdout

Fonte da verdade: `crates/izanagi_core/src/protocol.rs`. Uma linha = um request; uma linha = um response; EOF encerra. Linhas vazias são ignoradas sem resposta. Payloads malformados geram erro estruturado inline (nunca derrubam a sessão); única falha fatal é transporte (pipe quebrado).

```text
→ {"op":"validate","language":"typescript","code":"function f() {}"}
← {"ok":true,"score":85,"findings":[{"rule":"EMPTY_FUNCTION","severity":"error","line":1,"message":"…"}]}

→ {"op":"rules"}
← {"ok":true,"rules":["STUB_BODY","EMPTY_FUNCTION","GENERIC_CATCH","GENERIC_NAME","REDUNDANT_COMMENT","AI_WATERMARK","LONG_FUNCTION"]}

→ {"op":"version"}
← {"ok":true,"version":"0.1.0"}

→ <qualquer coisa malformada>
← {"ok":false,"error":"invalid request: …"}
```

- `language` aceita somente `typescript | python | go` (fora disso: `{"ok":false,"error":"unknown language …"}`).
- `version` = versão do crate (`PROTOCOL_VERSION` derivado de `CARGO_PKG_VERSION`; `0.1.0` no workspace atual).
- Score 100 = sem findings; severidades possíveis nos findings: `error` (crítico, recusa gate) e demais níveis informativos.
- O SDK (`RustCoreClient`) usa **um processo curto por request** — enquadramento FIFO à prova de dessincronização. Resolução do binário: opção explícita > `$IZANAGI_CORE_BIN` > busca em `<repoRoot>/target/{debug,release}` e `<repoRoot>/crates/target/{debug,release}`.
- Descoberta de repo-root (`resolveRepoRoot`): sobe diretórios até achar pasta com `package.json` **e** `crates/`; `$IZANAGI_REPO_ROOT` atalha a busca.

#### Bindings WASM (feature `wasm`, ADR-003)

- Sob `#[cfg(feature = "wasm")]` em `src/wasm.rs`: exports `validateSource(source, language)`, `supportedLanguages()`, `ruleIds()`, `engineVersion()`. Erros lançam envelope tipado (`{code:"UNKNOWN_LANGUAGE", message, supportedLanguages[]}`), nunca string parseável.
- Compilação nativa type-checka tudo: `cargo check -p izanagi_core --features wasm` (executado e verde na auditoria). Chamadas diretas em host abortam por design — a fronteira de interop só existe sob `wasm32`.
- Artefato `.wasm` real: apenas no job CI `wasm-build` (requer `rustup`/target `wasm32-unknown-unknown` + `wasm-bindgen-cli` na mesma versão do `Cargo.lock`, hoje 0.2.127). Local dev desta máquina **não tem rustup/wasm-pack** — não é possível gerar `.wasm` localmente (**Gap**, por design do ADR-003).

### 3.3 MCP — harness Rust + sessão nativa TS

Duas superfícies complementares (`crates/izanagi_mcp` + `packages/sdk/src/mcp-client.ts`):

1. **Discovery via binário** `izanagi-mcp [--timeout-ms=N] <server-cmd...>`: faz handshake e imprime um passo NDJSON por linha:

   ```text
   {"step":"initialize","result":{…}}
   {"step":"tools/list","tools":[…]}
   ```

   Invocação pontual: `izanagi-mcp call --tool=<name> [--args=<json>] [--timeout-ms=N] <server-cmd...>` imprime adicionalmente `{"step":"tools/call","result":{…}}`. Erros vão para stderr como `izanagi-mcp: <message>` com exit 1 (inclui códigos reservados, ex.: `tools/call failed: method not found (-32601)`). O harness derruba o filho ao fim — não serve para sessões longas.

2. **Sessão nativa TS** (`McpClient.connect()`): fala o mesmo framing de `codec.rs` diretamente com o servidor:
   `initialize` com `protocolVersion "2025-06-18"` (constante em `client.rs`), notificação `notifications/initialized`,
   requests correlacionados por id numérico, timeout por request e a taxonomia de erros reservados
   `-32700/-32600/-32601/-32602/-32603` (`error.rs`). `callTool` retorna `{isError:true}` para falhas in-band;
   falhas de transporte estouram erros tipados.

O servidor MCP alvo é configurado por comando (ex.: `IZANAGI_MCP_SERVER_CMD="node meu-server.cjs"`); sem comando, `pipeline.mcp` é `null` e o CLI segue sem o caminho MCP.

### 3.4 Analisador Python — subprocess CLI

Contrato (`ast_analyzer/cli.py`, espelhado em `packages/sdk/src/semantic.ts`):

```bash
<python> -m ast_analyzer analyze <path> [--glob PATTERN]
```

- Exit 0 → relatório JSON no stdout (`FileReport` ou `DirReport`, snake_case: símbolos, complexidade, imports, chunks).
- Exit 1 → payload JSON no stderr: `{"ok":false,"error":{"type","message","path"}}`.
- Backends: tree-sitter quando importável (grammars py/ts/tsx/go), fallback estrutural (regex + indentação/chaves) com mesmo contrato de métricas; o modo ativo aparece em `capabilities.tree_sitter`.
- Interprete (ordem do SDK): opção explícita > `$IZANAGI_PYTHON` > `python-engine/.venv/bin/python` > `python3` no PATH. O filho roda com `cwd` fixado em `python-engine/` (módulo precisa ser importável).
- `pyproject.toml` declara `dependencies=[]` — tree-sitter é extra opcional; o CI instala via `requirements-dev.txt` pinado (`pytest==9.1.1`, `tree-sitter==0.25.2`, grammars `0.25.0/0.25.0/0.23.2`).

### 3.5 Tabela consolidada de variáveis de ambiente

| Variável | Quem lê | Default | Função |
|---|---|---|---|
| `IZANAGI_CORE_BIN` | SDK/CLI | busca em `target/{debug,release}` | path do binário `izanagi-core` |
| `IZANAGI_MCP_BIN` | SDK/CLI | busca em `target/{debug,release}` | path do binário `izanagi-mcp` |
| `IZANAGI_ORCHESTRATOR_SOCKET` | SDK/CLI (TS) | `/tmp/izanagi-swarm.sock` | socket UDS do orquestrador (lado cliente) |
| `IZANAGI_ORCHESTRATOR_SOCK` | Servidor Go | `/tmp/izanagi-orch.sock` | socket UDS do orquestrador (lado servidor) — **nome diferente do TS, de propósito documentado** |
| `IZANAGI_PYTHON` | SDK | `python-engine/.venv/bin/python` → `python3` | interprete do analisador |
| `IZANAGI_MCP_SERVER_CMD` | SDK/CLI | ausente (MCP desligado) | comando do servidor MCP, separado por espaços |
| `IZANAGI_REPO_ROOT` | SDK | auto-detecção (`package.json` + `crates/`) | raiz do workspace poliglota |
| `IZANAGI_ARTIFACTS_DIR` | Servidor Go | `.agents/artifacts` | raiz de artefatos de estágio + `pending-tasks.json` |
| `IZANAGI_STAGE_WORKERS` | Servidor Go | `2` (máx 32) | goroutines por estágio |
| `IZANAGI_QUEUE_DEPTH` | Servidor Go | `64` (máx 10 000) | capacidade dos canais por estágio/ingresso |

---

## 4. Pipeline de execução da izanagi-next

Comando: `node dist/cli/src/index.js run --agent=<name> --task="<texto>" [--skills=a,b] [--files=f1,f2] [--max-heal-attempts=2] [--standalone] [--timeout-ms=120000] [--json]`

Exit codes do binário: `0` sucesso · `1` falha operacional (gate recusou, task falhou) · `2` erro de uso · `3` erro de ambiente (binário ausente, socket inacessível).

```mermaid
sequenceDiagram
    autonumber
    participant C as izanagi-next run
    participant K as Catálogo skills (.skills/ → skills/)
    participant O as Orquestrador Go (UDS)
    participant G as izanagi-core (gate Rust)

    C->>K: Fase 1 · Routing — lê SOMENTE front-matter<br/>(--skills=a,b sobrepõe scorer heurístico)
    K-->>C: até 5 skills candidatas
    C->>C: Fase 2 · Loading — injeta corpos SKILL.md no payload<br/>(corpo truncado em 4.000 chars por skill)
    C->>O: Fase 3 · Submission — orchestrator.submit(taskId, task)
    alt socket disponível
        O-->>C: accepted=true
        loop polling exponencial (150ms→2s) até done|failed
            C->>O: orchestrator.status(taskId)
        end
    else socket ausente ou --standalone
        C->>C: grava .izanagi/tasks/<taskId>/prompt.md<br/>(via MCP fs_write se houver servidor; senão fs direto)
    end
    loop Fase 4 · Quality gate + auto-heal (até max-heal-attempts re-submissões)
        C->>G: validate por cada arquivo de --files
        alt findings severity=error
            G-->>C: REFUSED
            C->>O: re-submit com relatório de violações anexado (taskId base-rN)
        else sem violações
            G-->>C: PASSED
            C->>C: receipt .izanagi/tasks/<taskId>/result.json (exit 0)
        end
    end
    C->>C: persistência do fracasso: violations.md (exit 1)
```

Detalhes confirmados em `packages/cli/src/commands/run.ts`:

- **Fase 1**: scoring heurístico tokeniza a task (+3 nome da skill, +2 categoria, +1 prefixo na descrição) e mantém top-5 com score > 0; skill pedida e inexistente = erro loud.
- **Fase 3**: `taskId` base = `t<epoch36>-<agent sanitizado[12]>`; re-submissões de heal usam sufixo `-r<N>`. Queda de socket no meio do submit também cai para standalone.
- **Fase 4**: sem `--files`, a fase de gate é pulada (exit 0 após submissão). Recusa final grava `violations.md` e sai 1 — sucesso nunca é registrado com violação crítica pendente.
- Outros comandos: `agent list` (lê `agents/*.json`: nome, role, chains), `skill list [--category] [--search] [--json]` (catálogo v2 com fallback legado), `gates check <file>` (gate em um arquivo; exit 1 se houver finding severity=error).

---

## 5. Quality gates e anti-generacidade

### O que o core Rust valida

Sete heurísticas estruturais (`RULE_IDS`, ordem canônica), sobre código mascarado (comentários/strings blanked preservando linhas):

| Regra | Detecta |
|---|---|
| `STUB_BODY` | Corpos-stub (`pass`, `TODO`, corpo omitido) |
| `EMPTY_FUNCTION` | Funções com corpo vazio |
| `GENERIC_CATCH` | `catch`/`recover()` genéricos que engolem erro |
| `GENERIC_NAME` | Nomes genéricos sem intenção |
| `REDUNDANT_COMMENT` | Comentários que repetem o código |
| `AI_WATERMARK` | Marcas de geração por IA (ex.: “Generated by GPT”) |
| `LONG_FUNCTION` | Funções excessivamente longas |

Arquitetura interna (`lib.rs`): `mask` (blanks comments/strings) → `functions` (extents) → `rules` (7 heurísticas com atribuição exata de linha) → `engine` (scoring) → `protocol` (fio). A mesma engine alimenta as três superfícies (lib Rust, protocolo NDJSON, WASM) — as formas serializadas são pinadas por testes, então as superfícies não podem divergir.

### Anti-generacidade nas skills v2

As seções obrigatórias `Common Rationalizations` e `Red Flags` (presentes em 106/106 arquivos `.skills/*/SKILL.md`, verificado por grep) materializam as leis do framework (`RULES.md`) como bibliotecas anti-racionalização por categoria (`engineering/testing/security/design/docs/devops/data/ai` — ver `packages/skill-migrator/rationalizations.mjs`). Elas pré-respondem as desculpas clássicas de atalho (“depois do launch”, “é neutro”, “ajusto no final”) com a Verdade técnica correspondente, e listam sinais-vermelhos que invalidam a entrega. A cadeia completa funciona assim: o gate Rust recusa **código** com cheiro de stub/slop; as skills v2 recusam **raciocínio** que leve a stub/slop — ambos os mecanismos determinísticos e verificáveis.

A cadeia completa funciona assim: o gate Rust recusa **código** com cheiro de stub/slop; as skills v2 recusam **raciocínio** que leve a stub/slop. Ambos os mecanismos são determinísticos e verificáveis (regras compiladas vs. seções obrigatórias validadas pelo migrador).

---

## 6. Skills v2 e Agents YAML

### Skills v2 — `.skills/<name>/SKILL.md`

Gerado exclusivamente por `packages/skill-migrator` (ADR-004). Formato (exemplo real de `.skills/anti-ai-slop/SKILL.md`):

```markdown
---
name: "anti-ai-slop"
description: "<descrição original + gatilhos derivados>"
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---
## Triggering Criteria
## Step-by-Step Workflow
## Verification Steps
## Common Rationalizations
## Red Flags
## Legacy Reference (v1)      ← corpo original preservado
```

Garantias (implementadas em `migrate.mjs`, README do pacote):

- **Determinismo/idempotência**: funções puras, ordem de leitura ordenada, zero timestamps no output — rodadas repetidas produzem bytes idênticos (verificável por sha256 da árvore).
- **Fidelidade**: nada inventado; corpo original íntegro em Legacy Reference; estratégias de extração do workflow registradas em comentário HTML dentro da seção.
- **Falha loud**: skill sem corpo aproveitável ou divergência nome/diretório interrompe com exit 1 — nunca stub silencioso.
- Estado atual: 106/106 módulos migrados; todas as seis seções obrigatórias presentes em todos os arquivos (grep verificado em 2026-08-23).

Uso:

```bash
node packages/skill-migrator/cli.mjs             # migra (src=skills dest=.skills)
node packages/skill-migrator/cli.mjs --dry-run   # valida sem escrever (exit codes 0/1/2)
```

**Gap**: o skill-migrador não possui flag `--check` equivalente ao agent-migrator (anti-drift do catálogo v2 é feito hoje por re-execução + comparação de hash, não por comando dedicado).

### Agents YAML — `.agents/agents/<slug>.yaml`

Gerado exclusivamente por `packages/agent-migrator` (ADR-005). `agents/*.json` permanece a **fonte canônica** (Strangler Fig segue válido); o YAML é representação derivada — interface de leitura estruturada para CLIs. **Proibido editar YAML à mão**: toda mudança nasce no JSON e propaga por regeneração.

```yaml
source: "agents/architect-agent.json"   # primeira chave sempre
name: "Software Architect"
version: "2.8.0"
role: "System Design de alta escala, Clean Architecture, DDD..."
chains:
  design_system:
    - "memoria-projeto"
    - "requirement-analyzer"
handoffs:
  - to: "senior-engineer"
    reason: "implementacao"
evaluation:
  metrics:
    - "correctness"
  minScore: 0.7
```

Garantias: espelhamento campo-a-campo do JSON (ausente = omitido; nada inventado; chaves desconhecidas anexadas em ordem alfabética), ordem canônica de grupos, metadado `source`, zero timestamps → **idempotência byte-a-byte**, round-trip interno obrigatório (leitor relê e compara profundamente), colisão de slug = erro loud antes de escrever, órfãos reportados e nunca apagados silenciosamente.

Anti-drift:

```bash
node packages/agent-migrator/cli.mjs            # regenera .agents/agents/
node packages/agent-migrator/cli.mjs --check    # compara byte-a-byte sem escrever;
                                                # detecta DRIFT (edição manual),
                                                # AUSENTE e órfãos (exit 0/1/2)
```

Estado atual: 22 YAMLs ↔ 22 JSONs em sincronia (`--check` executado em 2026-08-23: `EM SINCRONIA`, tree hash `6c88bf01…`).

Nota de higiene de repo (ADR-005): o antigo `.gitignore` com `.agents/` inteiro virou negativa fina (`.agents/memoria/`, `.agents/auditoria/`), pois gitignore não reinclui filhos de diretório totalmente excluído — YAMLs derivados são versionáveis; memória local nunca.

---

## 7. Build e verificação local

Comandos copiáveis por linguagem. Os marcados ✅ foram executados com sucesso na máquina de referência em 2026-08-23; os marcados 🔧 requerem toolchain ausente no ambiente local (honestidade acima de otimismo).

### Rust (workspace na raiz)

```bash
cargo build --workspace                       # binários em target/debug/{izanagi-core,izanagi-mcp}
cargo test --workspace                        # ✅ 81 testes verdes
cargo clippy --workspace --all-targets        # ⚠️ não-bloqueante: 4 warnings pre-existentes
cargo check -p izanagi_core --features wasm   # ✅ type-check dos bindings (ADR-003)
cargo fmt --check                             # ❌ falha hoje (44 pontos de diff) — NÃO bloqueante no CI
```

Smoke do protocolo NDJSON (✅ executado):

```bash
echo '{"op":"validate","language":"python","code":"def save():\n    pass\n"}' \
  | target/debug/izanagi-core
# {"ok":true,"score":85,"findings":[{"rule":"STUB_BODY","severity":"error","line":1,"message":"…"}]}
```

### Go

```bash
cd go-services/swarm_orchestrator
go build ./...     # ✅
go vet ./...       # ✅
go test ./...      # ✅ (suíte do módulo)

# subir servidor apontando para um socket explícito (✅ executado em /tmp):
go build -o /tmp/swarm_orchestrator .
IZANAGI_ORCHESTRATOR_SOCK=/tmp/izanagi.sock IZANAGI_ARTIFACTS_DIR=/tmp/artifacts /tmp/swarm_orchestrator
```

### Python

```bash
cd python-engine
python -m venv .venv
.venv/bin/python -m pip install -r requirements-dev.txt   # pins exatos (pytest 9.1.1, tree-sitter 0.25.2…)
.venv/bin/python -m pip install -e .
.venv/bin/python -m pytest tests/ -q                      # ✅ 70 passed
.venv/bin/python -m ast_analyzer analyze <arquivo>        # ✅ relatório JSON no stdout
```

### Packages TypeScript (SDK e CLI)

```bash
cd packages/sdk && npm install && npm test   # ✅ 41/41 (tsc + node --test dist/tests/*.test.js)
cd ../cli   && npm install && npm run build  # ✅ gera dist/cli/src/index.js

# smoke (✅ executado):
node dist/cli/src/index.js help
node dist/cli/src/index.js agent list
node dist/cli/src/index.js skill list --search=wasm
node dist/cli/src/index.js gates check <arquivo>   # exit 1 se houver violation severity=error

# pipeline completo (requer binários Rust construídos; orquestrador Go opcional):
cargo build -p izanagi_core
export IZANAGI_ORCHESTRATOR_SOCKET=/tmp/izanagi.sock   # casar com o IZANAGI_ORCHESTRATOR_SOCK do Go!
node dist/cli/src/index.js run --agent=senior-engineer --task="…" --files=a.ts
```

### Migradores (Node ≥18, zero deps)

```bash
node packages/agent-migrator/cli.mjs --check    # ✅ EM SINCRONIA (22/22)
node packages/skill-migrator/cli.mjs --dry-run  # ✅ 106/106 ok
```

### Requer toolchain indisponível localmente (🔧)

- **Build `.wasm` real**: `rustup target add wasm32-unknown-unknown` + `wasm-bindgen-cli 0.2.127` (versão TEM que bater com `Cargo.lock`). Fluxo completo documentado em `crates/izanagi_core/README.md` e exercido apenas no job CI `wasm-build`.
- **gRPC**: condicionado à disponibilidade de `protoc` (ADR-002) — ausente neste ambiente; nada de gRPC existe no código hoje.

### Verificação global sugerida (ordem)

```bash
npm test                                        # raiz legado (build + suíte node:test) ✅ 284/284 em 2026-08-23*
(cd go-services/swarm_orchestrator && go build ./... && go vet ./... && go test ./...)
cargo test --workspace
(cd python-engine && .venv/bin/python -m pytest tests/ -q)
(cd packages/sdk && npm test)
(cd packages/cli && npm run build)
node packages/agent-migrator/cli.mjs --check
```

\* O número de testes da raiz muda conforme o legado evolui (262 no AGENTS.md → 266 na memória → 284 na auditoria); o valor canônico é sempre o resultado corrente de `npm test`.

---

## 8. CI e Release

### `.github/workflows/polyglot.yml` — Polyglot CI

Gatilhos: push e PR em `main`. Seis jobs **100% paralelos** (nenhum `needs`): qualquer job vermelho falha o run (fail-fast global). Permissões `contents: read` (least privilege, nenhum secret acessado). Concurrency group cancela runs obsoletos de PR. Todas as actions de terceiros fixadas por SHA de commit completo (imutável) — nunca tags mutáveis (`@v4`/`@main`).

| # | Job | Conteúdo |
|---|---|---|
| 1 | `legacy-npm` | Node 24 · `npm ci` · `npm run build` · `npm test` (framework legado da raiz) |
| 2 | `rust` | stable + clippy · `cargo clippy --workspace --all-targets` (não-bloqueante) · `cargo test --workspace` · `cargo check -p izanagi_core --features wasm` |
| 3 | `wasm-build` | target `wasm32-unknown-unknown` · download do `wasm-bindgen-cli 0.2.127` (asset musl x86_64, sha256 conferido) · `cargo build -p izanagi_core --features wasm --target wasm32-unknown-unknown` · `wasm-bindgen … --out-dir target/wasm-bindgen` — prova E2E do ADR-003 |
| 4 | `go` | setup-go lê a versão do `go.mod` (`go-version-file`) · `go build/vet/test ./...` |
| 5 | `python` | Python 3.14 · venv explícito · `pip install -r requirements-dev.txt` (pins) + `-e .` · `pytest tests/ -q` |
| 6 | `ts-packages` | matriz paralela com fail-fast: `sdk` → `npm test`; `cli` → `npm run build` (ambos com lockfile commitado ⇒ `npm ci`) |

Notas registradas no próprio workflow (fatos medidos, não opinião):

- `cargo check --features wasm` **na raiz** de workspace virtual é silenciosamente ignorado pelo cargo — a forma correta exige `-p izanagi_core` (por isso o job usa `-p`).
- `cargo fmt --check` não roda: o código atual falha com 44 pontos de diff; reativar após passar o `cargo fmt`.
- Clippy roda sem `-D warnings`: existem 4 warnings pre-existentes; endurecer após limpeza.
- Cache Rust (`Swatinem/rust-cache`) na raiz; o input `workspaces: true` foi rejeitado deliberadamente (seria resolvido como path `<repo>/true`).

### Release

Dois circuitos independentes:

1. **npm legado (intocado)**: fluxo vigente do `package.json` da raiz — `npm run bump:{patch,minor,major}` → commit (`chore: bump to vX.Y.Z`) → `npm publish` (`prepublishOnly` roda o build) → `git push`. A whitelist `files` do pacote publicado **não inclui** `crates/`, `go-services/`, `python-engine/`, `packages/` — decisão deliberada (zero inchaço até consumo real; ver gaps em `.agents/memoria/contexto.md`).
2. **Pacotes poliglotas (`@izanagi/sdk`, `@izanagi/cli-next`)**: ambos `"private": true` — não publicados. O CLI consome o SDK por caminho relativo. Integração SDK→CLI legado no npm é gap aberto registrado em memória.

---

## 9. Decisões arquiteturais (ADRs)

Resumo operativo abaixo. Texto integral e racional em `.agents/memoria/decisoes.md` — atenção: esse arquivo é memória local e está no `.gitignore` (`.agents/memoria/`), então existe apenas nesta máquina de desenvolvimento, não no repositório versionado.

| ADR | Decisão | Status / Gap |
|---|---|---|
| **ADR-001** Strangler Fig | Legado npm intocado e publicável; topologia nova cresce em `crates/`, `go-services/`, `python-engine/`, `packages/`; sem npm workspaces na raiz nesta fase | Vigente. Trade-off assumido: duplicação temporária de tooling vs. risco zero de regressão para usuários npm |
| **ADR-002** IPC = UDS + JSON-RPC 2.0 | Prompt master pedia gRPC; `protoc` ausente no ambiente. Mantido JSON-RPC 2.0 sobre UDS (já implementado e testado em Go); migração futura seria só de transporte (payloads preservados) | Vigente. **Gap**: gRPC condicionado ao provisionamento de `protoc` em CI; nada de gRPC existe no código hoje |
| **ADR-003** WASM feature-gated | Bindings wasm-bindgen sob feature `wasm` em `izanagi_core`; verificação local via `cargo check -p izanagi_core --features wasm`; build `.wasm` real (target `wasm32-unknown-unknown`) apenas em CI com rustup | Vigente. Local dev sem rustup/wasm-pack não gera `.wasm` (por design); job CI `wasm-build` cobre o fluxo |
| **ADR-004** Skills v2 via migrador determinístico | Conversor idempotente deriva SKILL.md v2 do conteúdo REAL original + biblioteca de Rationalizations/Red Flags por categoria; proibido inventar conteúdo; falha loud | Vigente. 106/106 migrados. Gap menor: sem `--check` dedicado |
| **ADR-005** Agents v2 em YAML derivado | `.agents/agents/<slug>.yaml` gerado exclusivamente pelo `agent-migrator` a partir de `agents/*.json` (fonte canônica); idempotência byte-a-byte, round-trip interno, `--check` anti-drift; proibido editar YAML à mão; `.gitignore` afinado (memória local fora, YAMLs versionados) | Vigente. 22/22 em sincronia |

### Lacunas conhecidas (consolidadas)

- **Socket default divergente** Go (`/tmp/izanagi-orch.sock`) vs. TS (`/tmp/izanagi-swarm.sock`), com nomes de env distintos — alinhar via env (seção 3.1); unificação de default não existe no código.
- **`-32005` reservado sem uso em fio**: colisão de socket falha o boot do processo, não vira resposta RPC.
- **Sem suíte automatizada do `packages/cli`** (apenas smoke manual + 41 testes do SDK que cobrem os clientes subjacentes).
- **Publicação npm dos pacotes novos**: pendente por decisão (fora do `files` do legado; pacotes `private`).
- **`cargo fmt`/clippy `-D warnings`** preparados para endurecer no CI após limpeza do código Rust.
- Drift documental pontual fora deste arquivo: `AGENTS.md` ainda menciona `agents/generated/c-systems-engineer.json`, que não existe mais na árvore (registrado em memória; correção pertence à frente responsável pelo AGENTS.md).
