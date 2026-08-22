# References — Automation Optimization

> Curadoria (2026) para otimização de automações: gargalos, paralelismo, batching e caching.

## Docs canônicas
- [httpx: streaming & async](https://www.python-httpx.org) — batching e concorrência de chamadas HTTP
- [concurrent.futures](https://docs.python.org/3/library/concurrent.futures.html) — ThreadPoolExecutor/ProcessPoolExecutor
- [asyncio (stdlib)](https://docs.python.org/3/library/asyncio.html) — I/O-bound em escala

## Referências e inspiração
- [Ten rules for parallelizing Python](https://pythonspeed.com/articles/parallelism-smarter/) — quando paralelizar de verdade
- [httpx: connection pooling](https://www.python-httpx.org/advanced/clients/) — reuso de conexões (sem pool = gargalo escondido)
- [functools.lru_cache](https://docs.python.org/3/library/functools.html) — memoização de chamadas repetidas

## Comunidade / tutoriais
- [Real Python: concurrency](https://realpython.com/python-concurrency/) — threads vs async vs processos
- [Request batching patterns](https://github.com/pedrohenriquesanchesleal4-debug/izanagi-ai) — docs de automações com dry-run (repo do framework)
- [Slow down? Measure first](https://docs.python.org/3/library/cProfile.html) — profiler antes de otimizar
