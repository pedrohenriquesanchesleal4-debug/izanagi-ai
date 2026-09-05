---
name: parallel-agents
description: "Orquestra agentes em paralelo (fan-out/swarm): decompõe tarefas complexas em frentes independentes e agrega resultados por artefatos em disco. Use em pedidos complexos ou multi-domínio."
triggers:
  - "pedido cobre dois ou mais domínios independentes"
  - "decompor tarefa complexa em frentes paralelas"
  - "agregar resultado de vários agentes"
capabilities:
  - "fan-out"
  - "swarm-orchestration"
  - "result-aggregation"
  - "domain-decomposition"
---

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
