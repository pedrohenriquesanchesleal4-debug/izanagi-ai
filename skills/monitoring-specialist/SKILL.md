---
name: monitoring-specialist
description: "Define métricas essenciais, SLIs/SLOs/SLAs e alertas acionáveis para produção. Use ao configurar monitoramento de sistemas ou planejar confiabilidade."
---

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
