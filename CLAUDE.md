# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> Mantido à mão. Ele **não** carrega o `GENERATED_MARKER` (o rodapé "gerado por" que `src/exporters.ts` procura), e por isso `izanagi export --cli claude` o preserva em vez de reescrevê-lo: `writeIfAbsent` só regenera arquivo que tem o marcador. Não reintroduza essa string aqui, nem citada, ou o próximo export apaga este arquivo. O que deve chegar nos projetos que **instalam** o pacote vive em `claudeMainTemplate()` no mesmo `src/exporters.ts`: edite lá, não aqui.

## Este repositório É o framework

Izanagi AI é um framework meta de engenharia de software orientada a agentes, publicado no npm como `izanagi-ai` (bins `izanagi` e `izanagi-ai`). Aqui está a fonte dele, não um app que o consome. Consequência prática:

- **Fonte:** `agents/*.json` (22 agentes), `skills/` (v1) e `.skills/` (catálogo v2, 106 módulos), `core/` (engines em `.md` + `skill-resolver.json`), `src/` (CLI + runtime TypeScript).
- **Saída gerada:** `.claude/`, `.opencode/`, `.codex/`, `.cursor/`, `.github/copilot-instructions.md`, `.kimi/`, `.agents/agents/*.yaml`. Editar um desses à mão é editar o artefato: mude o gerador (`src/exporters.ts`, `packages/agent-migrator`) ou a fonte JSON.
- Ponteiros do `CLAUDE.md` de consumidor (`.agents/AGENTS.md`, "seção 0 do AGENTS.md") descrevem a instalação do usuário e **não existem neste repo**. Aqui a referência completa é o `AGENTS.md` da raiz (seções 1 a 9).

## Comandos

```bash
# Legado npm (raiz): a CLI publicada
npm install
npm run build          # tsc + node dist/scripts/generate-manifest.js
npm test               # build + clean-temp + node --test dist/runtime/tests/*.test.js
npm run test:only      # mesma suíte SEM rebuildar (iteração rápida)
npm run verify         # verify-build.js + a suíte de testes
npm run doctor         # node bin/izanagi.js doctor [--deep]

# Um teste só (precisa de dist/ atualizado: rode npm run build antes)
node --test dist/runtime/tests/export-global.test.js
node --test --test-name-pattern="export --global" dist/runtime/tests/*.test.js

# Núcleos poliglotas
cargo test --workspace
cargo check -p izanagi_core --features wasm
(cd go-services/swarm_orchestrator && go build ./... && go vet ./... && go test ./...)
(cd python-engine && .venv/bin/python -m pytest tests/ -q)
(cd packages/sdk && npm install && npm test)
(cd packages/cli && npm install && npm run build)

# Diagnóstico
node bin/izanagi.js polyglot status [--json|--strict]
node packages/agent-migrator/cli.mjs --check     # drift YAML vs JSON (exit 0 ok / 1 drift / 2 uso)
node packages/skill-migrator/cli.mjs --dry-run
```

**Release:** `npm run bump:patch|minor|major` (só bumpa a versão), então `npm run build`, commit `chore: bump to vX.Y.Z`, `npm publish` (o `prepublishOnly` rebuilda) e `git push`. O CD só dispara em tag `v*` (`.github/workflows/publish.yml`); o CI roda 6 jobs paralelos em `.github/workflows/polyglot.yml`.

## Arquitetura

**Duas camadas convivendo por Strangler Fig (ADR-001):** o legado npm (`src/`, bin `izanagi`) permanece publicável e intocado; o crescimento novo vive em `packages/` mais 4 núcleos nativos, orquestrados pelo bin `izanagi-next`. Contratos IPC, error codes (`-32001..-32005`) e env vars: `docs/POLYGLOT.md`.

