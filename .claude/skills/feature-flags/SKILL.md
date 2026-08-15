---
name: feature-flags
description: "Estratégias de feature flags, rollout gradual, canary releases e A/B testing (LaunchDarkly, Statsig, Harness FME, Flagsmith). Use ao implementar entregas graduais ou experimentos A/B."
---

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

> Gerado pelo Izanagi AI — cópia fiel de `skills/feature-flags/SKILL.md` (fonte da verdade).
