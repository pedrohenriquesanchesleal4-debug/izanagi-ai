---
name: "security-privacy"
description: "Use ao implementar autenticação, autorização, validação de input ou revisar código quanto a segurança: OWASP Top 10, LGPD/GDPR e hardening de APIs. Gatilhos de ativação: security & privacy — manual operacional; quando usar; atualização: owasp top 10:2025 (8ª edição); owasp top 10 — mitigações concretas."
version: 2.0.0
category: security
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
---

# Security & Privacy — Manual Operacional

> Migrado deterministicamente de `skills/security-privacy/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Segurança (`security`)
- **Resumo:** Use ao implementar autenticação, autorização, validação de input ou revisar código quanto a segurança: OWASP Top 10, LGPD/GDPR e hardening de APIs.
- **Ativar quando:** Use ao implementar autenticação, autorização, validação de input ou revisar código quanto a segurança: OWASP Top 10, LGPD/GDPR e hardening de APIs.
- **Escopo canônico:** Security & Privacy — Manual Operacional
- **Seções do corpo original:** Quando usar · Atualização: OWASP Top 10:2025 (8ª edição) · OWASP Top 10 — Mitigações Concretas · Security Headers (Obrigatórios) · Validação de Input (Zod — Padrão Obrigatório)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Server-side ALWAYS:

**Server-side ALWAYS**: Validação client-side é UX. Segurança = server-side.

### Passo 2 — Schema explícito:

**Schema explícito**: Nunca aceitar `req.body` sem validação Zod/Pydantic.

### Passo 3 — Limites rígidos:

**Limites rígidos**: `maxLength` em TODOS os campos de texto. Sem limite = DoS por payload grande.

### Passo 4 — Erro genérico:

**Erro genérico**: Respostas de erro NUNCA expõem stack traces, nomes de colunas do banco, ou detalhes de validação em produção.

---

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] CSP configurado (sem `unsafe-eval`, `unsafe-inline` mínimo)
- [ ] HSTS ativo com `preload`
- [ ] X-Frame-Options: DENY (previne clickjacking)
- [ ] X-Powered-By removido (`app.disable('x-powered-by')`)
- [ ] Referrer-Policy restrito
- [ ] Mapeamento de dados pessoais (o que, onde, por que, por quanto tempo)
- [ ] Consentimento explícito para coleta de dados não-essenciais (opt-in, não opt-out)
- [ ] Política de privacidade clara e acessível
- [ ] DPO (Encarregado) com canal de contato público
- [ ] Notificação de vazamento à ANPD em até 72h

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

# Security & Privacy — Manual Operacional

Manual denso de segurança aplicada para sistemas de produção. Baseado em OWASP Top 10 2021 (atualizado 2025), LGPD (Lei 13.709/2018), GDPR, e práticas de secure coding de produção (Stripe, Linear, Vercel).

## Quando usar

- Implementar autenticação, autorização, validação de input, proteção de APIs.
- Revisar código existente quanto a vulnerabilidades (SAST manual).
- Configurar headers de segurança (CSP, CORS, HSTS).
- Garantir compliance LGPD/GDPR (direitos do titular, consentimento, DPO).
- Auditar secrets no código (API keys, JWT, senhas hardcoded).

**Pule** para `code-auditor` quando o foco é SAST completo com relatório; `defense-in-depth` quando é arquitetura de segurança em camadas; `automation-security` quando é segurança de automações (credenciais, logs sanitizados).

---

## Atualização: OWASP Top 10:2025 (8ª edição)

Em 2025 o OWASP publicou a 8ª edição do Top 10 (primeira revisão desde 2021), baseada em análise de mais de 175 mil CVEs e 589 CWEs. A tabela abaixo usa a nomenclatura 2021 (ainda a mais implantada em código legado), mas ao auditar ou desenhar algo novo, aplique o mapeamento 2025:

| Mudança 2021 → 2025 | O que significa na prática |
|---|---|
| **Broken Access Control continua #1** | Segue afetando praticamente toda aplicação testada — RLS/RBAC continuam prioridade #1 de mitigação |
| **SSRF foi absorvido por Broken Access Control** | Trate validação de URL/allowlist de SSRF como parte do controle de acesso, não como categoria isolada |
| **Nova: A03 Software Supply Chain Failures** | "Vulnerable and Outdated Components" virou categoria mais ampla — cobre não só CVEs conhecidos em dependências, mas risco de terceiros/CI-CD (typosquatting, pacotes comprometidos, pipeline poisoning) |
| **Nova: A10 Mishandling of Exceptional Conditions** | Falhas de tratamento de erro/exceção que vazam estado interno ou permitem bypass — reforça a regra de "erro genérico" já usada neste manual |
| **Mudança de foco geral** | De falhas de código isoladas para fraquezas sistêmicas de todo o ciclo de vida (design, config, dependências) |

Fonte: [owasp.org/Top10/2025](https://owasp.org/Top10/2025/).

## OWASP Top 10 — Mitigações Concretas

| # | Vulnerabilidade | Vetor de ataque | Mitigação obrigatória | Código/Ferramenta |
|---|---|---|---|---|
| 1 | **Broken Access Control** | IDOR, privilege escalation, path traversal | RLS (Supabase), middleware RBAC por rota, validação de ownership | `auth.uid() = resource.user_id` em RLS policies |
| 2 | **Cryptographic Failures** | Dados sensíveis em plaintext, TLS ausente | TLS 1.3 (mín. 1.2), hashing com Argon2id, encryption at rest AES-256-GCM | `argon2.hash(password, {type: argon2.argon2id})` |
| 3 | **Injection** | SQL injection, NoSQL injection, command injection | Prepared statements, Zod validation, sanitização de input, NUNCA string concatenation em queries | `db.query('SELECT * FROM users WHERE id = $1', [id])` |
| 4 | **Insecure Design** | Fluxos sem threat modeling | Threat modeling no design, rate limiting em fluxos críticos (login, password reset) | `express-rate-limit: windowMs: 15*60*1000, max: 5` |
| 5 | **Security Misconfiguration** | Headers ausentes, debug em produção, defaults inseguros | CSP restrito, HSTS, X-Content-Type-Options, remover headers de versão (X-Powered-By) | Veja seção "Security Headers" |
| 6 | **Vulnerable Components** | Dependências com CVEs conhecidos | `npm audit`, Dependabot/Renovate, lockfile atualizado, NUNCA ignorar `npm audit` warnings de severidade high/critical | `npm audit --audit-level=high` |
| 7 | **Auth Failures** | Brute force, credential stuffing, session fixation | MFA, rate limiting em login (5 tentativas/15min), session rotation após login, JWT com expiração curta (15min access + 7d refresh) | Supabase Auth + custom middleware |
| 8 | **Data Integrity Failures** | Supply chain attacks, CI/CD pipeline poisoning | CSP com Subresource Integrity (SRI), assinatura de artefatos, npm lockfile integrity | `integrity="sha384-..."` em scripts externos |
| 9 | **Logging Failures** | Falta de audit trail, PII em logs | Audit logging (quem, o que, quando, de onde), NUNCA logar PII (CPF, email, senha), structured logging (JSON) | `logger.info({action: 'login', userId: hash(id), ip: req.ip})` |
| 10 | **SSRF** | Requisições server-side para URLs internas | URL validation com allowlist de domínios, bloquear IPs privados (10.x, 172.16-31.x, 192.168.x), resolver DNS antes de requisitar | `new URL(input).hostname` + allowlist check |

---

## Security Headers (Obrigatórios)

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self'; connect-src 'self' https://*.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
```

