---
name: "feature-flags"
description: "Estratégias de feature flags, rollout gradual, canary releases e A/B testing (LaunchDarkly, Statsig, Harness FME, Flagsmith). Use ao implementar entregas graduais ou experimentos A/B. Gatilhos de ativação: skill feature flags — izanagi; provedores; estrategias de flag; a/b testing."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Skill Feature Flags — Izanagi

> Migrado deterministicamente de `skills/feature-flags/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Estratégias de feature flags, rollout gradual, canary releases e A/B testing (LaunchDarkly, Statsig, Harness FME, Flagsmith).
- **Ativar quando:** Use ao implementar entregas graduais ou experimentos A/B.
- **Escopo canônico:** Skill Feature Flags — Izanagi
- **Seções do corpo original:** Provedores · Estrategias de Flag · A/B Testing · Boas Praticas · References
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Provedores

| Ferramenta | Uso |
|------------|-----|
| LaunchDarkly | Feature flags enterprise |
| Statsig | Flags + experimentacao + analytics |
| Harness FME (ex-Split.io) | Flags + experimentação + metrics |
| Flagsmith | Open-source (self-hosted) |
| Custom (env vars) | Flags simples, sem target |

---

### Passo 2 — Aplicar: Boolean Flags

```tsx
if (isEnabled("new-checkout-flow")) {
  return <NewCheckout />;
}
return <LegacyCheckout />;
```

### Passo 3 — Aplicar: Percentage Rollout

```tsx
// Lancamento gradual: 10% → 25% → 50% → 100%
await flagsmith.setPercentage("new-header", 10);
```

### Passo 4 — Aplicar: Targeted Release

```tsx
// Liberar para grupo especifico
"targets": [
  { "audience": "internal-team", "enabled": true },
  { "audience": "beta-users", "enabled": true },
  { "audience": "all", "enabled": false }
]
```

### Passo 5 — Aplicar: Canary / Ring Deployment

```
Ring 0 (dev) → Ring 1 (internal) → Ring 2 (beta) → Ring 3 (all)
```

---

### Passo 6 — Aplicar: Estrutura

```tsx
const experiment = statsig.getExperiment("homepage-hero-v2");

return (
  <div>
    {experiment.get("variant") === "v1" ? <HeroV1 /> : <HeroV2 />}
  </div>
);
```

### Passo 7 — Aplicar: Metricas

| Metrica | Descricao |
|---------|-----------|
| Primary | O que queremos melhorar (ex: click rate) |
| Secondary | Efeitos colaterais (ex: bounce rate) |
| Guardrail | O que nao pode piorar (ex: page load time) |

---

### Passo 8 — Aplicar: Nomenclatura

```
<area>.<feature>.<variant>
ex: checkout.new-flow.control
```

### Passo 9 — Aplicar: Lifecycle

```
dev → staging → rollout (5%) → rollout (25%) → rollout (100%) → cleanup (remover flag)
```

### Passo 10 — Aplicar: Anti-Padroes

- ❌ Flags eternas (que nunca saem) — sempre cleanup apos stable
- ❌ Flags em cascata (flag A depende de flag B)
- ❌ Flags sem owner definido
- ❌ Testar apenas com flag ON (esquecer de testar flag OFF)

### Passo 11 — Aplicar: References

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

# Skill Feature Flags — Izanagi

## Provedores

| Ferramenta | Uso |
|------------|-----|
| LaunchDarkly | Feature flags enterprise |
| Statsig | Flags + experimentacao + analytics |
| Harness FME (ex-Split.io) | Flags + experimentação + metrics |
| Flagsmith | Open-source (self-hosted) |
| Custom (env vars) | Flags simples, sem target |

---

## Estrategias de Flag

### Boolean Flags
```tsx
if (isEnabled("new-checkout-flow")) {
  return <NewCheckout />;
}
return <LegacyCheckout />;
```

### Percentage Rollout
```tsx
// Lancamento gradual: 10% → 25% → 50% → 100%
await flagsmith.setPercentage("new-header", 10);
```

### Targeted Release
```tsx
// Liberar para grupo especifico
"targets": [
  { "audience": "internal-team", "enabled": true },
  { "audience": "beta-users", "enabled": true },
  { "audience": "all", "enabled": false }
]
```

### Canary / Ring Deployment
```
Ring 0 (dev) → Ring 1 (internal) → Ring 2 (beta) → Ring 3 (all)
```

---

## A/B Testing

### Estrutura
```tsx
const experiment = statsig.getExperiment("homepage-hero-v2");

return (
  <div>
    {experiment.get("variant") === "v1" ? <HeroV1 /> : <HeroV2 />}
  </div>
);
```

### Metricas
| Metrica | Descricao |
|---------|-----------|
| Primary | O que queremos melhorar (ex: click rate) |
| Secondary | Efeitos colaterais (ex: bounce rate) |
| Guardrail | O que nao pode piorar (ex: page load time) |

---

## Boas Praticas

### Nomenclatura
```
<area>.<feature>.<variant>
ex: checkout.new-flow.control
```

### Lifecycle
```
dev → staging → rollout (5%) → rollout (25%) → rollout (100%) → cleanup (remover flag)
```

### Anti-Padroes
- ❌ Flags eternas (que nunca saem) — sempre cleanup apos stable
- ❌ Flags em cascata (flag A depende de flag B)
- ❌ Flags sem owner definido
- ❌ Testar apenas com flag ON (esquecer de testar flag OFF)

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
