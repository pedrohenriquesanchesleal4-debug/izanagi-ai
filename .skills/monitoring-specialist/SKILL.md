---
name: "monitoring-specialist"
description: "Define métricas essenciais, SLIs/SLOs/SLAs e alertas acionáveis para produção. Use ao configurar monitoramento de sistemas ou planejar confiabilidade. Gatilhos de ativação: monitoring specialist (métricas, alertas e slos); quando usar; os 4 sinais de ouro (google sre); regra de ouro para alertas."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Monitoring Specialist (Métricas, Alertas e SLOs)

> Migrado deterministicamente de `skills/monitoring-specialist/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Define métricas essenciais, SLIs/SLOs/SLAs e alertas acionáveis para produção.
- **Ativar quando:** Use ao configurar monitoramento de sistemas ou planejar confiabilidade.
- **Escopo canônico:** Monitoring Specialist (Métricas, Alertas e SLOs)
- **Seções do corpo original:** Quando usar · Os 4 Sinais de Ouro (Google SRE) · Regra de Ouro para Alertas · Checklist de qualidade · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Latência:

**Latência**: Tempo que leva para servir uma requisição (separada entre sucesso e erro).

### Passo 2 — Tráfego:

**Tráfego**: Demanda exercida sobre o sistema (ex: requisições por segundo).

### Passo 3 — Erros:

**Erros**: Taxa de requisições que falham (erros 5xx, falhas de conexão).

### Passo 4 — Saturação:

**Saturação**: O quão "cheio" está o recurso mais restrito (CPU, memória, conexões de banco).

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Os 4 Sinais de Ouro monitorados em dashboards centrais
- [ ] SLOs definidos com base na expectativa real do usuário
- [ ] Alertas testados e associados a runbooks de mitigação

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

# Monitoring Specialist (Métricas, Alertas e SLOs)

Especialista em monitoramento operacional: define métricas de saúde, estabelece **SLIs, SLOs e SLAs**, configura painéis operacionais e cria alertas que realmente exigem ação (evitando fadiga de alerta).

## Quando usar

Use ao: preparar sistema para produção; configurar alertas no Prometheus/Grafana/Datadog; definir acordos de nível de serviço (SLAs). **Pule** para: rastreamento distribuído profundo (skill `observability-expert`).

## Os 4 Sinais de Ouro (Google SRE)
1. **Latência**: Tempo que leva para servir uma requisição (separada entre sucesso e erro).
2. **Tráfego**: Demanda exercida sobre o sistema (ex: requisições por segundo).
3. **Erros**: Taxa de requisições que falham (erros 5xx, falhas de conexão).
4. **Saturação**: O quão "cheio" está o recurso mais restrito (CPU, memória, conexões de banco).

## Regra de Ouro para Alertas
- **Alerta acionável**: Se um alerta dispara, alguém precisa fazer algo **agora**. Se a pessoa pode ignorar até amanhã, o alerta é um relatório e deve ir para um dashboard, não para o PagerDuty.

## Checklist de qualidade
- [ ] Os 4 Sinais de Ouro monitorados em dashboards centrais
- [ ] SLOs definidos com base na expectativa real do usuário
- [ ] Alertas testados e associados a runbooks de mitigação

## Anti-padrões (proibido)
1. ❌ Alertas baseados em uso de CPU em 80% sem queda real de serviço (falso positivo crônico)
2. ❌ Ausência de métricas de erro na camada de API

## Composição com outras skills
- **Before**: `devops` (infraestrutura) → `sre-reliability` (confiabilidade)
- **After**: `observability-expert` (tracing) → `bug-hunter` (análise de incidentes)

## References
- Google SRE Book (Monitoring Distributed Systems): https://sre.google/sre-book/monitoring-distributed-systems/
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
