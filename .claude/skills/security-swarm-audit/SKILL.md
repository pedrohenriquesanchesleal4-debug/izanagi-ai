---
name: security-swarm-audit
description: "Auditoria de segurança em enxame com refutação. Use antes de lançar, antes de receber pagamento ou ao auditar código gerado por IA."
---

# Security Swarm Audit: caçar, refutar, reportar só o real

Inspirada no desenho público do `cloudflare/security-audit-skill` (MIT): quem acha bug não é quem confirma bug. Relatório de segurança com 40 falsos positivos é ignorado; com 6 achados provados, é corrigido.

## Quando usar

- Antes do primeiro deploy público, antes de ligar pagamento, depois de grande refactor de auth.
- Em qualquer app gerado majoritariamente por IA.

**Pule** para scripts locais sem rede, sem dado de usuário e sem segredo.

## Fase 0: as 5 portas de app feito com IA (checar primeiro, é barato)

| # | Porta | Como verificar |
|---|---|---|
| 1 | Segredo em variável pública | `grep -rE "NEXT_PUBLIC_.*(SECRET|KEY|TOKEN)|VITE_.*SECRET|service_role" .` e bundle do client |
| 2 | Banco sem RLS / sem autorização por linha | Supabase: toda tabela com `enable row level security` e policy; outros: toda query filtra por dono |
| 3 | IDOR: recurso de outro cliente a um ID de distância | Trocar `/orders/123` por `/orders/124` com outro usuário logado deve dar 403/404 |
| 4 | Webhook de pagamento sem assinatura conferida | Handler valida assinatura (`stripe.webhooks.constructEvent` ou equivalente) e é idempotente |
| 5 | O resto | Dependências com CVE (`npm audit`/`pip-audit`), login sem rate limit, sem proteção a bots, sem WAF com regras OWASP |

## Fase 1: mapa da superfície

Liste em arquivo (`.agents/security/surface.md`): rotas e handlers, pontos de autenticação, acesso a banco, chamadas externas, uploads, webhooks, pontos onde texto de usuário chega a um LLM. Uma linha por item com `arquivo:linha`.

## Fase 2: caçadores (paralelo)

Um agente por superfície, cada um recebe só o mapa e o seu foco:

- **auth**: sessão, reset de senha, JWT, OAuth state, escalonamento de privilégio
- **dados**: injeção (SQL/NoSQL/comando), RLS, IDOR, mass assignment
- **api**: rate limit, CORS, validação de entrada, SSRF
- **pagamento**: webhook, idempotência, preço vindo do client
- **llm**: prompt injection direta e indireta, vazamento de system prompt, tool call sem confirmação

Cada achado sai no formato: `id, superfície, arquivo:linha, hipótese de exploração, severidade estimada`.

## Fase 3: refutação (o filtro)

Cada achado vai para um agente **novo** com a instrução: *"Prove que este bug não existe. Procure validação a montante, middleware, policy, tipo que impeça a entrada. Se não conseguir refutar, descreva o caminho exato de exploração."*

Resultado por achado: `REFUTADO` (com o motivo), `CONFIRMADO` (com caminho de exploração) ou `PRECISA VALIDAÇÃO` (não dá para provar estático; diga qual teste rodar).

## Fase 4: relatório

`.agents/security/report.md` com apenas CONFIRMADO e PRECISA VALIDAÇÃO, ordenados por severidade. Para cada um: arquivo:linha, exploração em 2 linhas, correção com diff sugerido, teste que prova a correção.

## Regras

- Não execute exploração contra ambiente de produção nem contra sistema de terceiro. Análise estática e testes locais apenas.
- Achado sem `arquivo:linha` não entra.
- Sem subagentes disponíveis: rode as fases em sequência, mas faça a refutação depois de terminar a caça, relendo o código do zero.

> Gerado pelo Izanagi AI: cópia fiel de `skills/security-swarm-audit/SKILL.md` (fonte da verdade).