| Onde | O quê |
|---|---|
| `src/runtime/` | O runtime headless. Fluxo de um run: Task, Classify, Plan (grafo), Route (agente/skill/modelo por PAPEL, não por run), Execute em batches, Validate artifacts, Evaluate, Heal, Reflect, Trace. Entrada: `orchestrator.ts`. |
| `src/runtime/llm/` | Executores. Precedência: CLI de agente (`claude-cli` por subprocesso, sem API key), API key, modelo local, e headless simulado como último recurso. |
| `src/cli/commands/` | 24 subcomandos (`run`, `export`, `doctor`, `polyglot`, `agent`, `skill`, `resume`, `budget`...). Entrada: `src/cli/index.ts` chamando `runCLI`. |
| `src/exporters.ts` | Gera os adapters de todas as CLIs. Idempotente com uma regra só: arquivo com `GENERATED_MARKER` é reescrito, arquivo sem o marker é preservado intocado. |
| `src/installer.ts` | O que um projeto consumidor recebe: packs, `ROOT_DOCS` (`AGENTS.md`, `SYSTEM.md`, `RULES.md`) e a versão de consumidor do `AGENTS.md` via `buildConsumerAgentsDoc`. |
| `crates/izanagi_core` (Rust) | Quality engine: 7 heurísticas anti-slop sobre TS/Python/Go, protocolo NDJSON, bindings WASM feature-gated. |
| `crates/izanagi_mcp` (Rust) | Cliente MCP JSON-RPC 2.0 sobre stdio. |
| `go-services/swarm_orchestrator` (Go) | Swarm architect/engineer/qa/security via JSON-RPC 2.0 sobre UDS. |
| `python-engine/ast_analyzer` | Análise semântica multilíngue (tree-sitter com fallback estrutural). |
| `packages/sdk`, `packages/cli` | `@izanagi/sdk` e o bin `izanagi-next`. Ambos `private`: não são publicados. |

## Gotchas que custam tempo

- `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js`: **rode `npm run build` antes de qualquer comando CLI local**, senão executa código obsoleto ou quebra. Vale igual para `packages/*/dist`.
- Testes do SDK e da CLI nunca por strip-types direto sobre `.ts`: use o `npm test` de dentro do package.
- O socket do orquestrador tem defaults divergentes por lado: Go `/tmp/izanagi-orch.sock` (`IZANAGI_ORCHESTRATOR_SOCK`) contra SDK TS `/tmp/izanagi-swarm.sock` (`IZANAGI_ORCHESTRATOR_SOCKET`). Case os dois via env antes de integrar.
- `.agents/memoria/` é gitignored e só existe local (`contexto.md`, `decisoes.md` com os ADRs, `erros-corrigidos.md`, `learnings.md`). Não assuma que está lá.
- YAML em `.agents/agents/` é derivado: proibido editar à mão, regenere pelo agent-migrator.
- Dentro de test runner o executor `claude-cli` fica desligado por padrão, para `npm test` nunca gastar cota real (`IZANAGI_AGENT_CLI_IN_TESTS=1` libera).
- Commits em PT-BR: `chore: bump to vX.Y.Z` para bumps, `feat:`/`fix:`/`docs:` descritivos para o resto.

## Despacho de agentes e skills

Os 22 agentes em `.claude/agents/*.md` são subagents nativos (Agent tool) e o Claude Code já descobre nome e descrição de cada um: não precisa de tabela aqui. **Delegar é o padrão, responder direto como generalista é a exceção.** Force um específico com `/<slug>` (`.claude/commands/`); use `/agents` para o protocolo de swarm quando o pedido cobrir 2 ou mais domínios.

- Ideia vaga: `discovery` (entrevista e pesquisa), depois `product-reasoner` (BDD), depois `architect`.
- Requisitos prontos e decisão estrutural em aberto: `architect` (ADR), depois `senior-engineer`.
- Feature, bugfix ou refactor: `senior-engineer`. Se envolve LLM/RAG/tool-calling: `ai-engineer`.
- Antes de merge: `security` + `qa` + `techlead` **em paralelo** (cada um responde uma pergunta diferente). `adversarial-critic` só quando pedirem pontos cegos.
- Bug reincidente: `bug-hunter` (`systematic-debugging`, depois `tdd`).
- Nota objetiva PASS/FAIL contra critério já definido: `evaluator`. Revisão pedagógica do porquê: `techlead`.

Cada `.claude/agents/<slug>.md` termina numa seção **Chains** com a sequência de 3 a 9 skills daquele domínio. Acionar 1 skill e ignorar o resto da chain viola a Regra 3 do `RULES.md`. As 106 skills em `.claude/skills/<name>/SKILL.md` são descobertas automaticamente: o corpo só é lido quando a skill ativa de fato.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa pelas engines de qualidade.
- **Anti-generic, alto craft.** Nada de UI com "cara de IA": identidade bespoke por nicho; zinc-950 e glassmorphism são uma direção possível, nunca o default.
- **Zero travessão e zero hífen duplo como ornamento de texto.** Use "·", ":" ou ponto final. Hífen simples em compostos, ranges e bullets segue normal.
- **Baixo token, alto sinal.** Contexto mínimo, leitura direcionada, zero releitura.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

O que este arquivo não cobre: `AGENTS.md` (catálogo completo e release flow), `SYSTEM.md` (engines, quality gates, memória), `RULES.md` (regras operacionais), `ARCHITECTURE.md` (as 23 primitivas do runtime e o estado de cada uma), `docs/POLYGLOT.md` (contratos poliglotas).
