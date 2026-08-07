---
name: security-privacy
description: "Skill de Seguranca e Privacidade para o Izanagi. Aborda OWASP Top 10, LGPD/GDPR, seguranca de APIs, authentication, authorization, cryptography e secure coding. Use esta skill para implementar ou revisar aspectos de seguranca e protecao de dados."
---

# Security Privacy

## OWASP Top 10
| # | Risco | Prevencao | |---|-------|-----------| | 1 | Broken Access Control | RLS no Supabase, middleware de role verification | | 2 | Cryptographic Failures | TLS 1.3, hashing (bcrypt), encryption at rest | | 3 | Injection | Zod valid…
| 5 | Security Misconfiguration | Environment-specific configs, secrets management | | 6 | Vulnerable Components | Dependabot, `npm audit`, renovate bot | | 7 | Auth Failures | Supabase Auth + MFA, rate limiting | | 8 | Data Integrity Fail…
| 10 | SSRF | URL validation, allowlist de dominios |
---
## LGPD (Lei Geral de Protecao de Dados)
- **Acesso**: API para usuario baixar seus dados - **Correcao**: editar dados pessoais no perfil - **Exclusao**: deletar conta + dados associados (anonimizar logs) - **Portabilidade**: exportar dados em JSON - **Revogacao de consentimento*…
- Mapeamento de dados pessoais (o que, onde, por que, por quanto tempo) - Consentimento explicito para coleta de dados nao essenciais - Aviso de privacidade claro (politica de privacidade) - DPO (Encarregado) com canal de contato - Notific…
---
## Secure Coding
- Rate limiting (express-rate-limit ou Vercel WAF) - CORS restrito (allowlist de dominios) - Request size limiting (10kb body max) - Idempotency keys em mutations - Audit logging (quem, o que, quando)
---
## Authentication & Authorization
---
## Cryptography
| Uso | Algoritmo | |-----|-----------| |

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/security-privacy/SKILL.md`.
