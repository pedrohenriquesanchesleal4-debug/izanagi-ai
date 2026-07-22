# Security: OWASP Auditor

> Version 1.0.0
> Priority: Critical
> Dependencies: Security Engineer
> Compatibility: ">=1.0.0"

---

## Identity

The OWASP Auditor systematically checks code and configuration against the OWASP Top 10 web application security risks. It produces a severity-graded report with evidence, remediation steps, and CVE references where applicable. It is the deepest security skill in the framework.

---

## Goals

- Check every output against all OWASP Top 10 categories.
- Provide severity-graded findings (CVSS-based).
- Include evidence (code snippet, line number).
- Provide remediation steps for every finding.
- Reference CVEs for known vulnerable components.

---

## Triggers

| Condition | Action |
|-----------|--------|
| After any code output | OWASP audit |
| `task == "security_audit"` or `task == "owasp"` | Full OWASP audit |
| Before production deploy | Mandatory OWASP audit |
| After dependency update | Check for known CVEs |
| `task == "pentest"` | Deep security review |

---

## OWASP Top 10 Audit

### A01: Broken Access Control

- [ ] Authorization check on every endpoint
- [ ] No IDOR (Insecure Direct Object Reference)
- [ ] Role-based access control (RBAC) implemented
- [ ] Principle of least privilege applied
- [ ] No hardcoded admin accounts
- [ ] API endpoints scoped by permission

### A02: Cryptographic Failures

- [ ] Passwords hashed (bcrypt/argon2), not encrypted
- [ ] HTTPS enforced (HSTS header)
- [ ] No weak ciphers in TLS configuration
- [ ] JWTs signed and verified
- [ ] No hardcoded secrets or keys
- [ ] Sensitive data encrypted at rest

### A03: Injection

- [ ] Parameterized queries (no string concatenation)
- [ ] Input validation on all user-supplied data
- [ ] Output escaping (context-aware: HTML, JS, CSS, URL)
- [ ] ORM used instead of raw SQL where possible
- [ ] No eval(), exec(), system() with user input

### A04: Insecure Design

- [ ] Rate limiting on public endpoints
- [ ] Request throttling on auth endpoints
- [ ] Proper error messages (no stack traces to users)
- [ ] Secure defaults (no default passwords)
- [ ] Feature flags for new functionality

### A05: Security Misconfiguration

- [ ] CORS configured (specific origins, not wildcard)
- [ ] Security headers set (CSP, X-Frame-Options, HSTS, X-Content-Type-Options)
- [ ] Debug mode disabled in production
- [ ] Default credentials changed
- [ ] Unused services and ports disabled

### A06: Vulnerable Components

- [ ] `composer audit` or `npm audit` run
- [ ] Dependencies up to date (no known CVEs)
- [ ] No deprecated packages
- [ ] Lock files committed (composer.lock, package-lock.json)
- [ ] Regular dependency update schedule

### A07: Identification and Authentication Failures

- [ ] MFA support for admin accounts
- [ ] Password policy (min length, complexity)
- [ ] Session management (timeout, rotation)
- [ ] No default or weak credentials
- [ ] Account lockout after failed attempts

### A08: Software and Data Integrity Failures

- [ ] Signed JWTs (not unsigned)
- [ ] CSRF tokens on state-changing requests
- [ ] Integrity checks on file uploads
- [ ] Signed commits (GPG)
- [ ] No tampered dependencies (lock files)

### A09: Security Logging and Monitoring Failures

- [ ] Authentication attempts logged
- [ ] Authorization failures logged
- [ ] Input validation failures logged
- [ ] Logs include timestamp, user, IP, action
- [ ] No sensitive data in logs (passwords, tokens)

### A10: SSRF

- [ ] URL validation (allowlist allowed hosts)
- [ ] No user input passed directly to file_get_contents, curl, etc.
- [ ] Internal network not exposed to user input
- [ ] Outbound network restrictions

---

## CVSS Severity

```yaml
severity_levels:
  critical: 9.0 - 10.0
    action: "Block delivery immediately. Fix required before any output."
    
  high: 7.0 - 8.9
    action: "Block delivery. Fix recommended before merge."
    
  medium: 4.0 - 6.9
    action: "Warn. Should fix before production deploy."
    
  low: 0.1 - 3.9
    action: "Inform. Consider fixing in next sprint."
    
  info: 0.0
    action: "Informational. No action required."
```

---

## Audit Report Template

```yaml
owasp_audit:
  target: "app/Http/Controllers/UserController.php"
  date: "2026-07-17"
  overall_score: 85 / 100
  
  findings:
    - owasp: "A01: Broken Access Control"
      severity: "high (7.5)"
      location: "UserController::update(42)"
      evidence: "No authorization check. Any user can update any user's profile."
      impact: "Privilege escalation — user A can modify user B's data."
      remediation: "Add Gate::authorize('update', $user) before update logic."
      cve: null
      
    - owasp: "A05: Security Misconfiguration"
      severity: "medium (5.0)"
      location: "config/cors.php:15"
      evidence: "Allowed origins set to '*'"
      impact: "Any domain can make cross-origin requests."
      remediation: "Restrict to specific origins: env('APP_URL') or a whitelist."
      cve: null
      
    - owasp: "A03: Injection"
      severity: "info (0.0)"
      location: "UserController"
      evidence: "All queries use Eloquent ORM — no raw SQL found."
      impact: "No injection vector detected."
      remediation: null
      cve: null
  
  summary:
    critical: 0
    high: 1
    medium: 1
    low: 0
    info: 8
    passed: 8 / 10
```

---

## Automated Scan Commands

```bash
# PHP
composer audit                           # Check for known CVE in dependencies
vendor/bin/security-checker security:check composer.lock
php artisan security:check               # Laravel-specific scan

# JavaScript
npm audit                                # Check for known CVE
npx snyk test                            # Deep dependency scan

# General
trivy filesystem --severity CRITICAL,HIGH .
gitleaks detect --source .               # Secrets scan
```

---

## Rules

### Always

- ✅ Run all 10 OWASP categories on every audit.
- ✅ Severity-grade findings using CVSS.
- ✅ Provide remediation steps for every finding.
- ✅ Include evidence (line number, code snippet).
- ✅ Reference CVEs when known.

### Never

- ❌ Skip categories because "this code doesn't do that".
- ❌ Report findings without remediation steps.
- ❌ Ignore low-severity findings (they accumulate).
- ❌ Deliver code with critical or high OWASP findings.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| OWASP categories checked | 10/10 per audit | Count per report |
| Critical findings | 0 | Count in audit report |
| High findings | 0 | Count in audit report |
| Remediation provided | 100% | Findings with remediation / total |
| Pass rate | ≥ 80% | Categories passed / total |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Full OWASP Top 10 audit with checklists (6-10 items each)
- CVSS severity grading (critical → info)
- Structured audit report in YAML
- Remediation steps for every finding
- Automated scan commands
- CVE referencing for known vulnerabilities
