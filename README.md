# Izanagi AI

> **v3.18.0** · Runtime de execução de trabalho orientado a agentes: **Commander** → contrato de tarefa → roteamento por papel → grafo → verificação por evidência → healing → memória. O run **lê o projeto** antes de decidir e **entrega arquivo** no fim, os dois por nós de tool com permissão declarada. 22 agentes especializados, catálogo de skills v2, CLI publicada no npm (`izanagi-ai`), SDK programático e **topologia poliglota** (Rust · Go · Python · TypeScript) ao lado do runtime legado.

**Filosofia:** Arquitetura primeiro. Código depois. Qualidade medida. Evolução contínua. Zero "cara de IA".

---

## Instalação

Requisito: Node.js ≥ 18.

```bash
npm install -g izanagi-ai    # instalação global
npx izanagi <comando>        # ou execução direta sem instalar
izanagi --version
```

> O pacote é publicado como `izanagi-ai`; bins: `izanagi` e `izanagi-ai`.

---

## Quick Start

```bash
# 1. Inicializa um projeto com .agents/ e seleção interativa de packs de skills
izanagi init my-project
#    ou sem interação: izanagi init my-project --packs core,agents,coding,database

# 2. Executa uma tarefa. O modo é decidido pelo Commander, não fixo.
izanagi run "Converta 10 dólares para reais"                  # modo direct: 1 chamada, sem grafo
izanagi run "Criar uma landing page de um SaaS de analytics"  # modo composto, com verificação
izanagi run "..." --mode autonomous --max-cost 0.50           # teto de custo respeitado no plano
izanagi run "adicionar paginação em GET /users" --output docs # lê o projeto e entrega o arquivo

# 3. Observabilidade, custo e auditoria
izanagi trace            # spans, healing, graph, avaliação
izanagi budget <run-id>  # para onde foi o orçamento: tokens por fase, custo, cache, degradação
izanagi models           # qual modelo cada papel receberia agora, e por quanto
izanagi explain <run-id> # por que o Izanagi decidiu o que decidiu
izanagi doctor           # integridade da instalação (--deep inclui security scan das skills)
```

### Execução proporcional ao problema

O Commander classifica o objetivo (complexidade 1 a 5 + domínios) e escolhe um dos quatro modos. Antes, toda tarefa virava um grafo de 3 a 9 nós, inclusive "converta 10 dólares para reais".

| Modo | Quando | Forma |
|---|---|---|
| `direct` | tarefa trivial de um domínio | 1 chamada, sem grafo, sem crítica |
| `assisted` | tarefa simples | 1 especialista + verificação determinística |
| `orchestrated` | problema composto | grafo com verificação, sem cauda opcional |
| `autonomous` | problema amplo (5/5 ou 3+ domínios) | grafo + healing + replan + verificação final |

`--mode` força o modo. Sem override, um teto `--max-cost` faz o plano **degradar** de modo em vez de estourar o orçamento em silêncio.

### Inteligência assimétrica

Cada tarefa recebe o modelo do seu papel, não o modelo do run: `commander` (tier premium) planeja e coordena, `specialist` (balanced) executa, `worker` (fast) faz extração, formatação e validação. Uma retentativa **escala** o papel em vez de repetir o modelo que já falhou. Fixe modelos por papel em `.izanagi/izanagi.config.json`:

```json
{ "roles": { "commander": { "model": "claude-opus-4-1" },
             "specialist": { "model": "claude-sonnet-4-5" },
             "worker": { "model": "gemini-2.0-flash" } } }
```

### Verificação por evidência

Nenhuma tarefa termina porque o agente disse que terminou. Cada contrato carrega critérios de aceite derivados do schema real do artefato, e a Verification Engine devolve `VERIFIED`, `FAILED` ou `UNVERIFIED`. Critério semântico é julgado por um modelo barato (papel `worker`, artefato resumido); com `--no-judge`, ou sem provider, ele **nunca vira aprovação**: fica `UNVERIFIED`, e o run reporta isso. Juiz que não conseguiu decidir também não reprova.

