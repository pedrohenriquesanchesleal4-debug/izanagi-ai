---
name: "payments-billing"
description: "Integração de pagamentos e cobrança recorrente (Stripe/Paddle/Mercado Pago): checkout, assinaturas, webhooks com verificação de assinatura, idempotência e reconciliação de estado. Use ao implementar cobrança, planos pagos ou checkout em qualquer produto. Gatilhos de ativação: skill payments & billing — izanagi; identidade; provedores; as 3 garantias obrigatórias de todo webhook de pagamento."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill Payments & Billing — Izanagi

> Migrado deterministicamente de `skills/payments-billing/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Integração de pagamentos e cobrança recorrente (Stripe/Paddle/Mercado Pago): checkout, assinaturas, webhooks com verificação de assinatura, idempotência e reconciliação de estado.
- **Ativar quando:** Use ao implementar cobrança, planos pagos ou checkout em qualquer produto.
- **Escopo canônico:** Skill Payments & Billing — Izanagi
- **Seções do corpo original:** Identidade · Provedores · As 3 Garantias Obrigatórias de Todo Webhook de Pagamento · Nunca Confiar no Retorno do Frontend · Assinaturas: Estados e Eventos Essenciais
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Verificação de assinatura:

**Verificação de assinatura**: valide o header de assinatura (`Stripe-Signature`, `X-Signature`...) contra o webhook secret ANTES de processar qualquer payload. Nunca confie em `req.body` sem essa etapa: qualquer um pode POSTar num endpoint público simulando "pagamento aprovado".

### Passo 2 — Idempotência:

**Idempotência**: grave o `event.id` processado (tabela `processed_events` ou equivalente) e descarte duplicados. O provedor reenvia o mesmo evento se seu endpoint não responder 2xx a tempo (Stripe retenta por até 72h com backoff exponencial) — processar o mesmo evento duas vezes deve produzir o mesmo resultado que processar uma vez.

### Passo 3 — Resposta rápida (ack-then-process):

**Resposta rápida (ack-then-process)**: responda `200` assim que a assinatura for válida e o evento estiver enfileirado; processe a lógica de negócio (liberar acesso, enviar e-mail, atualizar plano) de forma assíncrona. Handler lento demais faz o provedor considerar timeout e reenviar, multiplicando processamento duplicado.

```ts
// Handler mínimo correto (Next.js Route Handler / Express)
const sig = req.headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret); // lança se assinatura inválida

const already = await db.processedEvents.findUnique({ where: { id: event.id } });
if (already) return res.status(200).send("duplicate, ignored");

await db.processedEvents.create({ data: { id: event.id, type: event.type } });
await queue.enqueue("billing.process", event); // processamento pesado fora do request
return res.status(200).send("ok");
```

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Toda rota de webhook verifica assinatura antes de tocar no payload
- [ ] Tabela de eventos processados com constraint única em `event.id`
- [ ] Handler responde 2xx rápido; lógica pesada é assíncrona (fila/job)
- [ ] Liberação de acesso depende do webhook, nunca do retorno de navegador
- [ ] `Idempotency-Key` em toda chamada de criação de cobrança originada por ação do usuário
- [ ] Ambiente de teste usa modo sandbox/test do provedor com chaves e webhook secret próprios (nunca live keys em dev)
- [ ] Segredos do provedor (secret key, webhook secret) vêm de variável de ambiente/secret manager (`automation-security`), nunca hardcoded

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Skill Payments & Billing — Izanagi

## Identidade

Você projeta cobrança para produção: todo webhook de pagamento chega em rede não confiável, pode chegar duplicado, fora de ordem ou nunca chegar. O padrão "funciona no dev" (marcar como pago direto no retorno do checkout) é a causa raiz mais comum de assinatura fantasma, cobrança duplicada e usuário pago sem acesso liberado.

## Provedores

| Ferramenta | Uso |
|------------|-----|
| Stripe | Padrão de mercado para SaaS internacional: Checkout, Billing, Connect |
| Paddle | Merchant of Record (Paddle é o vendedor legal: cobre VAT/sales tax automaticamente) |
| Mercado Pago | Padrão para produto focado em Brasil/LatAm (PIX, boleto, cartão local) |
| LemonSqueezy | Merchant of Record, alternativa mais simples ao Paddle para indie/SaaS pequeno |

Merchant of Record (Paddle/LemonSqueezy) elimina a responsabilidade de calcular/recolher imposto sobre venda digital em múltiplos países; Stripe puro (não Stripe Tax) deixa essa responsabilidade com o vendedor.

## As 3 Garantias Obrigatórias de Todo Webhook de Pagamento

1. **Verificação de assinatura**: valide o header de assinatura (`Stripe-Signature`, `X-Signature`...) contra o webhook secret ANTES de processar qualquer payload. Nunca confie em `req.body` sem essa etapa: qualquer um pode POSTar num endpoint público simulando "pagamento aprovado".
2. **Idempotência**: grave o `event.id` processado (tabela `processed_events` ou equivalente) e descarte duplicados. O provedor reenvia o mesmo evento se seu endpoint não responder 2xx a tempo (Stripe retenta por até 72h com backoff exponencial) — processar o mesmo evento duas vezes deve produzir o mesmo resultado que processar uma vez.
3. **Resposta rápida (ack-then-process)**: responda `200` assim que a assinatura for válida e o evento estiver enfileirado; processe a lógica de negócio (liberar acesso, enviar e-mail, atualizar plano) de forma assíncrona. Handler lento demais faz o provedor considerar timeout e reenviar, multiplicando processamento duplicado.

```ts
// Handler mínimo correto (Next.js Route Handler / Express)
const sig = req.headers["stripe-signature"];
const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret); // lança se assinatura inválida

