# References — API Automation

> Curadoria (2026) para integração confiável entre sistemas via API REST/HTTP.

## Docs canônicas
- [httpx](https://www.python-httpx.org) — client HTTP moderno (timeout, pooling, async)
- [tenacity](https://tenacity.readthedocs.io) — retries com backoff/jitter
- [Pydantic v2](https://docs.pydantic.dev) — validação de schema de respostas

## Referências e inspiração
- [HTTP Semantics (RFC 9110)](https://www.rfc-editor.org/rfc/rfc9110) — status codes, headers de rate limit
- [Retry-After header (RFC 9110 §10.2.3)](https://www.rfc-editor.org/rfc/rfc9110#section-10.2.3)
- [Idempotency (RFC 9110 §9.2)](https://www.rfc-editor.org/rfc/rfc9110#section-9.2) — PUT/upsert sem duplicar

## Comunidade / tutoriais
- [Real Python: httpx](https://realpython.com/python-httpx-a-comprehensive-overview/)
- [API design best practices (Google)](https://cloud.google.com/apis/design)
- [HTTP API guidelines (Microsoft)](https://github.com/microsoft/api-guidelines)
