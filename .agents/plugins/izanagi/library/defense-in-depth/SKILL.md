---
name: "defense-in-depth"
description: "Projeta segurança em camadas independentes (rate limit, validação de entrada, autorização, persistência segura) para que a falha de uma não comprometa o sistema. Use em auth, APIs públicas ou dados sensíveis. Gatilhos de ativação: defense in depth (segurança e robustez em camadas); quando usar; as 5 camadas defensivas na aplicação; exemplo de implementação em camadas (typescript / next.js api)."
version: 2.0.0
category: security
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
---

# Defense in Depth (Segurança e Robustez em Camadas)

> Migrado deterministicamente de `skills/defense-in-depth/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Segurança (`security`)
- **Resumo:** Projeta segurança em camadas independentes (rate limit, validação de entrada, autorização, persistência segura) para que a falha de uma não comprometa o sistema.
- **Ativar quando:** Use em auth, APIs públicas ou dados sensíveis.
- **Escopo canônico:** Defense in Depth (Segurança e Robustez em Camadas)
- **Seções do corpo original:** Quando usar · As 5 Camadas Defensivas na Aplicação · Exemplo de Implementação em Camadas (TypeScript / Next.js API) · Checklist de qualidade (antes de entregar) · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Confiar cegamente no cliente (frontend valida, backend confia)

❌ Confiar cegamente no cliente (frontend valida, backend confia)

### Passo 2 — ❌ Autenticação sem checagem de autorização (qualquer usuário logado acessa dados de qua...

❌ Autenticação sem checagem de autorização (qualquer usuário logado acessa dados de qualquer outro - IDOR)

### Passo 3 — ❌ Concatenação de variáveis de usuário direto em queries SQL

❌ Concatenação de variáveis de usuário direto em queries SQL

### Passo 4 — ❌ Depender de uma única barreira de segurança para proteger dados críticos

❌ Depender de uma única barreira de segurança para proteger dados críticos

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Entrada de dados validada por schema rígido (Zod/Pydantic) antes de qualquer lógica
- [ ] Autenticação verificada em todas as rotas protegidas
- [ ] Autorização (permissão/IDOR) validada explicitamente em nível de registro/recurso
- [ ] Consultas ao banco parametrizadas (zero concatenação de strings SQL)
- [ ] Tratamento de erros seguro (sem stack traces ou dados sensíveis vazados na resposta)

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

# Defense in Depth (Segurança e Robustez em Camadas)

Estratégia arquitetural onde **múltiplas camadas defensivas independentes** são implementadas em cascata. Se uma camada falhar ou for burlada, as camadas subsequentes impedem a brecha ou a corrupção do sistema.

## Quando usar

Use ao: projetar fluxos de autenticação/autorização; construir APIs públicas que recebem dados não confiáveis; manipular dados sensíveis (LGPD/Financeiro); endurecer sistemas contra vulnerabilidades do OWASP Top 10. **Pule** para: scripts internos descartáveis de uso único.

## As 5 Camadas Defensivas na Aplicação

```yaml
camada_1_perimetro: "Rate Limiting & Firewall WAF (bloqueio de IPs maliciosos e brute-force)"
camada_2_transporte: "TLS 1.3 obrigatório, Headers de segurança (CSP, HSTS, X-Frame-Options)"
camada_3_entrada: "Validação estrita de schema (Pydantic / Zod) + Sanitização contra Injection"
camada_4_logica: "Verificação explícita de autorização (RBAC/ABAC) em cada serviço/endpoint (IDOR check)"
camada_5_persistencia: "Prepared statements / ORM parametrizado + criptografia em repouso"
```

## Exemplo de Implementação em Camadas (TypeScript / Next.js API)

```typescript
// Camada 3 (Input) + Camada 4 (Auth/Authorization) + Camada 5 (Safe DB)
import { z } from 'zod';
import { verifySession } from '@/lib/auth';
import { db } from '@/lib/db';

const UpdateSchema = z.object({
  name: z.string().min(2).max(100),
  bio: z.string().max(500).optional(),
});

export async function updateProfile(req: Request) {
  // 1. Camada de Autenticação
  const session = await verifySession(req);
  if (!session) return new Response('Unauthorized', { status: 401 });

  // 2. Camada de Validação de Entrada (Schema)
  const body = await req.json();
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return new Response('Invalid input', { status: 400 });

  // 3. Camada de Autorização (IDOR check)
  // Garantimos que o usuário só altera o próprio perfil ou é admin
  const targetUserId = req.headers.get('x-target-user');
  if (targetUserId && targetUserId !== session.userId && !session.isAdmin) {
    return new Response('Forbidden', { status: 403 });
  }

  // 4. Camada de Persistência Segura (ORM parametrizado)
  const updated = await db.user.update({
    where: { id: session.userId },
    data: parsed.data,
  });

  return Response.json(updated);
}
```

## Checklist de qualidade (antes de entregar)
- [ ] Entrada de dados validada por schema rígido (Zod/Pydantic) antes de qualquer lógica
- [ ] Autenticação verificada em todas as rotas protegidas
- [ ] Autorização (permissão/IDOR) validada explicitamente em nível de registro/recurso
- [ ] Consultas ao banco parametrizadas (zero concatenação de strings SQL)
- [ ] Tratamento de erros seguro (sem stack traces ou dados sensíveis vazados na resposta)

## Anti-padrões (proibido)
1. ❌ Confiar cegamente no cliente (frontend valida, backend confia)
2. ❌ Autenticação sem checagem de autorização (qualquer usuário logado acessa dados de qualquer outro - IDOR)
3. ❌ Concatenação de variáveis de usuário direto em queries SQL
4. ❌ Depender de uma única barreira de segurança para proteger dados críticos

## Composição com outras skills
- **Antes**: `architect` (design em camadas) → `security` (padrões OWASP)
- **Depois**: `code-auditor` (SAST manual) → `qa` (testes de segurança)

## References
- OWASP Defense in Depth: https://cheatsheetseries.owasp.org · NIST Cybersecurity Framework.
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
