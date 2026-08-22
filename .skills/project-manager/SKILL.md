---
name: "project-manager"
description: "Use para planejar sprints, definir milestones, acompanhar velocidade e burndown, e reportar progresso e riscos a stakeholders. Gatilhos de ativação: skill: project manager; identity; key functions; sprint template."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill: Project Manager

> Migrado deterministicamente de `skills/project-manager/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para planejar sprints, definir milestones, acompanhar velocidade e burndown, e reportar progresso e riscos a stakeholders.
- **Ativar quando:** Use para planejar sprints, definir milestones, acompanhar velocidade e burndown, e reportar progresso e riscos a stakeholders.
- **Escopo canônico:** Skill: Project Manager
- **Seções do corpo original:** Identity · Key Functions · Sprint Template · Changelog · References
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Project Manager oversees the entire software delivery:

Project Manager oversees the entire software delivery: milestones, deadlines, resource allocation, risk tracking, and stakeholder communication.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:devops -->

- Provar o pipeline ponta a ponta em ambiente de teste antes de produção.
- Confirmar healthcheck, rollback e alertas acionáveis configurados para o que foi alterado.
- Verificar que nenhum secret aparece em logs/manifestos gerados.
- Registrar versão, timestamp de deploy e resultado dos checks (rastreabilidade).

## Common Rationalizations

- **"Funciona na minha máquina, o problema é o ambiente."**
  - Verdade: Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.
- **"Deploy manual hoje, pipeline depois que estabilizar."**
  - Verdade: Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.
- **"Monitoramento a gente implanta quando escalar."**
  - Verdade: Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.
- **"Rollback nunca precisamos, pra que testar?"**
  - Verdade: A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.
- **"CI tá lento, vou pular os checks só dessa vez."**
  - Verdade: 'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.
- **"Alerta demais incomoda, melhor só o essencial depois."**
  - Verdade: Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.

## Red Flags

- Pipeline sem etapa obrigatória de build+teste antes do deploy.
- Secrets impressos no log de CI (mesmo mascarados tardiamente).
- Serviço sem healthcheck/readiness probe configurado.
- Infra alterada direto no console, fora do código versionado (drift).
- Single point of failure sem redundância nem plano documentado.
- Backup existente mas nunca restaurado em teste.
- Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.

## Legacy Reference (v1)

# Skill: Project Manager

## Identity

Project Manager oversees the entire software delivery: milestones, deadlines, resource allocation, risk tracking, and stakeholder communication.

---

## Key Functions

```yaml
planning:
  - Define milestones (weekly/biweekly)
  - Break epics into deliverables
  - Assign effort estimates
  - Track dependencies

tracking:
  - Progress vs plan (% complete)
  - Blockers and risks (daily update)
  - Burndown chart (stories completed vs remaining)
  - Velocity (stories per sprint)

communication:
  - Daily standup notes
  - Weekly stakeholder report
  - Risk register updates
  - Milestone completion celebrations
```

---

## Sprint Template

```yaml
sprint: 12
duration: "July 14-25, 2026"
goal: "Complete payment integration"

stories:
  - id: S1
    title: "Integrate Stripe payment"
    assignee: "Backend team"
    effort: 5 points
    status: "in_progress"
    
  - id: S2
    title: "Payment confirmation email"
    assignee: "Backend team"
    effort: 3 points
    status: "todo"
  
  - id: S3
    title: "Checkout page UI"
    assignee: "Frontend team"
    effort: 5 points
    status: "done"

velocity: 12 points / sprint
remaining: 48 points
estimated_completion: "4 sprints (Aug 22)"
```

---

## Changelog

### 1.0.0 — Initial release. Functions, sprint template, tracking.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