Com `--prompt-only`, apenas compila `izanagi-prompt.md` para colar manualmente em outra ferramenta, sem executar nada. Nós de aprovação (`human-in-the-loop`) pausam a execução até `izanagi approve <run-id>`.

### O run lê o projeto e entrega arquivo

Dois nós do plano não chamam modelo nenhum: eles passam pela `ToolRegistry`, com permissão declarada no contrato, trust tier pela origem e política aplicada **antes** de executar.

| Nó | Quando | Permissão | O que faz |
|---|---|---|---|
| `survey` | default num diretório com manifesto reconhecido; `--no-survey` desliga | `fs:read` | Levanta stack, manifestos, árvore por extensão, entrypoints e o começo do README. O resultado entra no contexto mínimo das tarefas raiz |
| `materialize` | `--output <dir>`, e só quando o plano produz artefato que pode carregar código | `fs:write` | Escreve os arquivos que o agente declarou (`### FILE: <caminho>` + bloco de código) em `<output>/<slug>/` |
| `deliver` | `--output <dir>` | `fs:write` | Grava o que o run produziu num documento único dentro do projeto |

Nenhum nó de agente recebe permissão nenhuma: um agente não escreve, não lê arquivo e não executa comando. Há teste que percorre o plano inteiro conferindo isso nó a nó.

O survey existe porque a alternativa era pior e invisível: um agente escrevia sobre um projeto que nunca viu, inventava a stack e os caminhos, e o artefato passava na verificação — o schema pergunta se os campos existem, não se correspondem a alguma realidade. O levantamento é determinístico (não custa token), tem teto de profundidade e de entradas, e **declara o próprio corte**. Só as raízes do grafo dependem dele: repetir o mesmo levantamento em sete prompts seria a duplicação de contexto que a arquitetura proíbe.

A materialização tem uma fronteira que a torna defensável: os arquivos vão para um subdiretório da saída, **nunca por cima do código do projeto**. Aplicar sobre a fonte exigiria uma garantia que nenhuma verificação determinística consegue dar hoje; quem quer aplicar revisa e copia — e é aí que uma pessoa olha o diff. A escrita é **tudo ou nada**: a validação roda sobre o manifesto inteiro antes de qualquer arquivo tocar o disco, porque "6 arquivos escritos, 3 recusados" é o relatório que engana. Arquivo vazio, caminho absoluto, escape de diretório e marca de trabalho não feito (`TODO`, `FIXME`, `implement later`) recusam o manifesto inteiro.

A entrega muda o que a verificação significa. Um critério `file-exists` sobre um arquivo que ninguém escreveu passa quando o arquivo já existia por outro motivo; aqui o arquivo é gravado pela `ToolRegistry` e conferido depois, então o critério passa a significar "o runtime gravou isto". O nome do arquivo sai do objetivo, então repetir o mesmo objetivo reescreve a mesma entrega em vez de acumular um arquivo por execução — entrega é produto, e o histórico continua em `.izanagi/state/`.

### SDK

```ts
import { izanagi } from 'izanagi-ai';

// Estimar antes de gastar: nenhum token é consumido aqui.
const plan = izanagi.plan({ objective: 'auditar a API de login' });
console.log(plan?.mode, plan?.estimate.maxCostUsd);

const run = izanagi.run({
  objective: 'auditar a API de login',
  budget: { maxCost: 0.5 },
  output: 'docs',   // grava a entrega em <baseDir>/docs; fora da raiz, run() rejeita antes de planejar
  // survey: false  // default: ligado quando baseDir tem manifesto reconhecido
});
run.on('task:start', (e) => console.log(e.data));
const result = await run;
console.log(result.status, result.telemetry?.estimatedCostUsd, result.verification);
console.log(result.deliveredTo);  // só presente quando a gravação REALMENTE aconteceu
```

---

## Arquitetura Poliglota

