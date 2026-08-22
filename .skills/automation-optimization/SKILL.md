---
name: "automation-optimization"
description: "Identifica e corrige gargalos de I/O, browser, processamento e memória em automações, com métricas antes/depois. Use quando uma automação demorar demais, estourar rate limits ou custar caro. Gatilhos de ativação: automation optimization — rápido sem quebrar; quando usar; caça aos gargalos (nesta ordem — meça cada etapa antes de tocar); padrões de otimização (com código)."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Automation Optimization — Rápido Sem Quebrar

> Migrado deterministicamente de `skills/automation-optimization/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Identifica e corrige gargalos de I/O, browser, processamento e memória em automações, com métricas antes/depois.
- **Ativar quando:** Use quando uma automação demorar demais, estourar rate limits ou custar caro.
- **Escopo canônico:** Automation Optimization — Rápido Sem Quebrar
- **Seções do corpo original:** Quando usar · Caça aos gargalos (nesta ordem — meça cada etapa antes de tocar) · Padrões de otimização (com código) · Regras de ouro · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ ThreadPoolExecutor sem rate limit → ban da API em 30s

❌ `ThreadPoolExecutor` sem rate limit → ban da API em 30s

### Passo 2 — ❌ Paralelizar CPU-bound com threads (GIL) — use processos

❌ Paralelizar CPU-bound com threads (GIL) — use processos

### Passo 3 — ❌ Cache sem invalidação → resultado velho apresentado como novo

❌ Cache sem invalidação → resultado velho apresentado como novo

### Passo 4 — ❌ sleep(1) fixo para "esperar" em vez de wait explícito/retry

❌ `sleep(1)` fixo para "esperar" em vez de wait explícito/retry

### Passo 5 — ❌ Otimizar sem medir (otimização prematura)

❌ Otimizar sem medir (otimização prematura)

### Passo 6 — ❌ Silenciar exceções no paralelo (except:

❌ Silenciar exceções no paralelo (`except: pass`) — dados somem

### Passo 7 — ❌ Carregar CSV gigante inteiro em RAM quando chunksize resolve

❌ Carregar CSV gigante inteiro em RAM quando `chunksize` resolve

### Passo 8 — ❌ Remover retries "para ficar rápido" — confiabilidade cai

❌ Remover retries "para ficar rápido" — confiabilidade cai

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Gargalo identificado com métrica (tempo por etapa medido)
- [ ] Otimização aplicada com ganho documentado (antes → depois)
- [ ] Rate limits respeitados (semáforo/throttle)
- [ ] Erros em paralelo agregados por item, sem perda de contexto
- [ ] Cache com TTL/invalidação definida
- [ ] Confiabilidade igual ou melhor (mesma taxa de sucesso ou superior)
- [ ] Código comentado explicando o porquê da otimização

## Common Rationalizations

- **"Funciona na minha máquina, o problema é o ambiente."**
  - Verdade: Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.
- **"Deploy manual hoje, pipeline depois que estabilizar."**
  - Verdade: Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.
- **"Monitoramento a gente implanta quando escalar."**
  - Verdade: Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.
- **"Rollback nunca precisamos, pra que testar?"**
  - Verdade: A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.
- **"CI tá lento, vou pular os checks só dessa vez."**
  - Verdade: 'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.
- **"Alerta demais incomoda, melhor só o essencial depois."**
  - Verdade: Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.

## Red Flags

- Pipeline sem etapa obrigatória de build+teste antes do deploy.
- Secrets impressos no log de CI (mesmo mascarados tardiamente).
- Serviço sem healthcheck/readiness probe configurado.
- Infra alterada direto no console, fora do código versionado (drift).
- Single point of failure sem redundância nem plano documentado.
- Backup existente mas nunca restaurado em teste.
- Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.

## Legacy Reference (v1)

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
