---
name: "setup-recommender"
description: "Analisa o projeto e o ambiente do agente e recomenda o setup mínimo que rende: quais agentes e skills do Izanagi ligar, quais hooks, MCPs e plugins valem para esta stack, e quais plugins globais estão só ocupando contexto. Use ao instalar o Izanagi num projeto, quando o agente parecer lento, caro ou ignorando skills, ou quando o usuário perguntar o que instalar. Gatilhos de ativação: setup recommender: o setup mínimo que rende; quando usar; passo 1: detectar a stack (sem ler o código inteiro); passo 2: medir o orçamento de contexto."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Setup Recommender: o setup mínimo que rende

> Migrado deterministicamente de `skills/setup-recommender/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Analisa o projeto e o ambiente do agente e recomenda o setup mínimo que rende: quais agentes e skills do Izanagi ligar, quais hooks, MCPs e plugins valem para esta stack, e quais plugins globais estão só ocupando contexto.
- **Ativar quando:** Use ao instalar o Izanagi num projeto, quando o agente parecer lento, caro ou ignorando skills, ou quando o usuário perguntar o que instalar.
- **Escopo canônico:** Setup Recommender: o setup mínimo que rende
- **Seções do corpo original:** Quando usar · Passo 1: detectar a stack (sem ler o código inteiro) · Passo 2: medir o orçamento de contexto · Passo 3: recomendar · Regras
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Ligar:

**Ligar**: agentes e skills do Izanagi que casam com a stack (ex.: Next.js + Prisma → `senior-engineer`, `database`, `react-next-practices`, `data-engineering`, `site-launch-checklist`).

### Passo 2 — Desligar ou não instalar:

**Desligar ou não instalar**: plugins/skills globais sem relação com a stack ou que duplicam skills do Izanagi (ex.: três coleções diferentes de "code review").

### Passo 3 — Considerar:

**Considerar**: hooks e MCPs com ganho claro para este repo (filtro de saída de terminal, mapa do código, MCP do banco ou do Figma), com custo e risco.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Setup Recommender: o setup mínimo que rende

Mais skills e plugins não é mais capacidade. Toda skill instalada coloca nome e descrição no contexto de toda sessão; acima do orçamento, as excedentes aparecem só com o nome e o agente para de escolhê-las. Esta skill mede o que está instalado contra o que o projeto usa.

## Quando usar

Na instalação do Izanagi, quando o usuário reclamar de custo ou de skills ignoradas, ou antes de adicionar mais plugins.

## Passo 1: detectar a stack (sem ler o código inteiro)

`package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Dockerfile`, pastas de teste, framework de UI, banco (prisma/drizzle/migrations), CI. Saída: 5 a 10 linhas.

## Passo 2: medir o orçamento de contexto

| CLI | Onde contar |
|---|---|
| Claude Code | `.claude/skills/*/SKILL.md`, `~/.claude/skills`, plugins em `~/.claude/plugins` |
| Antigravity | `agy agents`, `.agents/skills`, `.agents/skills.json`, `~/.gemini/config/plugins/*` |
| Codex / OpenCode | `.codex/`, `.opencode/agent`, configs globais |

Conte skills totais e duplicadas (mesmo nome em lugares diferentes). Acima de ~150 skills visíveis, há corte; acima de ~300, as do projeto quase certamente somem. No Antigravity dá para confirmar perguntando ao agente se a skill aparece na lista "excluded due to context budget".

## Passo 3: recomendar

Três listas, cada item com uma linha de motivo:

1. **Ligar**: agentes e skills do Izanagi que casam com a stack (ex.: Next.js + Prisma → `senior-engineer`, `database`, `react-next-practices`, `data-engineering`, `site-launch-checklist`).
2. **Desligar ou não instalar**: plugins/skills globais sem relação com a stack ou que duplicam skills do Izanagi (ex.: três coleções diferentes de "code review").
3. **Considerar**: hooks e MCPs com ganho claro para este repo (filtro de saída de terminal, mapa do código, MCP do banco ou do Figma), com custo e risco.

## Regras

- Recomende; **não desinstale nem desative** nada global sem o usuário pedir. Plugins globais afetam todos os projetos dele.
- Prefira desativar a desinstalar (é reversível): `agy plugin disable <nome>`, `/plugin` no Claude Code.
- Reavalie após mudança grande de stack.