O crescimento novo vive numa topologia poliglota que coexiste com o runtime npm legado em padrão Strangler Fig (ADR-001): contratos IPC, error codes e env vars canônicos em [`docs/POLYGLOT.md`](docs/POLYGLOT.md).

| Componente | Linguagem | O que faz | Como testar |
|---|---|---|---|
| `crates/izanagi_core` | Rust | Quality engine: 7 heurísticas anti-slop sobre TS/Python/Go; protocolo NDJSON stdin/stdout (`validate`/`rules`/`version`) + op `scan-rationalizations`; bindings WASM feature-gated | `cargo test --workspace` (126 testes declarados no fonte) |
| `crates/izanagi_mcp` | Rust | Cliente MCP JSON-RPC 2.0 sobre stdio: discovery + invocação pontual (`izanagi-mcp call --tool=<name>`) | incluso no `cargo test --workspace` |
| `go-services/swarm_orchestrator` | Go | Orquestrador de swarm (Uber Fx): pipeline architect→engineer→qa→security via JSON-RPC 2.0 sobre UDS com event push | `go build ./... && go vet ./... && go test ./...` |
| `python-engine/ast_analyzer` | Python ≥ 3.10 | Análise semântica multilíngue: símbolos, complexidade ciclomática, imports (tree-sitter + fallback estrutural) | `.venv/bin/python -m pytest tests/ -q` (41 testes) |
| `packages/sdk` (`@izanagi/sdk`) | TypeScript | Clientes tipados strict para os 4 núcleos + catálogo de skills; zero dependências de runtime | `npm test` dentro de `packages/sdk` (42 testes) |
| `packages/cli` (`izanagi-next`) | TypeScript | CLI de nova geração: run em 4 fases com auto-heal (N=2) + gate anti-racionalização; `agent list`, `skill list/show --ref`, `gates check` | `npm test` dentro de `packages/cli` (13 testes) |

Diagnóstico rápido de todos os componentes:

```bash
izanagi polyglot status          # saúde dos núcleos poliglotas (--json | --strict)
node packages/agent-migrator/cli.mjs --check   # drift YAML ↔ JSON dos agentes
node packages/skill-migrator/cli.mjs --dry-run # valida migração skills v1 → v2 sem escrever
```

### Estrutura do Repositório

```text
izanagi-ai/
├── bin/                        Executável da CLI legado (bin/izanagi.js → dist/cli)
├── src/                        Runtime real em TypeScript (orchestrator, evaluation, resolver, scanner, factories, tools, tracer, llm, cli)
├── core/                       Engines (.md) + skill-resolver.json (aliases → targets + compositions)
├── agents/                     22 definições de agentes em JSON (fonte da verdade dos comandos)
├── skills/                     Skills legado v1 (skills/<name>/SKILL.md + references.md opcional)
├── .skills/                    Catálogo ativo v2 (.skills/<name>/SKILL.md + references/)
├── crates/                     Rust: izanagi_core (quality engine + WASM) e izanagi_mcp (cliente MCP stdio)
├── go-services/swarm_orchestrator/  Orquestrador de swarm em Go (Uber Fx, JSON-RPC 2.0 sobre UDS)
├── python-engine/              Analisador AST multilíngue (tree-sitter + fallback estrutural)
├── packages/                   sdk (@izanagi/sdk) · cli (izanagi-next) · agent-migrator · skill-migrator
├── references/                 Curadoria de referências reais por domínio (webgl-3d, scrollytelling, stack-2026...)
├── .agents/memoria/            Memória persistente anti-repetição (contexto, decisoes, erros-corrigidos, learnings)
├── .opencode/                  Comandos slash do Opencode (adapters em .claude/, .codex/, .cursor/...)
├── docs/POLYGLOT.md            Contratos IPC, error codes, env vars e resumo dos ADRs
├── AGENTS.md                   Instruções de operação do framework
├── ARCHITECTURE.md             Visão arquitetural
├── SYSTEM.md                   Fundação do sistema (arquitetura real do runtime)
└── RULES.md                    Regras operacionais (Anti-Generic High-Craft & Cinematic UI)
```

