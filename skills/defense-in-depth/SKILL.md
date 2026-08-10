---
name: defense-in-depth
description: "Estratégia de segurança e robustez em camadas (Defense in Depth): implementação de múltiplas barreiras defensivas independentes (validação de entrada, sanitização, autenticação, autorização por rota, validação de saída, auditoria e sandboxing) para que a falha de uma camada não comprometa o sistema. Use ao projetar sistemas críticos, APIs sensíveis ou rotas de autenticação."
---

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