### Checklist de headers

- [ ] CSP configurado (sem `unsafe-eval`, `unsafe-inline` mínimo)
- [ ] HSTS ativo com `preload`
- [ ] X-Frame-Options: DENY (previne clickjacking)
- [ ] X-Powered-By removido (`app.disable('x-powered-by')`)
- [ ] Referrer-Policy restrito

---

## Validação de Input (Zod — Padrão Obrigatório)

```typescript
import { z } from 'zod';

// Schema com sanitização + limites rígidos
const userInputSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().toLowerCase(),
  phone: z.string().regex(/^\(\d{2}\)\s\d{4,5}-\d{4}$/).optional(),
  message: z.string().min(10).max(2000).trim(),
  // Anti-injection: nunca aceitar objetos aninhados sem schema explícito
});

// Validação ALWAYS server-side (client-side é UX, não segurança)
const result = userInputSchema.safeParse(req.body);
if (!result.success) {
  return res.status(400).json({ error: 'Invalid input' }); // Genérico — NUNCA expor detalhes de validação
}
```

### Regras de validação

1. **Server-side ALWAYS**: Validação client-side é UX. Segurança = server-side.
2. **Schema explícito**: Nunca aceitar `req.body` sem validação Zod/Pydantic.
3. **Limites rígidos**: `maxLength` em TODOS os campos de texto. Sem limite = DoS por payload grande.
4. **Erro genérico**: Respostas de erro NUNCA expõem stack traces, nomes de colunas do banco, ou detalhes de validação em produção.