---

## Comandos Principais da CLI

CLI legado (`izanagi`, publicada no npm):

| Comando | Descrição |
|---|---|
| `izanagi init [dir] [--packs a,b,c]` | Cria projeto com `.agents/` e seleção de packs de skills. |
| `izanagi run [agent] --task "<task>"` | Commander decide o modo, roteia por papel, executa o grafo, verifica contra os critérios de aceite e persiste trace + telemetria de custo. Flags: `--mode direct\|assisted\|orchestrated\|autonomous`, `--budget N`, `--max-cost N`, `--model <id>`, `--local` (só providers locais, e serializa o pool: GPU única não ganha com paralelismo), `--max-concurrency N` (teto de tarefas em voo), `--cache`, `--output <dir>` (grava a entrega no projeto), `--survey` / `--no-survey` (força ou desliga o levantamento do projeto antes de decidir). **Ctrl-C cancela o run** em vez de matar o processo: o batch em voo é abortado, o progresso já gravado fica no checkpoint e `izanagi resume <run-id>` retoma dali, `--no-commander` (planejamento legado por categoria), `--no-judge` (desliga o juiz semantico), `--prompt-only`. |
| `izanagi models [--json]` | Catálogo de modelos, providers configurados e qual modelo cada papel (commander/specialist/worker) receberia agora, com custo por 10k tokens. |
| `izanagi budget [run-id] [--json]` | Para onde foi o orçamento daquele run: tokens por fase, custo estimado, cache local e do provider, contexto poupado, escaladas, degradação e verificação por tarefa. |
| `izanagi chat` | REPL interativo da CLI. |
| `izanagi dashboard [--port N]` | Dashboard local (Run Explorer, Arena, Memory). |
| `izanagi agent create "<requisito>" [--name=slug] [--skills=a,b]` | Agent Factory: gera agente com genome completo em `agents/generated/` (detecta lacuna vs. 22 core). |
| `izanagi agent list \| inspect <name>` | Lista/inspeta agentes (inclui `agents/generated/`) com genome. |
| `izanagi skill create <nome> --gap="<descrição>" [--force]` | Skill Factory: cria skill com frontmatter, security scan pré-escrita e recusa de lacuna já coberta. |
| `izanagi skill list \| search <q> \| inspect <name>` | Lista, busca e detalha skills (catálogo v2, com progressive disclosure). |
| `izanagi create <agent\|skill> <name>` | Cria scaffold cru de agente (JSON) ou skill (SKILL.md), sem validação. |
| `izanagi compile <agente> [arquivo]` | Compila um System Prompt completo do agente + fundação do sistema. |
| `izanagi workflow list \| inspect <template>` | Templates de grafo de execução por categoria (10). |
| `izanagi eval <file.json> \| --metrics ... \| --report <run-id>` | Evaluation Engine: métricas ponderadas + veredito (PASS/.../UNKNOWN). |
| `izanagi benchmark [run\|tokens\|compare]` | 10 benchmarks builtin + comparação de regressões entre builds. `tokens` compara o plano do runtime legado com o do Commander (chamadas, tokens e custo, de forma determinística). Alias histórico: `arena`. |
| `izanagi trace [run-id]` | Traces de execução (spans, healing, graph, avaliação). |
| `izanagi memory inspect \| search <q>` | Estado da memória de execução e busca em `.agents/memoria/`. |
| `izanagi polyglot status [--json\|--strict]` | Saúde dos núcleos poliglotas (Rust, Go, Python, packages TS): checagens de existência + probes baratos; `--strict` sai com código 1 se algo estiver ausente. |
| `izanagi doctor [--deep]` | Auditoria de integridade; `--deep` adiciona security scan das skills. |
| `izanagi diagnose` | Diagnóstico profundo do runtime (state, agent genome, contratos de artifact). |
| `izanagi resume <run-id>` | Retoma execução interrompida (crash) ou pausada a partir do checkpoint: sem replanejar nem reexecutar nós concluídos. |
| `izanagi approve <run-id> [node-id]` | Aprova uma ação de alto risco pausada (nó `kind: 'approval'`) e retoma. |
| `izanagi reject <run-id> [node-id] [--reason]` | Rejeita a ação pausada (o nó falha com o motivo) e retoma: self-healing/abort seguem normalmente. |
| `izanagi explain <run-id>` | Por que o Izanagi decidiu isso: decisões (Decision Journal) + conversa entre agentes + self-healing + veredito, sem chain-of-thought. `--artifacts` mostra o conteúdo produzido, `--conversation` o log A2A inteiro. |
| `izanagi export --cli <cli>` | Regenera adapters multi-CLI (opencode, claude, codex, cursor, copilot, kimi, all). Idempotente. |
| `izanagi --version` | Exibe a versão da CLI. |

