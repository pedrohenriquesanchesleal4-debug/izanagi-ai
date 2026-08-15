---
name: testing-automation
description: "Define testes de automação com pytest: unitários, integração com mock, E2E Playwright, dry-run e retomada por checkpoint. Use ao implementar qualquer automação, antes de rodar em produção."
---

# Testing Automation — Automatize, Mas Teste Primeiro

Uma automação sem testes é um script que vai falhar **depois** de já ter feito estrago. Toda automação de produção exige: unitários das regras, integração dos pontos externos, dry-run antes da primeira execução real e teste de retomada.

## Quando usar

Use ao implementar **qualquer** automação com lógica (transformações, validações, parsing, integração, retries, checkpoints). **Pule** para scripts de uso único descartáveis (one-shot exploratório) — mas mesmo assim rode um dry-run.

## Estratégia (4 camadas)

### 1. Unitários (pytest) — o núcleo barato e rápido

Cubra: transformações, validações, parsing, regras de negócio, detecção de duplicados, formatação de datas/números.

```python
# test_normalizacao.py
import pytest
from automacao import normalizar_data, extrair_cpf

def test_data_br():
    assert normalizar_data("01/02/2024", dayfirst=True) == "2024-02-01"

def test_cpf_com_mascara():
    assert extrair_cpf("123.456.789-09") == "12345678909"

def test_data_invalida_vira_none():
    assert normalizar_data("31/02/2024") is None  # nunca levanta no meio do lote
```

**Fixtures com dados realistas**: inclua casos limite — vazios, duplicados, formatos errados, acentos, BOM, linhas em branco.

### 2. Integração — o ponto externo controlado

- Chamadas reais a API **com mock** quando possível (`responses`/`httpx.MockTransport`) para testes determinísticos e rápidos.
- Teste de leitura/escrita de arquivos reais em `tmp_path` (fixture do pytest).
- Teste de auth: token ausente/inválido → erro claro (não silencioso).

```python
def test_upload_chama_api(httpx_mock):
    httpx_mock.add_response(url="https://api.exemplo.com/items", method="POST", json={"ok": True})
    resultado = pipeline.upload([{"id": 1}])
    assert resultado["enviados"] == 1
```

### 3. E2E (browser) — só quando não há API

`pytest-playwright`: abrir, executar fluxo, verificar resultado observável.

```python
def test_fluxo_upload(page):
    page.goto("https://app.exemplo.com/upload")
    page.get_by_label("Arquivo").set_input_files("dados.csv")
    page.get_by_role("button", name="Enviar").click()
    page.get_by_text("3 registros importados").wait_for()
```

**Seletores resilientes**: `getByRole`/`getByLabel`/`getByText` — **nunca** posição (`locator("div:nth-child(3)")`) nem CSS frágil que muda a cada release.

### 4. Dry-run — obrigatório antes da primeira execução real

`--dry-run` executa o pipeline de validação **sem efeitos reais** (não envia, não escreve no destino):

```python
def main(dry_run: bool = False):
    dados = carregar()
    validados, erros = validar(dados)
    if dry_run:
        print(f"[dry-run] {len(validados)} válidos, {len(erros)} rejeitados — nada foi enviado")
        return
    enviar(validados)
```

## Padrões obrigatórios

- **Testes de falha**: garanta que a automação NÃO silencia erros — `assert` em logs/exceções (ex: auth falhou → exceção, não `except: pass`).
- **Teste de retomada (checkpoint)**: processar 10, falhar no 5, verificar que reexecução continua do 6 — sem reprocessar os 4 primeiros.
- **Teste de idempotência**: rodar 2x produz o mesmo resultado (ou o 2º run não duplica).
- **Teste de encoding**: arquivo com BOM, acentos, `;` como delimitador.
- **Teste de rate limit**: o código respeita `Retry-After`/semáforo (mock de resposta 429).

## Regras

- Toda transformação/validação complexa **precisa** de teste unitário.
- Rodar a suíte antes de considerar pronta: `pytest -q` (zero falhas, zero pulados silenciosos).
- Priorize o que mais quebra: parsing de dados reais, retries, checkpoints, auth, encoding.
- **Testes rápidos**: mock externo → suíte em segundos; se a suíte demora minutos, os devs param de rodar.

## Anti-padrões (proibido)

1. ❌ Entregar automação sem teste e sem dry-run ("funciona na minha máquina")
2. ❌ Teste que depende de rede/API real (flaky, lento, não-determinístico)
3. ❌ `sleep(2)` para esperar UI em vez de `expect`/wait explícito
4. ❌ Seletores por posição/coordenada
5. ❌ `except: pass` escondendo erro que o teste deveria pegar
6. ❌ Testar só o caminho feliz (sem casos limite, sem falha)
7. ❌ `skipif` silencioso que desativa teste sem justificativa
8. ❌ Rodar contra produção no teste E2E sem ambiente separado

## Checklist de qualidade (antes de entregar)

- [ ] Unitários das transformações/validações com casos limite
- [ ] Integração com mock (determinística)
- [ ] Dry-run executado e documentado (output do dry-run no relatório)
- [ ] Teste de retomada (falhou no 5, continuou no 6)
- [ ] Teste de idempotência (2× = mesmo resultado)
- [ ] `pytest -q` passando sem skips silenciosos
- [ ] E2E com seletores resilientes (se browser)
- [ ] Testes rápidos (< 1 min)

## Composição com outras skills

- **Antes**: `automation-engineer` (implementação) → `automation-planning` (critérios de sucesso vêm do plano)
- **Depois**: `error-recovery` (retries/checkpoints testados) → `automation-documentation` (README com `pytest -q` + comando de dry-run) → `qa` (auditoria de qualidade do framework)

## References

- pytest: https://docs.pytest.org · pytest-playwright: https://playwright.dev/python/docs/test-runners · pytest-httpx: https://github.com/Colin-b/pytest_httpx
- Ver skills `automation-engineer`, `error-recovery`, `webapp-testing`.

> Gerado pelo Izanagi AI — cópia fiel de `skills/testing-automation/SKILL.md` (fonte da verdade).
