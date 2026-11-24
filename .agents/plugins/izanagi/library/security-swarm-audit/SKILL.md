---
name: "security-swarm-audit"
description: "Auditoria de segurança em enxame com refutação: mapeia o app, despacha caçadores por superfície (auth, dados, API, pagamento, prompt injection) e manda cada achado para um agente que tenta provar que ele NÃO existe. Só o que sobrevive vai ao relatório, com correção. Inclui as 5 portas abertas de apps feitos com IA. Use antes de lançar, antes de receber pagamento ou ao auditar código gerado por IA. Gatilhos de ativação: security swarm audit: caçar, refutar, reportar só o real; quando usar; fase 0: as 5 portas de app feito com ia (checar primeiro, é barato); fase 1: mapa da superfície."
version: 2.0.0
category: security
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
---

# Security Swarm Audit: caçar, refutar, reportar só o real

> Migrado deterministicamente de `skills/security-swarm-audit/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Segurança (`security`)
- **Resumo:** Auditoria de segurança em enxame com refutação: mapeia o app, despacha caçadores por superfície (auth, dados, API, pagamento, prompt injection) e manda cada achado para um agente que tenta provar que ele NÃO existe. Só o que sobrevive vai ao relatório, com correção. Inclui as 5 portas abertas de apps feitos com IA.
- **Ativar quando:** Use antes de lançar, antes de receber pagamento ou ao auditar código gerado por IA.
- **Escopo canônico:** Security Swarm Audit: caçar, refutar, reportar só o real
- **Seções do corpo original:** Quando usar · Fase 0: as 5 portas de app feito com IA (checar primeiro, é barato) · Fase 1: mapa da superfície · Fase 2: caçadores (paralelo) · Fase 3: refutação (o filtro)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Inspirada no desenho público do cloudflare/security-audit-skill (MIT):

Inspirada no desenho público do `cloudflare/security-audit-skill` (MIT): quem acha bug não é quem confirma bug. Relatório de segurança com 40 falsos positivos é ignorado; com 6 achados provados, é corrigido.

### Passo 2 — Pule para scripts locais sem rede, sem dado de usuário e sem segredo.

**Pule** para scripts locais sem rede, sem dado de usuário e sem segredo.

### Passo 3 — Dois testes baratos que pegam muita coisa:

Dois testes baratos que pegam muita coisa:

### Passo 4 — Liste em arquivo (.agents/security/surface.md):

Liste em arquivo (`.agents/security/surface.md`): rotas e handlers, pontos de autenticação, acesso a banco, chamadas externas, uploads, webhooks, pontos onde texto de usuário chega a um LLM. Uma linha por item com `arquivo:linha`.

### Passo 5 — Um agente por superfície, cada um recebe só o mapa e o seu foco:

Um agente por superfície, cada um recebe só o mapa e o seu foco:

### Passo 6 — Cada achado sai no formato:

Cada achado sai no formato: `id, superfície, arquivo:linha, hipótese de exploração, severidade estimada`.

### Passo 7 — Cada achado vai para um agente novo com a instrução:

Cada achado vai para um agente **novo** com a instrução: *"Prove que este bug não existe. Procure validação a montante, middleware, policy, tipo que impeça a entrada. Se não conseguir refutar, descreva o caminho exato de exploração."*

### Passo 8 — Resultado por achado:

Resultado por achado: `REFUTADO` (com o motivo), `CONFIRMADO` (com caminho de exploração) ou `PRECISA VALIDAÇÃO` (não dá para provar estático; diga qual teste rodar).

### Passo 9 — .agents/security/report.md com apenas CONFIRMADO e PRECISA VALIDAÇÃO, ordenados por sev...

`.agents/security/report.md` com apenas CONFIRMADO e PRECISA VALIDAÇÃO, ordenados por severidade. Para cada um: arquivo:linha, exploração em 2 linhas, correção com diff sugerido, teste que prova a correção.

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

Dois testes baratos que pegam muita coisa:

- **SSTI / injeção de template:** em todo campo que volta renderizado (nome no e-mail de boas-vindas, título de página, PDF), envie `{{7*7}}` e `${7*7}`. Se aparecer `49`, o servidor está executando entrada do usuário como template. Correção: nunca montar template a partir de string do usuário; passar como variável escapada.
- **Container comprometido = banco comprometido?** Verifique se a credencial do banco está em variável de ambiente legível pelo processo web e se a role/IAM do container pode mais do que a aplicação precisa. Correção: segredo buscado em runtime de um secret manager, usuário de banco com permissão mínima por serviço, sem `*` em policy.

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
