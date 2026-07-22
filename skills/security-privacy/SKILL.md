---
name: security-privacy
description: |
  Skill de Seguranca e Privacidade para o Portal. Aborda OWASP Top 10, LGPD/GDPR,
  seguranca de APIs, authentication, authorization, cryptography e secure coding.
  Use esta skill para implementar ou revisar aspectos de seguranca e protecao de dados.
---

# Skill Security & Privacy — Portal

## OWASP Top 10

| # | Risco | Prevencao |
|---|-------|-----------|
| 1 | Broken Access Control | RLS no Supabase, middleware de role verification |
| 2 | Cryptographic Failures | TLS 1.3, hashing (bcrypt), encryption at rest |
| 3 | Injection | Zod validation, prepared statements (Supabase), sanitizacao |
| 4 | Insecure Design | Threat modeling, security review no design |
| 5 | Security Misconfiguration | Environment-specific configs, secrets management |
| 6 | Vulnerable Components | Dependabot, `npm audit`, renovate bot |
| 7 | Auth Failures | Supabase Auth + MFA, rate limiting |
| 8 | Data Integrity Failures | CSP headers, Subresource Integrity (SRI) |
| 9 | Logging Failures | Audit logging, never log PII |
| 10 | SSRF | URL validation, allowlist de dominios |

---

## LGPD (Lei Geral de Protecao de Dados)

### Direitos do Titular
- **Acesso**: API para usuario baixar seus dados
- **Correcao**: editar dados pessoais no perfil
- **Exclusao**: deletar conta + dados associados (anonimizar logs)
- **Portabilidade**: exportar dados em JSON
- **Revogacao de consentimento**: opt-out de comunicacoes

### Obrigacoes Tecnicas
- Mapeamento de dados pessoais (o que, onde, por que, por quanto tempo)
- Consentimento explicito para coleta de dados nao essenciais
- Aviso de privacidade claro (politica de privacidade)
- DPO (Encarregado) com canal de contato
- Notificacao de vazamento em 72h (ANPD)

---

## Secure Coding

### Input Validation (Zod)
```tsx
import { z } from "zod";

const contactSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/),
  message: z.string().min(10).max(1000),
});
```

### CSP Headers
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' https:; font-src 'self'; connect-src 'self' https://*.supabase.co;
```

### API Security
- Rate limiting (express-rate-limit ou Vercel WAF)
- CORS restrito (allowlist de dominios)
- Request size limiting (10kb body max)
- Idempotency keys em mutations
- Audit logging (quem, o que, quando)

---

## Authentication & Authorization

### Supabase Auth
```tsx
// Server-side middleware
export async function middleware(req: NextRequest) {
  const session = await supabase.auth.getSession();
  if (!session) return NextResponse.redirect("/admin/login");
}

// RLS policy
CREATE POLICY "Admins can read all posts" ON posts
  FOR SELECT USING (auth.role() = 'admin');
```

---

## Cryptography

| Uso | Algoritmo |
|-----|-----------|
| Hashing de senha | bcrypt (cost 12) |
| JWT signing | RS256 (asymmetric) |
| TLS | TLS 1.3 (min 1.2) |
| Dados sensiveis em repouso | AES-256-GCM |
