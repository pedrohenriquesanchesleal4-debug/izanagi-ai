---
name: api-automation
description: "Integração via API REST/HTTP: autenticação, paginação, rate limits, retries com backoff e validação de schema com httpx/pydantic. Use para integrar sistemas via API de forma confiável e idempotente."
---

# API Automation

Integração confiável entre sistemas via API REST/HTTP com `httpx` — autenticação, paginação, rate limits, retries com critério e validação de respostas. O objetivo: **uma chamada errada nunca corrompe dados e nunca passa despercebida**.

## Quando usar

Use ao: integrar sistemas via API (CRM, ERP, webhooks, gateways), extrair dados paginados, sincronizar registros entre serviços, ou consumir API de terceiros com rate limit. **Pule** para: sem API disponível → `browser-automation`; automação de planilhas → `spreadsheet-automation`; ETL pesado com banco → `data-engineering`.

## Stack recomendada

- **`httpx`** (client síncrono ou async; connection pooling; timeout global) — preferência sobre `requests`.
- **`pydantic`** para validação de schema das respostas.
- **`tenacity`** para retries com backoff exponencial + jitter (ou loop manual simples).
- **Ambiente**: `python-dotenv` para credenciais (nunca hardcoded — ver `automation-security`).

## Workflow (5 passos)

### 1. Autentique com credencial segura

```python
import httpx, os
from dotenv import load_dotenv

load_dotenv()
API_KEY = os.environ["API_KEY"]  # nunca no código

client = httpx.Client(
    base_url=os.environ["API_BASE"],
    headers={"Authorization": f"Bearer {API_KEY}"},
    timeout=30.0,
)
```

### 2. Modele a resposta esperada

```python
from pydantic import BaseModel, Field

class Lead(BaseModel):
    id: int
    email: str = Field(pattern=r"[^@]+@[^@]+\.[^@]+")
    status: str = Field(pattern="^(new|contacted|won)$")
```

### 3. Trate status, rate limit e erros

```python
def get_or_retry(client: httpx.Client, url: str, max_retries: int = 3) -> dict:
    for attempt in range(max_retries):
        resp = client.get(url)
        if resp.status_code == 200:
            return resp.json()
        if resp.status_code in (429, 502, 503, 504):       # retryable
            retry_after = float(resp.headers.get("Retry-After", 2 ** attempt))
            time.sleep(min(retry_after, 30))               # cap no backoff
            continue
        resp.raise_for_status()                            # erro permanente
    raise RuntimeError(f"Falhou após {max_retries} tentativas: {url}")
```

### 4. Pague a paginação até esgotar

```python
def fetch_all(client: httpx.Client, first_url: str) -> list[dict]:
    items, url = [], first_url
    while url:
        data = get_or_retry(client, url)
        items.extend(data.get("results", []))
        url = data.get("next")          # cursor/offset; adapte ao contrato
    return items
```

### 5. Valide e registre o resultado

```python
leads = [Lead.model_validate(item) for item in fetch_all(client, "/leads?limit=100")]
# registre contagem/erros em log estruturado — sem secrets
```

## Regras de ouro

- **Idempotência**: PUT/upsert por ID natural; nunca duplicar registros em re-execução (ver `error-recovery`).
- **Validação em toda resposta**: `raise_for_status` para status inesperado; schema via Pydantic; campos obrigatórios checados.
- **Rate limit é contrato**: respeite `Retry-After`/`X-RateLimit-*`; nunca martele a API.
- **Dry-run primeiro**: `--dry-run` imprime o que faria sem executar (ver `testing-automation`).
- **Log sem secrets**: tokens/keys nunca em logs (ver `automation-security`).

## Checklist de qualidade (antes de entregar)

- [ ] Credenciais em `.env` fora do Git
- [ ] Timeout global definido (`httpx.Timeout`)
- [ ] Retry apenas em status retryable (429/5xx), com backoff capado
- [ ] Paginação completa (loop até `next` nulo), sem loop infinito
- [ ] Respostas validadas com schema (Pydantic) — erro claro em campo inválido
- [ ] Dry-run implementado e testado
- [ ] Log estruturado com contagem final (sem secrets)

## Anti-padrões (proibido)

1. ❌ Credencial hardcoded ou em log
2. ❌ Retry cego em toda exceção (duplica POST não idempotente)
3. ❌ Ignorar status != 200 (aceitar 404 como "vazio")
4. ❌ Paginação sem teto (loop infinito se `next` nunca nulo)
5. ❌ `requests` sem timeout (hang infinito)
6. ❌ Consumir resposta sem validar schema (erro só aparece 3 telas depois)
7. ❌ Ignorar `Retry-After` (ban temporário da API)

## Composição com outras skills

- **Antes**: `automation-planning` (escopo) → `automation-research` (docs da API) → `technology-selection` (httpx vs browser)
- **Depois**: `data-validation` (qualidade dos dados) → `error-recovery` (checkpoints) → `automation-documentation` (README) → `automation-security` (auditoria de credenciais)

## References

- httpx: https://www.python-httpx.org · tenacity: https://tenacity.readthedocs.io · Pydantic: https://docs.pydantic.dev · HTTP semantics (RFC 9110): https://www.rfc-editor.org/rfc/rfc9110
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI: cópia fiel de `skills/api-automation/SKILL.md` (fonte da verdade).
