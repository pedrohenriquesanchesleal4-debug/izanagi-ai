---
name: "error-recovery"
description: "Torna automações resilientes a falhas: classifica erros (recuperável/permanente/crítico), aplica retry com backoff e checkpoints para retomar sem duplicar. Use em automações que processam lotes ou chamam APIs instáveis. Gatilhos de ativação: error recovery; quando usar; classificação de erros (decidir antes de retry); checkpoints (retomar de onde parou)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Error Recovery

> Migrado deterministicamente de `skills/error-recovery/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Torna automações resilientes a falhas: classifica erros (recuperável/permanente/crítico), aplica retry com backoff e checkpoints para retomar sem duplicar.
- **Ativar quando:** Use em automações que processam lotes ou chamam APIs instáveis.
- **Escopo canônico:** Error Recovery
- **Seções do corpo original:** Quando usar · Classificação de erros (decidir ANTES de retry) · Checkpoints (retomar de onde parou) · Regras de ouro · Checklist de qualidade (antes de entregar)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ except Exception:

❌ `except Exception: time.sleep(5); retry` sem classificar (duplica POST)

### Passo 2 — ❌ Retry infinito sem teto

❌ Retry infinito sem teto

### Passo 3 — ❌ Sem checkpoint — lote de 1h reinicia do zero em toda falha

❌ Sem checkpoint — lote de 1h reinicia do zero em toda falha

### Passo 4 — ❌ Checkpoint sem atomicidade (arquivo corrompido na queda)

❌ Checkpoint sem atomicidade (arquivo corrompido na queda)

### Passo 5 — ❌ Re-execução sem idempotência (duplica tudo a cada tentativa)

❌ Re-execução sem idempotência (duplica tudo a cada tentativa)

### Passo 6 — ❌ Engolir erro permanente com log de uma linha

❌ Engolir erro permanente com log de uma linha

### Passo 7 — ❌ Jitter ausente em backoff (todas as instâncias batem juntas)

❌ Jitter ausente em backoff (todas as instâncias batem juntas)

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Erros classificados (recuperável/permanente/crítico) com tabela explícita
- [ ] Retry apenas em recuperável, com backoff+jitter e teto
- [ ] Checkpoint implementado e testado (interrompeu no meio → retoma do ponto)
- [ ] Escrita de checkpoint atômica (tmp + rename)
- [ ] Idempotência por chave natural (re-execução não duplica)
- [ ] Falhas permanentes registradas com contexto (linha/registro/request)
- [ ] Erro crítico para a execução com estado preservado

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

# Error Recovery

Resiliência de automações: classificar erros (recuperável vs permanente), retry com backoff, checkpoints para retomar de onde parou e idempotência para nunca duplicar — **a automação sobrevive a falhas sem perder progresso e sem corromper dados**.

## Quando usar

Use ao: processar lotes grandes (interrupção no meio = retrabalho); integrar com APIs instáveis (timeout, 429, 5xx); ETL com múltiplas etapas; qualquer automação que rode agendada. **Pule** para: script de 1 passo rápido que falha e pronto (refaça); o sistema-alvo já garante transações atômicas.

## Classificação de erros (decidir ANTES de retry)

| Classe | Exemplo | Ação |
|---|---|---|
| **Recuperável (retry)** | timeout, 429, 502/503/504, conexão caiu | retry com backoff + jitter, teto de tentativas |
| **Permanente (não retry)** | 400/401/403/404, schema inválido, arquivo corrupto | abortar/registrar — retry não resolve |
| **Crítico (parar)** | disco cheio, credencial revogada, dado inválido em lote | parar execução, alertar, preservar estado |

```python
import time, random

def chamada_resiliente(fn, max_tentativas=4):
    for tentativa in range(max_tentativas):
        try:
            return fn()
        except (TimeoutError, ConnectionError) as e:        # recuperável
            if tentativa == max_tentativas - 1:
                raise
            sleep = 2 ** tentativa + random.uniform(0, 1)   # backoff + jitter
            time.sleep(min(sleep, 30))
        except (ValueError, PermissionError):               # permanente
            raise RuntimeError(f"Erro permanente, sem retry: {e}")
```

## Checkpoints (retomar de onde parou)

```python
import json, os

CHECKPOINT = "estado/checkpoint.json"

def carregar_estado() -> set[str]:
    if os.path.exists(CHECKPOINT):
        return set(json.load(open(CHECKPOINT)).get("processados", []))
    return set()

def salvar_estado(processados: set[str]):
    json.dump({"processados": sorted(processados)}, open(CHECKPOINT, "w"))

# uso: a cada N itens, salvar; na re-execução, pular processados
```

- **Frequência de checkpoint**: a cada N itens ou a cada etapa — custo de gravar vs custo de reprocessar.
- **Atômico**: escreva em arquivo temporário e renomeie (evita checkpoint corrompido).
- **Idempotência por chave natural**: registro já processado (CPF/ID) é pulado, não re-enviado.

## Regras de ouro

- **Retry só para erro recuperável** — retry em 400 duplica o problema (e o log).
- **Backoff exponencial + jitter** — evita "thundering herd" contra a API.
- **Teto de tentativas SEMPRE** — retry infinito = job que nunca termina.
- **Checkpoint no menor grão que importa** — retomar sem reprocessar o lote inteiro.
- **Registrar cada falha permanente** — erro que não é visível é erro que volta.
- **Fail fast em erro crítico** — não continue processando com credencial quebrada.

## Checklist de qualidade (antes de entregar)

- [ ] Erros classificados (recuperável/permanente/crítico) com tabela explícita
- [ ] Retry apenas em recuperável, com backoff+jitter e teto
- [ ] Checkpoint implementado e testado (interrompeu no meio → retoma do ponto)
- [ ] Escrita de checkpoint atômica (tmp + rename)
- [ ] Idempotência por chave natural (re-execução não duplica)
- [ ] Falhas permanentes registradas com contexto (linha/registro/request)
- [ ] Erro crítico para a execução com estado preservado

## Anti-padrões (proibido)

1. ❌ `except Exception: time.sleep(5); retry` sem classificar (duplica POST)
2. ❌ Retry infinito sem teto
3. ❌ Sem checkpoint — lote de 1h reinicia do zero em toda falha
4. ❌ Checkpoint sem atomicidade (arquivo corrompido na queda)
5. ❌ Re-execução sem idempotência (duplica tudo a cada tentativa)
6. ❌ Engolir erro permanente com log de uma linha
7. ❌ Jitter ausente em backoff (todas as instâncias batem juntas)

## Composição com outras skills

- **Antes**: `automation-planning` (decisão de idempotência no plano) → `api-automation` (retry de HTTP)
- **Depois**: `data-validation` (o que é dado inválido vs erro de rede) → `automation-documentation` (documentar limitações/retomada) → `monitoring-specialist` (alertas)

## References

- AWS: Timeouts, retries and backoff: https://aws.amazon.com/builders-library/timeouts-retries-and-backoff-with-jitter/ · Martin Fowler: Patterns of resilient architecture: https://martinfowler.com/articles/patterns-of-distributed-systems/ · tenacity (retry lib): https://tenacity.readthedocs.io
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
