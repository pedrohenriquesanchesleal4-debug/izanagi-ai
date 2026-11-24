---
name: "risk-analyzer"
description: "Use para identificar, avaliar e mitigar riscos de projeto e técnicos antes que se materializem, com matriz de probabilidade x impacto. Gatilhos de ativação: skill: risk analyzer; identity; risk assessment matrix; risk register."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Skill: Risk Analyzer

> Migrado deterministicamente de `skills/risk-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para identificar, avaliar e mitigar riscos de projeto e técnicos antes que se materializem, com matriz de probabilidade x impacto.
- **Ativar quando:** Use para identificar, avaliar e mitigar riscos de projeto e técnicos antes que se materializem, com matriz de probabilidade x impacto.
- **Escopo canônico:** Skill: Risk Analyzer
- **Seções do corpo original:** Identity · Risk Assessment Matrix · Risk Register · Changelog · References
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Risk Analyzer identifies, assesses, and mitigates project and technical risks before th...

Risk Analyzer identifies, assesses, and mitigates project and technical risks before they materialize.

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

# Skill: Risk Analyzer

## Identity

Risk Analyzer identifies, assesses, and mitigates project and technical risks before they materialize.

---

## Risk Assessment Matrix

```yaml
probability:
  rare: 1 (unlikely)
  unlikely: 2
  possible: 3
  likely: 4
  almost_certain: 5

impact:
  negligible: 1
  minor: 2
  moderate: 3
  major: 4
  catastrophic: 5

risk_score: probability × impact

thresholds:
  critical: 20-25 → requires immediate mitigation
  high: 15-19 → requires mitigation plan
  medium: 10-14 → monitor monthly
  low: 1-9 → accept
```

---

## Risk Register

```yaml
risks:
  - id: R1
    title: "Third-party payment API downtime"
    probability: unlikely (2)
    impact: major (4)
    score: 8 (medium)
    mitigation: "Queue failed payments with retry + fallback"
    
  - id: R2
    title: "Key developer leaves mid-project"
    probability: possible (3)
    impact: major (4)
    score: 12 (medium)
    mitigation: "Cross-training, documentation, no bus factor = 1"
    
  - id: R3
    title: "Database migration causes data loss"
    probability: unlikely (2)
    impact: catastrophic (5)
    score: 10 (medium)
    mitigation: "Staging restore test before production, backup verified"
```

---

## Changelog

### 1.0.0 — Initial release. Matrix, thresholds, register.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
