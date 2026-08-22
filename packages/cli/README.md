# izanagi-next

CLI da próxima geração do Izanagi AI sobre os núcleos poliglotas: quality gate em **Rust**
(`izanagi-core`), cliente MCP em **Rust** (`izanagi-mcp`), orquestrador de swarm em **Go**
(JSON-RPC 2.0 sobre Unix socket) e analisador semântico em **Python** (`ast_analyzer`).

Depende do `@izanagi/sdk` (`../sdk`) via caminho relativo — nada é publicado.

## Instalação / build

```bash
cd packages/cli
npm install
npm run build          # compila sdk + cli juntos para dist/
```

Binário: `dist/cli/src/index.js` (`"bin": "izanagi-next"`). Os binários nativos são
resolvidos automaticamente em `target/debug|release`; ou aponte-os por env:

```bash
export IZANAGI_CORE_BIN=/path/para/izanagi-core        # quality gate Rust
export IZANAGI_MCP_BIN=/path/para/izanagi-mcp          # harness MCP Rust
export IZANAGI_ORCHESTRATOR_SOCKET=/tmp/izanagi-orch.sock
export IZANAGI_PYTHON=python3                          # ou python-engine/.venv/bin/python
export IZANAGI_MCP_SERVER_CMD="node meu-mcp-server.cjs"
```

## Comandos

### `run` — pipeline de 4 fases com auto-heal

```bash
cargo build -p izanagi_core   # garante o gate Rust

# Fase 1: roteamento lendo só front-matter das skills (--skills sobrepõe o heurístico)
# Fase 2: injeção progressiva dos corpos SKILL.md no payload
# Fase 3: submit ao orquestrador Go via UDS; sem socket -> modo standalone (MCP se houver)
# Fase 4: quality gate Rust em cada arquivo; violação crítica RECUSA e re-submete
#         com o relatório anexado até N tentativas (default 2)
node dist/cli/src/index.js run \
  --agent=senior-engineer \
  --task="Implement the payment webhook module with retries" \
  --skills=tdd,security-privacy \
  --files=src/webhook.ts \
  --max-heal-attempts=2
```

Saída real (arquivo limpo):

```
[1/4] routing: explicit -> tdd, security-privacy
[2/4] loading: payload composed (8412 chars, 2 skill bodies injected)
[3/4] submission: mode=orchestrator, taskId=tmt4toyj0-qa (accepted=true, final state=done, polls=1)
[4/4] quality gates: PASSED (webhook.ts=100)
receipt: .izanagi/tasks/tmt4toyj0-qa/result.json
```

Saída real (violações persistem após o loop de cura → recusa gravar receipt, exit 1):

```
[4/4] quality gates: REFUSED with 2 critical violation(s) (attempt 1)
       - dirty.ts:1 [STUB_BODY] stub marker(s): TODO, implement later
       - dirty.ts:2 [EMPTY_FUNCTION] function 'handler' has an empty body
auto-heal: re-submitting with violation report attached (attempt 2)
...
run failed: critical violations persisted after 3 gate round(s); refusing to record success
violation report: .izanagi/tasks/<taskId>/violations.md
```

### `agent list` — catálogo legado `agents/*.json`

```bash
node dist/cli/src/index.js agent list
```

```
FILE                            NAME                  ROLE                                                              CHAINS
------------------------------  --------------------  ----------------------------------------------------------------  ------------
adversarial-critic-agent.json   Adversarial Critic    Crítica adversarial de implementações: caçar bugs, falhas de se…  critique_code,...
bug-hunter-agent.json           Bug Hunter            Debugging avançado em 6 fases (Reproduzir -> Isolar -> Hipótese…  bug_debug,...

22 agents
```

### `skill list` — metadados de `.skills/` (fallback `skills/`)

```bash
node dist/cli/src/index.js skill list --category=testing --search=playwright
```

 Lê apenas front-matter YAML (parser mínimo embutido no SDK); nunca carrega corpos aqui.

### `gates check` — só o quality gate Rust

```bash
node dist/cli/src/index.js gates check src/exporters.ts
echo $?
```

Saída real contra um arquivo do repo:

```
file:   /home/pedro/Documentos/VsCode/izanagi-ai/src/exporters.ts
score:  35/100
status: REFUSED
findings (5):
  L92 [ERROR] STUB_BODY: stub marker(s): TODO
  L238 [WARNING] GENERIC_CATCH: catch block only logs or rethrows
  L499 [ERROR] STUB_BODY: stub marker(s): TODO
  L508 [ERROR] STUB_BODY: stub marker(s): TODO
  L970 [ERROR] STUB_BODY: stub marker(s): TODO
```

Exit codes: `0` ok · `1` falha operacional (gate recusou etc.) · `2` erro de uso · `3`
erro de ambiente (binário ausente).
