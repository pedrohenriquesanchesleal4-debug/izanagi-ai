---
name: automation-optimization
description: "Otimização de automações sem sacrificar confiabilidade: caça a gargalos na ordem certa (I/O, rede, browser, processamento, memória, execuções redundantes), paralelismo seguro com rate limits, batching, caching, checkpoints/delta processing, métricas antes/depois e documentação do ganho. Use para tornar automações rápidas, baratas e estáveis."
---

# Automation Optimization — Rápido Sem Quebrar

Otimizar automação é **reduzir tempo/custo mantendo ou melhorando a confiabilidade**. Regra de ouro: otimização que aumenta taxa de falha é regressão, não melhoria. Toda otimização exige métrica antes/depois.

## Quando usar

Use quando a automação: demora demais (minutos→horas), estoura rate limits, consome memória excessiva, refaz trabalho já feito, ou quando o custo de execução (API paga, infra) precisa cair. **Pule** para automações que já rodam em segundos e sem falhas — não otimize o que não é gargalo.

## Caça aos gargalos (nesta ordem — meça cada etapa antes de tocar)

| # | Gargalo | Sintoma | Fix primário |
|---|---|---|---|
| 1 | **I/O e rede** | chamadas HTTP em série, lentidão constante | `httpx.Client` reutilizado, batching quando a API suporta, compressão |
| 2 | **Browser automation** | 10.000 cliques/scrolls, esperas longas | existe API? paralelizar páginas/abas? reduzir esperas com waits explícitos |
| 3 | **Processamento** | loop Python linha a linha | pandas vectorizado, numpy, paralelismo CPU |
| 4 | **Memória** | pico de RAM, swap, crash em arquivo grande | chunks, streaming, `read_only`, descartar colunas não usadas |
| 5 | **Execuções redundantes** | reprocessa tudo quando mudou 1 item | checkpoints, delta processing, cache de resultados imutáveis |

**Regra de medição**: `time` por etapa (ou profiling com `cProfile`/`py-spy`) ANTES de otimizar. Otimizar sem métrica é achismo — o gargalo real raramente é o que parece.

## Padrões de otimização (com código)

### 1. Reuso de conexão + batching (I/O)

```python
import httpx

with httpx.Client(timeout=30) as client:  # reusa conexão TCP/TLS
    for chunk in chunks(itens, size=50):
        resp = client.post(url, json={"items": chunk})  # batch se a API aceitar
        resp.raise_for_status()
```

### 2. Paralelismo seguro (I/O-bound: threads/asyncio; CPU-bound: processos)

```python
from concurrent.futures import ThreadPoolExecutor, as_completed

def processar(item):
    # retorna (item_id, resultado_ou_erro) — nunca levanta para o pool
    try:
        return item["id"], api.fetch(item)
    except Exception as e:
        return item["id"], {"erro": str(e)}

with ThreadPoolExecutor(max_workers=8) as pool:  # 8 = rate limit / latência
    futures = [pool.submit(processar, i) for i in itens]
    for f in as_completed(futures):
        item_id, resultado = f.result()
        # agrega por item — contexto preservado mesmo com erros
```

- **Respeite rate limits**: semáforo/throttle no cliente HTTP (`RateLimiter` ou `tenacity` com `wait`), leia headers `X-RateLimit-Remaining`/`Retry-After` e respeite `Retry-After`.
- **Erros em paralelo**: capture e agregue por item — nunca perca o contexto de qual item falhou.
- **Só paralelize quando**: ordem não importa, destino aguenta, e o custo de coordenação < ganho.

### 3. Cache de resultados imutáveis

```python
import hashlib, json, pathlib

def cache_get(key: str):
    h = hashlib.sha256(key.encode()).hexdigest()[:16]
    p = pathlib.Path(f".cache/{h}.json")
    return json.loads(p.read_text()) if p.exists() else None
```

Cache com **TTL ou invalidação explícita** (nunca cache eterno de dado mutável — o destino pode ter mudado).

### 4. Delta processing (só o que mudou)

- Salve checkpoint do último estado processado (ex: `state.json` com último id/timestamp).
- Na próxima execução, processe só o que é novo (`WHERE id > checkpoint` ou itens com `updated_at > last_run`).
- **Cuidado**: delta exige fonte com ordenação/versão confiável — se não houver, reprocesse tudo (correção > velocidade).

## Regras de ouro

- **Performance nunca destrói confiabilidade**: se a otimização aumenta taxa de falha, reverte.
- **Meça antes e depois**: registre o ganho real no relatório/README (ex: "de 45min para 4min com batching").
- **Comece pelo maior custo**: otimizar 1 chamada que roda 10.000× > otimizar 100 linhas de CPU.
- **Documente o motivo**: comentário no código explicando POR QUE a otimização existe (evita que alguém "simplifique" de volta).

## Anti-padrões (proibido)

1. ❌ `ThreadPoolExecutor` sem rate limit → ban da API em 30s
2. ❌ Paralelizar CPU-bound com threads (GIL) — use processos
3. ❌ Cache sem invalidação → resultado velho apresentado como novo
4. ❌ `sleep(1)` fixo para "esperar" em vez de wait explícito/retry
5. ❌ Otimizar sem medir (otimização prematura)
6. ❌ Silenciar exceções no paralelo (`except: pass`) — dados somem
7. ❌ Carregar CSV gigante inteiro em RAM quando `chunksize` resolve
8. ❌ Remover retries "para ficar rápido" — confiabilidade cai

## Checklist de qualidade (antes de entregar)

- [ ] Gargalo identificado com métrica (tempo por etapa medido)
- [ ] Otimização aplicada com ganho documentado (antes → depois)
- [ ] Rate limits respeitados (semáforo/throttle)
- [ ] Erros em paralelo agregados por item, sem perda de contexto
- [ ] Cache com TTL/invalidação definida
- [ ] Confiabilidade igual ou melhor (mesma taxa de sucesso ou superior)
- [ ] Código comentado explicando o porquê da otimização

## Composição com outras skills

- **Antes**: `automation-engineer` (processo completo) → `automation-planning` (escopo e critérios de sucesso)
- **Depois**: `error-recovery` (retries/checkpoints pós-otimização) → `testing-automation` (validar que otimizou sem quebrar) → `automation-documentation` (registrar ganho no README)

## References

- httpx (client reutilizável): https://www.python-httpx.org · tenacity (retry+backoff+rate limit): https://tenacity.readthedocs.io · concurrent.futures: https://docs.python.org/3/library/concurrent.futures.html
- Ver skills `automation-engineer`, `api-automation`, `error-recovery`.