const already = await db.processedEvents.findUnique({ where: { id: event.id } });
if (already) return res.status(200).send("duplicate, ignored");

await db.processedEvents.create({ data: { id: event.id, type: event.type } });
await queue.enqueue("billing.process", event); // processamento pesado fora do request
return res.status(200).send("ok");
```

## Nunca Confiar no Retorno do Frontend

Liberar acesso pago no `success_url` do checkout (redirect do navegador) é a falha mais comum: o usuário pode fechar a aba antes do redirect, o navegador pode falhar, ou o pagamento pode ser recusado depois da tela de "sucesso" (métodos assíncronos: boleto, PIX, débito SEPA). **A única fonte de verdade de que um pagamento foi confirmado é o webhook do provedor no backend.** O `success_url` só melhora a UX (mostra "processando..."); nunca decide o estado do banco.

## Assinaturas: Estados e Eventos Essenciais

| Evento | Ação |
|--------|------|
| `checkout.session.completed` | Vincular customer_id do provedor ao usuário; se for assinatura, aguardar `invoice.paid` para liberar (evita liberar em método assíncrono ainda pendente) |
| `invoice.paid` | Liberar/renovar acesso; resetar contador de falha de cobrança |
| `invoice.payment_failed` | Iniciar dunning (retry automático do provedor + e-mail); não revogar acesso na primeira falha |
| `customer.subscription.updated` | Sincronizar plano/quantidade/status local com o provedor (upgrade/downgrade/pausa) |
| `customer.subscription.deleted` | Revogar acesso ao fim do período já pago (nunca instantaneamente, salvo cancelamento imediato explícito) |

Dunning (retentativa de cobrança falha): configure o provedor para tentar novamente por alguns dias antes de suspender; revogar no primeiro `payment_failed` cancela clientes por falha temporária de cartão, não por decisão real.

## Idempotência do Lado do Cliente (Requisições, Não Só Webhooks)

Ao criar uma cobrança/checkout a partir de uma ação do usuário (ex: clique duplo, retry de rede), envie uma `Idempotency-Key` determinística (ex: hash de `userId + planId + timestamp arredondado`) na chamada à API do provedor. Isso é a segunda camada de proteção contra cobrança duplicada, independente da idempotência de webhook (que protege o lado do recebimento).

## Métricas a Monitorar

| Métrica | Meta |
|---|---|
| Taxa de sucesso de entrega de webhook | > 99% |
| Tempo de processamento por evento | < 500ms até resposta 200 |
| Lag entre evento gerado e processado | Alertar se > alguns minutos |

## Checklist Antes de Produção

- [ ] Toda rota de webhook verifica assinatura antes de tocar no payload
- [ ] Tabela de eventos processados com constraint única em `event.id`
- [ ] Handler responde 2xx rápido; lógica pesada é assíncrona (fila/job)
- [ ] Liberação de acesso depende do webhook, nunca do retorno de navegador
- [ ] `Idempotency-Key` em toda chamada de criação de cobrança originada por ação do usuário
- [ ] Ambiente de teste usa modo sandbox/test do provedor com chaves e webhook secret próprios (nunca live keys em dev)
- [ ] Segredos do provedor (secret key, webhook secret) vêm de variável de ambiente/secret manager (`automation-security`), nunca hardcoded

## Skills Relacionadas

- `security-privacy` — segredos, LGPD/GDPR para dados de pagamento
- `automation-security` — gestão de credenciais do provedor
- `error-recovery` — retry/backoff para chamadas à API do provedor
- `observability-expert` — tracing do fluxo checkout → webhook → liberação de acesso

## References

Veja `references.md` nesta pasta: curadoria das fontes oficiais (Stripe Docs, Paddle Docs) para este tópico.
