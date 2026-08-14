---
name: dependency-analyzer
description: "Audita dependências por vulnerabilidades conhecidas (CVE), versões desatualizadas, conflitos e compliance de licença, com plano de ação priorizado. Use antes de atualizar pacotes ou revisar segurança de terceiros."
version: 1.0.0
compatibility: ">= 1.0.0"
triggers: [dependency-analyzer]
token_budget: 2048
---

# Skill: Dependency Analyzer

> Version 1.0.0 | Priority: Medium
> Dependencies: Security Engineer, DevOps Engineer
> Compatibility: ">=1.0.0"

---

## Identity

Dependency Analyzer audits project dependencies for known vulnerabilities, outdated packages, license compliance, and version conflicts.

---

## Audit Categories

```yaml
security:
  - npm audit --omit=dev / composer audit / pip-audit / trivy fs .
  - OSV-Scanner (osv-scanner -r .) — CLI open-source do Google contra o banco OSV.dev,
    cobre npm, PyPI, Go, Maven, crates.io, RubyGems num único scan
  - CVE database (NVD, GitHub Security Advisories, OSV.dev)
  - Severity: critical/high/medium/low (CVSS)

supply_chain:
  - SBOM (Software Bill of Materials): gerar com Syft (syft . -o cyclonedx-json)
    ou cdxgen; formatos padrão: CycloneDX e SPDX
  - Vulnerabilidade contra SBOM: Grype (grype sbom:./sbom.json)
  - Provenance/assinatura: `npm audit signatures`, Sigstore/cosign para verificar
    assinatura de artefato, preferir pacotes que publicam proveniência (npm provenance)
  - SLSA (Supply-chain Levels for Software Artifacts): framework de 4 níveis de
    integridade de build — nível mínimo aceitável varia por criticidade do projeto
  - Dependency confusion / typosquatting: checar se pacotes internos têm namespace
    privado reservado no registry público

freshness:
  - Latest version vs installed
  - Major/minor/patch behind
  - Abandoned packages (sem release/commit há > 12-18 meses, sem manutenedor ativo)

compatibility:
  - PHP/Node/Python version requirements
  - Platform requirements (ext-*, lib-*)
  - Conflicting transitive dependencies

license:
  - MIT, Apache, GPL, AGPL, proprietary
  - Compatibility with project license
```

### Automação recomendada

- **Dependabot** (GitHub nativo) ou **Renovate** (mais configurável) para PRs automáticos de atualização — rodar em paralelo com o scan de segurança, não como substituto.
- Gate de CI: falhar o build em `critical`/`high` sem exceção registrada; `medium`/`low` viram issue com prazo.
- Rodar o scan de SBOM/vulnerabilidade a cada build de release, não só sob demanda — supply chain muda entre releases mesmo sem alterar `package.json`.

---

## Report

```yaml
dependency_report:
  total: 42
  
  security:
    critical: 0
    high: 1
    medium: 2
    low: 3
    
  freshness:
    up_to_date: 30
    minor_behind: 8
    major_behind: 4
    
  licenses:
    MIT: 35
    Apache: 5
    GPL: 2 (verify compatibility)
    
  actions:
    - priority: high
      package: "guzzlehttp/guzzle"
      issue: "CVE-2024-xxxxx (high)"
      action: "Update to 7.9+"
    
    - priority: medium
      package: "laravel/framework"
      issue: "3 minor versions behind"
      action: "Update to latest minor"

  supply_chain:
    sbom_generated: true
    format: "CycloneDX"
    unsigned_packages: 2
    slsa_level: "N/A (build sem attestation)"
```

---

## Changelog

### 1.0.0 — Initial release. Audit categories, report format.

## References

- OSV.dev (banco aberto de vulnerabilidades, Google): https://osv.dev · OSV-Scanner: https://google.github.io/osv-scanner/
- SLSA (framework de integridade de supply chain): https://slsa.dev · Sigstore (assinatura/proveniência de artefatos): https://www.sigstore.dev
- SBOM: CycloneDX https://cyclonedx.org · SPDX https://spdx.dev · Syft/Grype (Anchore): https://github.com/anchore/syft · https://github.com/anchore/grype
- Dependabot: https://docs.github.com/en/code-security/dependabot · Renovate: https://docs.renovatebot.com
- Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
