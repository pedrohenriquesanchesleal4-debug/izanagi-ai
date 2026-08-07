---
name: automation-optimization
description: "Otimizacao de automacoes: gargalos (I/O, rede, memoria, processamento), paralelismo seguro, batching, caching e reducao de execucoes desnecessarias. Use para tornar automacoes rapidas sem sacrificar confiabilidade."
---

# Automation Optimization — Rápido Sem Quebrar

## Caça aos gargalos (nesta ordem)

1. **I/O e rede**: chamadas HTTP em série → lote/batch quando a API suportar; reuso de conexão (`httpx.Client`).
2. **Browser automation**: 10.000 cliques é sintoma — existe API? Dá para paralelizar páginas?
3. **Processamento**: pandas vectorizado (`apply`/vector ops) em vez de loop Python em linhas.
4. **Memória**: arquivos grandes → chunks; não carregar tudo em RAM.
5. **Execuções desnecessárias**: se só mudou X, reprocessar só X (checkpoints/delta).

## Paralelismo seguro

- `ThreadPoolExecutor`/`asyncio` para I/O-bound (API, rede); processos para CPU-bound.
- **Respeite rate limits** do destino (semaphore, throttle, headers de rate limit).
- Erros em paralelo: capture e agregue resultados por item — nunca perca contexto.
- Só paralelize quando a ordem não importa e o destino aguenta.

## Regras

- **Performance nunca destrói confiabilidade**: otimização que aumenta taxa de falha é regressão.
- Meça antes de otimizar (tempo por etapa) — otimizar sem métrica é achismo.
- Documente o ganho (ex: "de 45min para 4min com batching").

## References

- httpx (client reutilizável): https://www.python-httpx.org · tenacity (retry+backoff): https://tenacity.readthedocs.io
- Ver skills `automation-engineer`, `api-automation`.
