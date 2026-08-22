---
name: "chaos-engineering"
description: "Planeja e executa experimentos de resiliência (pod kill, latência de rede, stress de CPU/memória) com hipótese, blast radius controlado e game days. Use antes de validar a resiliência do sistema em produção. Gatilhos de ativação: skill chaos engineering — izanagi; principios (principles of chaos); tipos de experimentos; ferramentas."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill Chaos Engineering — Izanagi

> Migrado deterministicamente de `skills/chaos-engineering/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Planeja e executa experimentos de resiliência (pod kill, latência de rede, stress de CPU/memória) com hipótese, blast radius controlado e game days.
- **Ativar quando:** Use antes de validar a resiliência do sistema em produção.
- **Escopo canônico:** Skill Chaos Engineering — Izanagi
- **Seções do corpo original:** Principios (Principles of Chaos) · Tipos de Experimentos · Ferramentas · Game Days · Runbooks
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Hypothesize:

**Hypothesize**: construir hipotese sobre comportamento estavel

### Passo 2 — Experiment:

**Experiment**: introduzir variaveis reais (falhas, latencia, trafego)

### Passo 3 — Prove:

**Prove**: medir impacto vs hipotese

### Passo 4 — Automate:

**Automate**: automatizar experimentos como testes continuos

---

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

# Skill Chaos Engineering — Izanagi

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
    namespaces: [Izanagi]
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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
