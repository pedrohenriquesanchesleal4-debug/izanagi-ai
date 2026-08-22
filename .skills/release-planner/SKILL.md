---
name: "release-planner"
description: "Use para planejar releases: versionamento semântico, checklist de release, changelog e coordenação de deploy. Gatilhos de ativação: skill: release planner; identity; version bump rules; release checklist."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill: Release Planner

> Migrado deterministicamente de `skills/release-planner/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para planejar releases: versionamento semântico, checklist de release, changelog e coordenação de deploy.
- **Ativar quando:** Use para planejar releases: versionamento semântico, checklist de release, changelog e coordenação de deploy.
- **Escopo canônico:** Skill: Release Planner
- **Seções do corpo original:** Identity · Version Bump Rules · Release Checklist · Changelog Entry · [1.2.0] — 2026-07-17
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Release Planner manages version bumps, changelog generation, release branches, and depl...

Release Planner manages version bumps, changelog generation, release branches, and deployment coordination.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] All tests pass (CI green)
- [ ] Changelog.md updated
- [ ] Version bumped in config/app.php or package.json
- [ ] Migration scripts tested (up + down)
- [ ] Breaking changes documented in release notes
- [ ] Deployment playbook reviewed
- [ ] Rollback plan confirmed
- [ ] Stakeholders notified

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

# Skill: Release Planner

## Identity

Release Planner manages version bumps, changelog generation, release branches, and deployment coordination.

---

## Version Bump Rules

```yaml
major: breaking changes (API contract, DB schema, public API)
  format: "1.0.0 → 2.0.0"
  branch: "release/2.0.0"
  action: "Includes migration guide, sunset headers"

minor: new features, backward compatible
  format: "1.0.0 → 1.1.0"
  branch: "release/1.1.0"
  action: "Add deprecation notices for old APIs"

patch: bug fixes, no new features
  format: "1.0.0 → 1.0.1"
  branch: "main (direct commit/tag)"
  action: "Urgent: hotfix branch"
```

---

## Release Checklist

- [ ] All tests pass (CI green)
- [ ] Changelog.md updated
- [ ] Version bumped in config/app.php or package.json
- [ ] Migration scripts tested (up + down)
- [ ] Breaking changes documented in release notes
- [ ] Deployment playbook reviewed
- [ ] Rollback plan confirmed
- [ ] Stakeholders notified

---

## Changelog Entry

```markdown
## [1.2.0] — 2026-07-17

### Added
- Payment integration with Stripe
- Email notifications for payment confirmation

### Changed
- Upgrade Laravel from 10 to 11

### Fixed
- N+1 query on posts listing (#142)
- Null email handling in login (#138)
```

---

## Changelog

### 1.0.0 — Initial release. Version rules, checklist, changelog format.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
