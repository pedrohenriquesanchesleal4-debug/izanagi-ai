---
name: task-planner
description: "Decompõe épicos em marcos, dependências e critérios de aceite mensuráveis. Use ao iniciar projetos complexos, features grandes ou refatorações profundas."
---

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

> Gerado pelo Izanagi AI — cópia fiel de `skills/task-planner/SKILL.md` (fonte da verdade).
