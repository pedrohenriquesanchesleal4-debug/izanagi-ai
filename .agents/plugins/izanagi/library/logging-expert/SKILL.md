---
name: "logging-expert"
description: "Define logging estruturado em JSON com contexto, sem vazar dados sensíveis, e o que registrar em cada nível (info/warning/error/critical). Use ao implementar ou revisar logging de uma aplicação. Gatilhos de ativação: skill: logging expert; identity; structured logging; what to log."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Skill: Logging Expert

> Migrado deterministicamente de `skills/logging-expert/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Define logging estruturado em JSON com contexto, sem vazar dados sensíveis, e o que registrar em cada nível (info/warning/error/critical).
- **Ativar quando:** Use ao implementar ou revisar logging de uma aplicação.
- **Escopo canônico:** Skill: Logging Expert
- **Seções do corpo original:** Identity · Structured Logging · What to Log · What NOT to Log · Changelog
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Logging Expert implements structured logging across the application.

Logging Expert implements structured logging across the application. Ensures every significant event is logged with context, no sensitive data leaks, and logs are queryable.

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

# Skill: Logging Expert

## Identity

Logging Expert implements structured logging across the application. Ensures every significant event is logged with context, no sensitive data leaks, and logs are queryable.

---

## Structured Logging

```json
{
  "timestamp": "2026-07-17T12:00:00Z",
  "level": "error",
  "message": "Payment processing failed",
  "context": {
    "user_id": "usr_456",
    "payment_id": "pay_789",
    "amount": 150.00,
    "error": "card_declined",
    "provider": "stripe"
  },
  "request_id": "req_abc123",
  "environment": "production",
  "service": "payment-service"
}
```

## What to Log

```yaml
info:
  - User registration/login
  - Order placement
  - Payment confirmation
  - Email sent
  
warning:
  - Rate limit approaching
  - Slow query (> 100ms)
  - Retry attempts
  
error:
  - Exception caught
  - Payment failure
  - External API error
  - Database connection failure
  
critical:
  - Application crash
  - Data integrity violation
  - Security breach detected
```

---

## What NOT to Log

```
- Passwords (even hashed)
- Credit card numbers
- Personal access tokens
- API keys
- Full stack traces with sensitive data
- Session IDs (use anonymized correlation IDs)
```

---

## Changelog

### 1.0.0 — Initial release. Structured logging, what to log/not log.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
