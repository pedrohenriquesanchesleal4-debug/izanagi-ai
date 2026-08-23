---
name: "task-planner"
description: "Decompõe épicos em marcos, dependências e critérios de aceite mensuráveis. Use ao iniciar projetos complexos, features grandes ou refatorações profundas. Gatilhos de ativação: task planner (planejamento hierárquico de engenharia); quando usar; estrutura do plano de tarefas (template izanagi); workflow de planejamento (4 passos)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Task Planner (Planejamento Hierárquico de Engenharia)

> Migrado deterministicamente de `skills/task-planner/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Decompõe épicos em marcos, dependências e critérios de aceite mensuráveis.
- **Ativar quando:** Use ao iniciar projetos complexos, features grandes ou refatorações profundas.
- **Escopo canônico:** Task Planner (Planejamento Hierárquico de Engenharia)
- **Seções do corpo original:** Quando usar · Estrutura do Plano de Tarefas (Template Izanagi) · Workflow de Planejamento (4 passos) · Checklist de qualidade (antes de iniciar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Decomposição Top-Down:

**Decomposição Top-Down**: Quebre o épico em 3 a 5 marcos lógicos.

### Passo 2 — Granularidade de Tarefas:

**Granularidade de Tarefas**: Cada tarefa deve durar entre 15 minutos e 2 horas de execução de agente/dev.

### Passo 3 — Mapeamento de Dependências:

**Mapeamento de Dependências**: Identifique qual tarefa bloqueia qual, evitando conflitos de execução em paralelo.

### Passo 4 — Critérios de Aceite Mensuráveis:

**Critérios de Aceite Mensuráveis**: Cada tarefa tem uma condição binária de conclusão ("passou no teste X" vs "feito").

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Objetivo do épico claro em 1 frase
- [ ] Marcos sequenciados sem dependências circulares
- [ ] Tarefas granulares (máximo 2h cada)
- [ ] Critérios de aceite verificáveis e objetivos

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

# Task Planner (Planejamento Hierárquico de Engenharia)

Metodologia de planejamento para decompor grandes objetivos de engenharia em **marcos executáveis, dependências sequenciais e critérios de aceite mensuráveis** — garantindo execução sem surpresas e visibilidade total do progresso.

## Quando usar

Use ao: iniciar projeto ou SaaS novo; planejar feature complexa com múltiplos módulos; organizar refatoração profunda. **Pule** para: correção de bug pontual ou tarefa simples de 1 passo.

## Estrutura do Plano de Tarefas (Template Izanagi)

```yaml
task_plan:
  projeto: "Nome do Épico / Feature"
  objetivo: "1 frase descrevendo a entrega de valor"
  marcos:
    - marco: "1. Fundação & Dados"
      tarefas:
        - id: "1.1"
          titulo: "Criar schema Prisma e migrações"
          estimativa: "30m"
          dependencia: []
          criterio_aceite: "Schema migrado sem erro no banco de dev"
        - id: "1.2"
          titulo: "Seed de dados iniciais"
          estimativa: "15m"
          dependencia: ["1.1"]
          criterio_aceite: "Banco populado com dados de teste válidos"

    - marco: "2. API Backend"
      tarefas:
        - id: "2.1"
          titulo: "Rotas CRUD de recursos"
          estimativa: "45m"
          dependencia: ["1.2"]
          criterio_aceite: "Testes unitários cobrindo 100% dos endpoints"
```

## Workflow de Planejamento (4 passos)

1. **Decomposição Top-Down**: Quebre o épico em 3 a 5 marcos lógicos.
2. **Granularidade de Tarefas**: Cada tarefa deve durar entre 15 minutos e 2 horas de execução de agente/dev.
3. **Mapeamento de Dependências**: Identifique qual tarefa bloqueia qual, evitando conflitos de execução em paralelo.
4. **Critérios de Aceite Mensuráveis**: Cada tarefa tem uma condição binária de conclusão ("passou no teste X" vs "feito").

## Checklist de qualidade (antes de iniciar)
- [ ] Objetivo do épico claro em 1 frase
- [ ] Marcos sequenciados sem dependências circulares
- [ ] Tarefas granulares (máximo 2h cada)
- [ ] Critérios de aceite verificáveis e objetivos

## Anti-padrões (proibido)
1. ❌ Tarefas vagas ("fazer o backend", "arrumar o frontend") sem escopo fechado
2. ❌ Ignorar dependências entre tarefas (começar o front sem o contrato de API)
3. ❌ Ausência de critérios de aceite mensuráveis

## Composição com outras skills
- **Antes**: `discovery` (entrevista e requisitos) → `architect` (arquitetura)
- **Depois**: `parallel-agents` (despacho das frentes planejadas) → `agentic-coding` (execução)

## References
- Agile Planning & WBS (Work Breakdown Structure): PMI / Scrum Guide.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