---

## Autenticação & Autorização

### Tabela de decisão: método de auth

| Cenário | Método | Implementação |
|---|---|---|
| SaaS com contas de usuário | JWT (access 15min + refresh 7d) + MFA | Supabase Auth ou next-auth |
| API pública | API Key + rate limiting | Header `Authorization: Bearer <key>` |
| API interna (serviço-a-serviço) | mTLS ou JWT com audience claim | Validar `aud` claim no JWT |
| Webhook de terceiros | HMAC signature verification | `crypto.timingSafeEqual(expected, received)` |

### Criptografia

| Uso | Algoritmo | Configuração |
|---|---|---|
| Hash de senha | Argon2id | memoryCost: 65536, timeCost: 3, parallelism: 4 |
| JWT signing | RS256 (assimétrico) | Chave privada no servidor, pública para verificação |
| TLS | TLS 1.3 (mín. 1.2) | Certificado válido, sem self-signed em produção |
| Dados em repouso | AES-256-GCM | IV único por operação, key rotation a cada 90 dias |
| Tokens temporários | crypto.randomBytes(32) | NUNCA Math.random() ou UUIDs para segurança |

### RLS (Row Level Security) — Supabase

```sql
-- Usuário só acessa seus próprios dados
CREATE POLICY "Users see own data" ON profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin acessa tudo
CREATE POLICY "Admins full access" ON profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- NUNCA: tabela sem RLS ativo (expõe todos os dados via API pública)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

---

## API Hardening

| Controle | Implementação | Configuração |
|---|---|---|
| Rate limiting | express-rate-limit / Vercel WAF | Login: 5/15min, API geral: 100/min, Upload: 10/hora |
| Request size limit | body-parser limit / payload size | 10KB para JSON, 5MB para upload |
| CORS | allowlist de domínios | NUNCA `Access-Control-Allow-Origin: *` em produção |
| Idempotency | Idempotency-Key header em mutations | Previne duplicação em retry/retry automático |
| Audit logging | Structured JSON log | `{action, userId, resource, timestamp, ip}` |
| Timeout | Request timeout | 30s para API, 5min para upload |

### OWASP API Security Top 10 (2023 — ainda vigente em 2026, sem revisão nova publicada)

Referência específica para APIs (distinta do Top 10 web geral) — usada por auditores de PCI-DSS/HIPAA/GDPR/DORA como checklist de linha de base:

| # | Risco | Mitigação no contexto deste manual |
|---|---|---|
| API1 | Broken Object Level Authorization (BOLA/IDOR) | Ownership check por request — nunca confiar em ID vindo do client sem validar `auth.uid()` |
| API2 | Broken Authentication | Ver tabela de Autenticação & Autorização acima |
| API3 | Broken Object Property Level Authorization | Validar quais campos cada role pode ler/escrever — Zod schema por role, não um schema único genérico |
| API4 | Unrestricted Resource Consumption | Rate limiting + `maxLength`/payload size já cobertos acima; adicionar limite de paginação (`limit` máx.) |
| API5 | Broken Function Level Authorization | Middleware RBAC por rota, nunca checagem só no frontend |
| API6 | Unrestricted Access to Sensitive Business Flows | Rate limit dedicado em fluxos de negócio sensíveis (checkout, reset de senha, criação de conta) além do rate limit geral |
| API7 | SSRF | Ver linha SSRF na tabela OWASP Top 10 acima |
| API8 | Security Misconfiguration | Ver seção Security Headers |
| API9 | Improper Inventory Management | Manter inventário de endpoints/versões ativas; desligar versões antigas de API (`/v1` órfã é superfície de ataque esquecida) |
| API10 | Unsafe Consumption of APIs | Validar/sanitizar respostas de APIs de terceiros como se fossem input não confiável — nunca repassar direto ao client |

---

## LGPD (Lei Geral de Proteção de Dados)

### Direitos do titular (implementação obrigatória)

| Direito | API/Funcionalidade | Implementação |
|---|---|---|
| Acesso | `GET /api/me/data` | Endpoint que retorna todos os dados pessoais do usuário |
| Correção | `PATCH /api/me/profile` | Editar dados pessoais no perfil |
| Exclusão | `DELETE /api/me/account` | Deletar conta + anonimizar dados em logs e backups |
| Portabilidade | `GET /api/me/export` | Exportar dados em JSON/CSV |
| Revogação | `POST /api/me/consent` | Opt-out de comunicações e processamento não-essencial |

### Obrigações técnicas

- [ ] Mapeamento de dados pessoais (o que, onde, por que, por quanto tempo)
- [ ] Consentimento explícito para coleta de dados não-essenciais (opt-in, não opt-out)
- [ ] Política de privacidade clara e acessível
- [ ] DPO (Encarregado) com canal de contato público
- [ ] Notificação de vazamento à ANPD em até 72h
- [ ] Dados pessoais NUNCA em logs (mascarar CPF: `***.***.***-XX`, email: `j***@***.com`)
- [ ] Retenção definida por tipo de dado (ex: logs de acesso: 6 meses, conta: até exclusão)

### Atualização regulatória ANPD (2026)

Em dez/2025 a ANPD publicou o Mapa de Temas Prioritários 2026-2027 e atualizou a Agenda Regulatória 2025-2026 — 19 temas prioritários incluem: direitos do titular, RIPD (Relatório de Impacto), dados sensíveis (biométricos/saúde), compartilhamento de dados pelo Poder Público e **inteligência artificial** (prioridade explícita do novo ciclo). Implicação prática: a Resolução de Dosimetria da ANPD **reduz sanções** para organizações que comprovam documentação estruturada (inventário de dados, políticas, contratos com operadores, registros de treinamento, evidência de resposta a incidente) — manter essa documentação viva não é burocracia, é redução de risco financeiro direto em fiscalização. Site oficial: [gov.br/anpd](https://www.gov.br/anpd/pt-br).

---

## Anti-padrões (NUNCA)

| Anti-padrão | Risco | Fix |
|---|---|---|
| `catch {}` vazio em auth | Engole falha de autenticação | Logar + retornar 401/403 |
| `any` em payload de API | Bypass de validação de tipo | Schema Zod explícito |
| Secret em `NEXT_PUBLIC_*` | Secret exposto no client bundle | Mover para variável server-only |
| `dangerouslySetInnerHTML` sem sanitização | XSS | Sanitizar com DOMPurify antes |
| JWT sem expiração | Session hijacking permanente | `exp` claim obrigatório (15min access) |
| Comparação de token com `===` | Timing attack | `crypto.timingSafeEqual()` |
| Log de senha/token em plaintext | Leak de credenciais | NUNCA logar dados sensíveis |
| `SELECT *` sem RLS | Exposição de dados de outros usuários | RLS ativo + queries específicas |

---

## Composição com outras skills

- **Antes**: `code-auditor` (SAST completo), `defense-in-depth` (arquitetura em camadas)
- **Durante**: `automation-security` (credenciais de automação), `data-validation` (sanitização)
- **Depois**: `qa` (verificação de segurança no checklist), `self-critique` (auditoria final)

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

Atualizações 2025/2026 usadas nesta revisão: [OWASP Top 10:2025](https://owasp.org/Top10/2025/) (8ª edição — Software Supply Chain Failures e Mishandling of Exceptional Conditions são novas; SSRF mesclado em Broken Access Control) e o site oficial da [ANPD](https://www.gov.br/anpd/pt-br) (Mapa de Temas Prioritários 2026-2027 e Agenda Regulatória).
