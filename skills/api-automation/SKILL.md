---
name: api-automation
description: "Automacao de integracoes via API (REST/HTTP): autenticacao, headers, paginacao, rate limits, retries, validacao de respostas e integracao entre servicos com httpx/requests. Use para integrar sistemas via API de forma confiavel."
---

# API Automation — Integração de Serviços Confiável

## Quando usar

- Integrar sistemas via API (REST/GraphQL).
- Enviar/receber dados em lote (melhor que browser automation).
- Sincronizar dados entre serviços.

## Ferramentas

- **httpx** (moderno): client com timeouts, retries e suporte async. `httpx.Client(timeout=...)`.
- **requests** quando o ambiente exige.
- **Pydantic** para validar respostas (schemas de saída).

## Padrões obrigatórios

1. **Timeouts explícitos**: nunca deixe timeout default infinito em produção.
2. **Retries com backoff**: `tenacity` (retry para 429/5xx/timeout; NÃO para 4xx de validação — esses são permanentes).
3. **Rate limits**: respeite headers `X-RateLimit-*`/`Retry-After`; throttle entre requests quando necessário.
4. **Autenticação**: tokens via env; refresh automático de token expirado quando o fluxo permitir.
5. **Paginação**: loop até não haver `next` (link header ou campo de resposta) com limite de segurança.
6. **Validação de resposta**: `response.raise_for_status()` + validação do corpo com Pydantic + verificação semântica (ex: status do registro criado).
7. **Idempotência**: use chaves de idempotência/`Idempotency-Key` quando a API suportar; em lote, registre quais itens foram aceitos.
8. **Batching**: envie em lote quando a API suportar (reduz chamadas e rate limits).

## Estrutura de erro

- Distinguir: 4xx (permanente — não retry, log motivo), 5xx/timeout (transitório — retry com backoff), desconhecido (registrar, não assumir).
- Nunca `except: pass` — sempre logue status, corpo resumido (sem secrets) e contexto.

## References

- httpx: https://www.python-httpx.org · requests: https://requests.readthedocs.io · tenacity: https://tenacity.readthedocs.io
- Ver skill `automation-engineer` (fluxo completo) e `data-validation`.
