# References — Error Recovery

> Curadoria (2026) para resiliência de automações: retries, checkpoints e idempotência.

## Docs canônicas
- [AWS Builders Library: Timeouts, retries and backoff with jitter](https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/)
- [tenacity](https://tenacity.readthedocs.io) — retry em Python
- [Martin Fowler: Patterns of distributed systems](https://martinfowler.com/articles/patterns-of-distributed-systems/)

## Referências e inspiração
- [Idempotency keys (Stripe)](https://stripe.com/blog/idempotency) — padrão de re-execução segura
- [Chaos engineering principles](https://principlesofchaos.org) — testar falhas de propósito
- [Saga pattern](https://microservices.io/patterns/data/saga.html) — compensação de passos

## Comunidade / tutoriais
- [Circuit breaker pattern](https://martinfowler.com/bliki/CircuitBreaker.html)
- [Retry storms (GCP)](https://cloud.google.com/blog/products/gcp/using-gcp-to-mitigate-retry-storms)
- [Backoff algorithms](https://github.com/google/exponential-backoff) — exp + jitter