CLI de nova geração (`izanagi-next`, em `packages/cli`, requer Node ≥ 22): pipeline de agentes sobre os núcleos poliglotas, com gate anti-racionalização via Rust core e auto-heal (N=2 tentativas) no run em 4 fases.

```bash
cd packages/cli && npm install && npm run build
node dist/cli/src/index.js run --agent=architect --task="Design a caching layer"
node dist/cli/src/index.js agent list
node dist/cli/src/index.js skill list --category=rust   # ou --search=<termo>
node dist/cli/src/index.js skill show <nome> --ref=<arquivo>
node dist/cli/src/index.js gates check <file>
```

---

## Skills & Agentes

**22 agentes especializados** (`agents/*.json`, fonte da verdade): `/discovery`, `/product-reasoner`, `/architect`, `/senior-engineer`, `/ai-engineer`, `/techlead`, `/automation-engineer`, `/security`, `/devops`, `/database`, `/qa`, `/bug-hunter`, `/docs`, `/pm`, `/professor`, `/researcher`, `/evaluator`, `/adversarial-critic`, `/form-engineer`, `/animation`, `/agent-architect`, `/skill-architect`. Cada um carrega um Agent Genome de 13 campos e chains compostas; a tabela completa com papéis está em [`AGENTS.md`](AGENTS.md).

**Skills**: 106 módulos legado v1 (`skills/`) e o catálogo ativo **v2** (`.skills/<name>/SKILL.md`), ambos distribuídos no pacote npm. O formato v2 usa front-matter estruturado:

```yaml
---
name: "anti-ai-slop"
description: "Detecta e corrige design 'cara de IA'..."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
references:
  - "references.md"
---
```

Seguido de seções fixas: *Triggering Criteria*, *Step-by-Step Workflow*, *Verification Steps*, *Common Rationalizations* e *Red Flags*. O consumo é por **progressive disclosure** (`izanagi skill inspect`, ou `izanagi-next skill show`, carrega só o módulo necessário); skills nunca rodam isoladas — encadeiam via `compositions` do `core/skill-resolver.json` (258 aliases, 16 composições).

---

## Desenvolvimento

Ordem importa: `dist/` é gitignored e `bin/izanagi.js` importa de `../dist/cli/index.js` — rode `npm run build` antes de qualquer comando CLI local (`doctor`, `polyglot status`, `export`...), senão roda código obsoleto ou quebra. O mesmo vale para `packages/*/dist`.

```bash
# Legado npm (raiz)
npm install
npm run build       # tsc && node dist/scripts/generate-manifest.js
npm test            # build + node --test dist/runtime/tests/*.test.js (764 testes)
npm run verify      # build + teste de instalação em sandbox (passa todos os pack IDs)
npm run doctor      # node bin/izanagi.js doctor [--deep]

# Núcleos poliglotas
cargo test --workspace                                        # Rust: core + mcp (126 testes declarados no fonte)
cargo check -p izanagi_core --features wasm                   # type-check dos bindings WASM
(cd go-services/swarm_orchestrator && go build ./... && go vet ./... && go test ./...)
(cd python-engine && python -m venv .venv && .venv/bin/python -m pip install -r requirements-dev.txt)  # o venv NAO e versionado
(cd python-engine && .venv/bin/python -m pytest tests/ -q)     # 41 testes
(cd packages/sdk && npm install && npm test)                  # 42 testes
(cd packages/cli && npm install && npm test)                  # 13 testes
```

