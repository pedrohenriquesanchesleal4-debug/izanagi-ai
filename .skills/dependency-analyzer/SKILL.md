---
name: "dependency-analyzer"
description: "Audita dependências por vulnerabilidades conhecidas (CVE), versões desatualizadas, conflitos e compliance de licença, com plano de ação priorizado. Use antes de atualizar pacotes ou revisar segurança de terceiros. Gatilhos de ativação: skill: dependency analyzer; identity; audit categories; report."
version: 2.0.0
category: security
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
---

# Skill: Dependency Analyzer

> Migrado deterministicamente de `skills/dependency-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Segurança (`security`)
- **Resumo:** Audita dependências por vulnerabilidades conhecidas (CVE), versões desatualizadas, conflitos e compliance de licença, com plano de ação priorizado.
- **Ativar quando:** Use antes de atualizar pacotes ou revisar segurança de terceiros.
- **Escopo canônico:** Skill: Dependency Analyzer
- **Seções do corpo original:** Identity · Audit Categories · Report · Changelog · References
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Identity

Dependency Analyzer audits project dependencies for known vulnerabilities, outdated packages, license compliance, and version conflicts.

---

### Passo 2 — Aplicar: Audit Categories

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

### Passo 3 — Aplicar: Automação recomendada

- **Dependabot** (GitHub nativo) ou **Renovate** (mais configurável) para PRs automáticos de atualização — rodar em paralelo com o scan de segurança, não como substituto.
- Gate de CI: falhar o build em `critical`/`high` sem exceção registrada; `medium`/`low` viram issue com prazo.
- Rodar o scan de SBOM/vulnerabilidade a cada build de release, não só sob demanda — supply chain muda entre releases mesmo sem alterar `package.json`.

---

### Passo 4 — Aplicar: Report

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

### Passo 5 — Aplicar: References

- OSV.dev (banco aberto de vulnerabilidades, Google): https://osv.dev · OSV-Scanner: https://google.github.io/osv-scanner/
- SLSA (framework de integridade de supply chain): https://slsa.dev · Sigstore (assinatura/proveniência de artefatos): https://www.sigstore.dev
- SBOM: CycloneDX https://cyclonedx.org · SPDX https://spdx.dev · Syft/Grype (Anchore): https://github.com/anchore/syft · https://github.com/anchore/grype
- Dependabot: https://docs.github.com/en/code-security/dependabot · Renovate: https://docs.renovatebot.com
- Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:security -->

- Executar varredura de segredos/CVE no artefato tocado pela skill e registrar o resultado.
- Confirmar que cada fluxo modificado valida input na fronteira onde entra.
- Conferir que nenhum Red Flag listado aparece no diff final.
- Registrar evidência da verificação (comando executado + saída resumida), nunca apenas a intenção.

## Common Rationalizations

- **"Input interno é confiável, validação é para API pública."**
  - Verdade: A fronteira interna de hoje é a integração exposta de amanhã. Validar na fronteira onde o dado entra custa pouco; sanitizar após incidente custa caro.
- **"Estamos atrás de firewall/rede privada, estamos seguros."**
  - Verdade: Network perimeter falha comum: SSRF, credencial vazada e supply chain ignoram firewall. Camadas independentes (defense in depth) existem porque qualquer camada isolada falha sozinha.
- **"Logue tudo para facilitar debug, incluindo o payload."**
  - Verdade: Payload contém token, PII e credencial. Log é arquivo de leak esperando auditoria. Logging estruturado com redação é obrigação, não refinamento.
- **"Segurança agora trava o sprint; compensamos depois."**
  - Verdade: 'Depois' em segurança é pós-incidente. OWASP Top 10 é lista de erros conhecidos e baratos de evitar na escrita, caríssimos de corrigir em produção.
- **"Valido no frontend, backend confia."**
  - Verdade: Frontend é sugestão, backend é contrato. Qualquer requisição pode ser forjada fora da UI; validação server-side é a única que existe de fato.
- **"Secrets em variável de código é temporário até o .env ficar pronto."**
  - Verdade: Temporário em código versionado é permanente no histórico do Git. Rotação de chave pós-leak dói muito mais que 10 minutos de configuração.

## Red Flags

- SQL/comando montado por concatenação de input.
- Token, cookie ou segredo aparecendo em log, URL ou mensagem de erro.
- Stacktrace cru retornado ao usuário (fingerprint da aplicação).
- Dependência sem verificação de CVE na atualização.
- Permissão/privilégio amplo demais 'para simplificar' (viola menor privilégio).
- Endpoint mutante sem autenticação, rate limit ou idempotency key.
- Criptografia caseira ou hash fraco (MD5/SHA1) para credencial.

## Legacy Reference (v1)

# Skill: Dependency Analyzer

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
