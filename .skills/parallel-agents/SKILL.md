---
name: "parallel-agents"
description: "Orquestra agentes em paralelo (fan-out/swarm): decompõe tarefas complexas em frentes independentes e agrega resultados por artefatos em disco. Use em pedidos complexos ou multi-domínio. Gatilhos de ativação: parallel agents (fan-out & swarm orchestration); quando usar; arquitetura do swarm (5 passos); exemplo de matriz de despacho paralelo."
version: 2.0.0
category: ai
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
    - mcp:execute_command
---

# Parallel Agents (Fan-Out & Swarm Orchestration)

> Migrado deterministicamente de `skills/parallel-agents/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** IA & Agentes (`ai`)
- **Resumo:** Orquestra agentes em paralelo (fan-out/swarm): decompõe tarefas complexas em frentes independentes e agrega resultados por artefatos em disco.
- **Ativar quando:** Use em pedidos complexos ou multi-domínio.
- **Escopo canônico:** Parallel Agents (Fan-Out & Swarm Orchestration)
- **Seções do corpo original:** Quando usar · Arquitetura do Swarm (5 Passos) · Exemplo de Matriz de Despacho Paralelo · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Decomposição de Tarefas (Task Decomposition)

Divida o pedido em frentes ortogonais que não gerem conflito direto de escrita no mesmo arquivo:
- *Frente 1*: Schema e Database (`database`)
- *Frente 2*: API Backend (`senior-engineer`)
- *Frente 3*: UI / Design System (`frontend` + `animation`)
- *Frente 4*: Autenticação e Segurança (`security`)
- *Frente 5*: Suíte de Testes E2E (`qa`)

### Passo 2 — Isolamento de Contexto (Context Isolation)

Cada agente especialista recebe **apenas o contexto da sua frente** (o contrato de API, o schema do banco ou os design tokens) — nunca o histórico gigante da conversa inteira. Isso preserva a janela de contexto e maximiza a precisão.

### Passo 3 — Execução Concorrente (Fan-Out)

Dispare os agentes em paralelo para operar em suas frentes sem gargalos sequenciais.

### Passo 4 — Coordenação por Artefatos em Disco (Shared Artifacts)

Os agentes não passam dados gigantes conversando no chat. Eles escrevem artefatos canônicos no workspace (ex: `prisma/schema.prisma`, `src/types/api.ts`, `tailwind.config.js`), que servem de contrato de integração para as demais frentes.

### Passo 5 — Unificação e Quality Gates (Merge & Validate)

O orquestrador agrega as entregas, executa o build integrado, roda a suíte de QA e audita contra as regras de anti-AI-slop e segurança.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Tarefa decomposta em frentes limpas e ortogonais
- [ ] Isolamento de contexto aplicado a cada agente especialista
- [ ] Coordenação baseada em arquivos/artefatos canônicos em disco
- [ ] Build e testes integrados validados após o merge

## Common Rationalizations

- **"Modelo moderno entende sozinho, prompt detalhado é desperdício."**
  - Verdade: Sem few-shot, formato de saída estrito e guardrails, o output é probabilístico e imprevisível. Prompt engineering é especificação de comportamento — não decoração.
- **"Resposta plausível, então tá correto."**
  - Verdade: Plausibilidade é o produto, não a prova. Sem avaliação (dataset, critério, comparação), você está validando retórica — hallucinação apresentada como fato é falha classificada do framework.
- **"Embedding/recuperação ruim? Troco o modelo maior."**
  - Verdade: Trocar modelo mascara problema de chunking, consulta e qualidade de dados — e multiplica custo. Diagnostique o pipeline RAG antes de escalar o modelo.
- **"Jogo tudo no contexto, janela hoje é gigante."**
  - Verdade: Contexto inflado custa dinheiro, latência e atenção do modelo (lost in the middle). Economia de tokens é disciplina: contexto mínimo, cache, janela deslizante.
- **"Tool call retornou algo, sigo em frente."**
  - Verdade: Output de tool sem schema validado é dado não confiável entrando no raciocínio. Validar resposta é o mesmo anti-falhas de qualquer integração — LLM não é exceção.
- **"Prompt injection é teórico, meu caso é fechado."**
  - Verdade: Todo texto que entra pelo usuário/documento recuperado é superfície de injection. Fechado significa menos vetores, não zero — defesa custa uma instrução e um filtro.

## Red Flags

- Feature de LLM sem dataset/critério de avaliação (qualidade não medida).
- RAG respondendo sem citação/rastreabilidade da fonte recuperada.
- Tool/MCP exposto sem schema de entrada validado nem limite de escopo.
- Chamada de modelo sem timeout, retry criterioso ou budget de custo.
- Output do modelo parseado com confiança cega (sem validação estrutural).
- Instrução de sistema concatenada com input de usuário sem isolamento.
- Agente com efeito real no mundo sem dry-run nem confirmação de ação irreversível.

## Legacy Reference (v1)

# Parallel Agents (Fan-Out & Swarm Orchestration)

Arquitetura de execução paralela concorrente (*Fan-Out Swarm*): decompõe problemas complexos em **frentes de trabalho independentes**, despacha cada frente para o agente especialista ideal com contexto isolado, e unifica os resultados por meio de **artefatos compartilhados em disco**.

## Quando usar

Use ao: desenvolver aplicações completas (SaaS, sistemas complexos com frontend, backend, banco, testes e segurança); executar tarefas que exigem múltiplos domínios técnicos simultâneos. **Pule** para: tarefas focadas e lineares de domínio único (ex: refatorar uma função, corrigir um bug pontual).

## Arquitetura do Swarm (5 Passos)

### 1. Decomposição de Tarefas (Task Decomposition)
Divida o pedido em frentes ortogonais que não gerem conflito direto de escrita no mesmo arquivo:
- *Frente 1*: Schema e Database (`database`)
- *Frente 2*: API Backend (`senior-engineer`)
- *Frente 3*: UI / Design System (`frontend` + `animation`)
- *Frente 4*: Autenticação e Segurança (`security`)
- *Frente 5*: Suíte de Testes E2E (`qa`)

### 2. Isolamento de Contexto (Context Isolation)
Cada agente especialista recebe **apenas o contexto da sua frente** (o contrato de API, o schema do banco ou os design tokens) — nunca o histórico gigante da conversa inteira. Isso preserva a janela de contexto e maximiza a precisão.

### 3. Execução Concorrente (Fan-Out)
Dispare os agentes em paralelo para operar em suas frentes sem gargalos sequenciais.

### 4. Coordenação por Artefatos em Disco (Shared Artifacts)
Os agentes não passam dados gigantes conversando no chat. Eles escrevem artefatos canônicos no workspace (ex: `prisma/schema.prisma`, `src/types/api.ts`, `tailwind.config.js`), que servem de contrato de integração para as demais frentes.

### 5. Unificação e Quality Gates (Merge & Validate)
O orquestrador agrega as entregas, executa o build integrado, roda a suíte de QA e audita contra as regras de anti-AI-slop e segurança.

## Exemplo de Matriz de Despacho Paralelo

```yaml
swarm_dispatch:
  tarefa: "SaaS de Gestão Financeira"
  frentes:
    - agente: "database"
      frente: "Modelagem Prisma (schema, migrations)"
      artefato: "prisma/schema.prisma"
    - agente: "senior-engineer"
      frente: "API Endpoints & Services"
      artefato: "src/app/api/"
    - agente: "animation"
      frente: "Landing Page Cinematográfica com Scrollytelling"
      artefato: "src/components/landing/"
    - agente: "security"
      frente: "Middlewares de Auth & Rate Limit"
      artefato: "src/middleware.ts"
```

## Checklist de qualidade (antes de entregar)
- [ ] Tarefa decomposta em frentes limpas e ortogonais
- [ ] Isolamento de contexto aplicado a cada agente especialista
- [ ] Coordenação baseada em arquivos/artefatos canônicos em disco
- [ ] Build e testes integrados validados após o merge

## Anti-padrões (proibido)
1. ❌ Abordagem monolítica: tentar resolver um sistema completo com um único agente em turnos sequenciais lentos
2. ❌ Conflito de escrita: dois agentes editando exatamente o mesmo arquivo ao mesmo tempo sem contrato prévio
3. ❌ Passar históricos gigantes e ruidosos entre agentes no chat

## Composição com outras skills
- **Antes**: `/agents` (orquestrador) → `brainstorming` (descoberta e blueprint)
- **Depois**: `self-critique` (revisão unificada) → `qa` (validação integrada)

## References
- Parallel agent orchestration patterns (Fastio / Odea Works 2026) · obra/superpowers dispatching pattern.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