Requisitos por componente: Node ≥ 18 (raiz) e ≥ 22 nos pacotes novos, Rust stable, Go 1.26, Python ≥ 3.10.

### Publicando no NPM

CD exclusivo de tag `v*` (`.github/workflows/publish.yml`): bump → commit → tag → push; o workflow publica com provenance OIDC (SLSA v1). Localmente, o fluxo manual permanece:

```bash
npm run bump:patch   # ou bump:minor / bump:major
npm publish          # prepublishOnly roda o build automaticamente
```

CI (`.github/workflows/polyglot.yml`): 6 jobs paralelos em push/PR para `main` — legacy-npm, rust (clippy+test+wasm check), wasm-build E2E, go, python, ts-packages.

---

## Trabalho agendado (sem servidor)

O Izanagi é local-first por decisão: não existe daemon, porta escutando nem credencial em repouso. Quem agenda é o cron ou o Task Scheduler do sistema.

```bash
izanagi run "auditar dependências e abrir relatório" --json --notify-webhook=https://exemplo/hook
```

| | |
|---|---|
| `--json` | Um único objeto JSON no stdout. A saída humana é silenciada; `console.error` continua vivo, porque erro real precisa chegar ao stderr do agendador. |
| código de saída | `0` concluiu · `1` falhou · `2` aguarda decisão humana. Aguardar aprovação não é falha e não deve alertar como falha. |
| `--notify-webhook=<url>` | POST de fim de run, uma retentativa. `4xx` não é repetido (configuração errada não melhora repetindo), `5xx` é. Falha de notificação nunca derruba o run. |

O webhook leva **metadado**: status, score, tokens, custo, verificação por tarefa e nomes de artefato. **Nunca o conteúdo produzido** — um endpoint de notificação costuma ser um canal de equipe ou um serviço que ninguém auditou. Para o conteúdo, `izanagi explain <run-id> --artifacts`, na máquina onde o run aconteceu.

## Documentação

| Documento | Conteúdo |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Reference operacional: os 22 agentes, comandos, gotchas de desenvolvimento e release flow. |
| [`docs/POLYGLOT.md`](docs/POLYGLOT.md) | Contratos IPC entre núcleos, error codes JSON-RPC, tabela de env vars, gaps conhecidos e resumo dos ADRs. |
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Passagem completa da rearquitetura v3.13.0 → v3.18.0: o que mudou, onde cada coisa vive, decisões e por quê, bugs encontrados, números medidos e por onde continuar. **Comece por aqui** se pegou o repositório sem contexto. |
| [`docs/RUNTIME-PENDING.md`](docs/RUNTIME-PENDING.md) | Nenhum item aberto: a tabela do que foi fechado, em qual commit e como, mais as limitações que são escolha com motivo registrado. |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | Visão arquitetural do framework e da topologia poliglota. |
| [`CONTRIBUTING.md`](CONTRIBUTING.md) | Guia de contribuição: convenções, fluxo de PR e padrões do repo. |
| [`ROADMAP.md`](ROADMAP.md) | Planejamento de evolução por waves e marcos. |
| [`SYSTEM.md`](SYSTEM.md) / [`RULES.md`](RULES.md) | Fundação do runtime e regras operacionais (Anti-Generic High-Craft & Cinematic UI). |
| [`CHANGELOG.md`](CHANGELOG.md) | Histórico de versões. |

---

## Licença

MIT: Use, modifique, distribua. Apenas mantenha os créditos.
