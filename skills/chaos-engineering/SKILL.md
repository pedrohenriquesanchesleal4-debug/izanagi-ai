---
name: chaos-engineering
description: |
  Skill de Chaos Engineering para o Portal. Aborda principios de engenharia do caos,
  experimentos de resiliencia, ferramentas (Chaos Mesh, Gremlin, Litmus), e pratica de
  break things in production de forma controlada.
  Use esta skill para planejar e executar experimentos de caos.
---

# Skill Chaos Engineering — Portal

## Principios (Principles of Chaos)

1. **Hypothesize**: construir hipotese sobre comportamento estavel
2. **Experiment**: introduzir variaveis reais (falhas, latencia, trafego)
3. **Prove**: medir impacto vs hipotese
4. **Automate**: automatizar experimentos como testes continuos

---

## Tipos de Experimentos

| Experimento | Descricao | Ferramenta |
|-------------|-----------|------------|
| **Pod kill** | Mata container aleatorio | Chaos Mesh |
| **Network latency** | Adiciona latencia a servico | Toxiproxy |
| **Network partition** | Isola servico da rede | Chaos Mesh / Gremlin |
| **CPU stress** | Consome CPU do host | `stress-ng` |
| **Memory stress** | Consome memoria | `stress-ng` / Chaos Mesh |
| **Disk I/O stress** | Alta escrita/leitura em disco | FIO |
| **DNS failure** | DNS resolver falha | Toxiproxy |
| **Certificate expiry** | Certificado TLS expirado | `openssl` |

---

## Ferramentas

### Chaos Mesh
```yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-kill-example
spec:
  action: pod-kill
  mode: one
  selector:
    namespaces: [portal]
    labelSelectors:
      app: api-server
  duration: 60s
```

### Toxiproxy (Network)
```bash
# Adicionar 500ms de latencia no servico de DB
toxiproxy-cli toxic add postgres_proxy \
  --type latency \
  --attribute latency=500
```

---

## Game Days

### Estrutura de Game Day
1. **Scenario**: qual falha simular? (ex: banco cai)
2. **Hypothesis**: "Se banco cair por 5min, app mostra pagina de erro amigavel"
3. **Experiment**: matar conexao com o banco
4. **Observe**: como o sistema se comporta?
5. **Learn**: o que precisa ser melhorado?
6. **Remediate**: criar action items

### Runbook Template
```yaml
title: "Database Failover"
duration: 10min
steps:
  - Kill primary DB connection
  - Observe app behavior (expected: read-only mode)
  - Kill replica too
  - Observe (expected: error page with "under maintenance")
  - Restore DB
  - Verify recovery
```

---

## Runbooks

### Runbook de Resposta a Incidente
1. **Detect**: alerta, monitor, usuario reportando
2. **Assess**: qual servico? qual impacto?
3. **Contain**: rollback, kill switch, degrade feature
4. **Resolve**: hotfix, configuration change, scale
5. **Recover**: verificar health, confirmar resolucao
6. **Learn**: postmortem, prevencao futura

---

## Boas Praticas

- **Blast radius**: sempre limitar escopo do experimento (1 instancia, 1 servico)
- **Rollback plan**: ter comando para parar o experimento imediatamente
- **Business hours**: nunca executar experimentos destrutivos fora do horario comercial sem aviso
- **Observability**: dashboards e alertas prontos antes de comecar
- **Blameless**: postmortem sem culpa, foco em aprendizado
- **Documentation**: documentar todo experimento (hipotese, resultado, aprendizado)
