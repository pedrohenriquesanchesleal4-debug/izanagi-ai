---
name: "testing-automation"
description: "Define testes de automação com pytest: unitários, integração com mock, E2E Playwright, dry-run e retomada por checkpoint. Use ao implementar qualquer automação, antes de rodar em produção. Gatilhos de ativação: testing automation — automatize, mas teste primeiro; quando usar; estratégia (4 camadas); padrões obrigatórios."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
references:
  - "references.md"
---

# Testing Automation — Automatize, Mas Teste Primeiro

> Migrado deterministicamente de `skills/testing-automation/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Define testes de automação com pytest: unitários, integração com mock, E2E Playwright, dry-run e retomada por checkpoint.
- **Ativar quando:** Use ao implementar qualquer automação, antes de rodar em produção.
- **Escopo canônico:** Testing Automation — Automatize, Mas Teste Primeiro
- **Seções do corpo original:** Quando usar · Estratégia (4 camadas) · Padrões obrigatórios · Regras · Anti-padrões (proibido)
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Entregar automação sem teste e sem dry-run ("funciona na minha máquina")

❌ Entregar automação sem teste e sem dry-run ("funciona na minha máquina")

### Passo 2 — ❌ Teste que depende de rede/API real (flaky, lento, não-determinístico)

❌ Teste que depende de rede/API real (flaky, lento, não-determinístico)

### Passo 3 — ❌ sleep(2) para esperar UI em vez de expect/wait explícito

❌ `sleep(2)` para esperar UI em vez de `expect`/wait explícito

### Passo 4 — ❌ Seletores por posição/coordenada

❌ Seletores por posição/coordenada

### Passo 5 — ❌ except:

❌ `except: pass` escondendo erro que o teste deveria pegar

### Passo 6 — ❌ Testar só o caminho feliz (sem casos limite, sem falha)

❌ Testar só o caminho feliz (sem casos limite, sem falha)

### Passo 7 — ❌ skipif silencioso que desativa teste sem justificativa

❌ `skipif` silencioso que desativa teste sem justificativa

### Passo 8 — ❌ Rodar contra produção no teste E2E sem ambiente separado

❌ Rodar contra produção no teste E2E sem ambiente separado

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Unitários das transformações/validações com casos limite
- [ ] Integração com mock (determinística)
- [ ] Dry-run executado e documentado (output do dry-run no relatório)
- [ ] Teste de retomada (falhou no 5, continuou no 6)
- [ ] Teste de idempotência (2× = mesmo resultado)
- [ ] `pytest -q` passando sem skips silenciosos
- [ ] E2E com seletores resilientes (se browser)
- [ ] Testes rápidos (< 1 min)

## Common Rationalizations

- **"Escrevo os testes depois que o código estabiliza."**
  - Verdade: 'Depois' significa nunca — e o teste escrito após a implementação só confirma o que o código faz, não o que deveria fazer. TDD é lei: teste antes, veja falhar, código mínimo, refactor.
- **"Mockei tudo, suite verde, tá coberto."**
  - Verdade: Quando todo dependente é mock, o teste valida o mock contra ele mesmo. Integração real (API, banco, arquivo) precisa de pelo menos um teste que atravesse a borda verdadeira.
- **"Cobertura 90% prova qualidade."**
  - Verdade: Cobertura mede execução, não asserção. Linha percorrida sem expectativa forte é teatro. Métrica boa é teste que falha quando o comportamento quebra.
- **"Esse teste é flaky, vou dar skip pra destravar o pipeline."**
  - Verdade: Skip silencioso ensina a suíte a mentir. Flakiness tem causa (sleep fixo, ordem, rede) — investigue e conserte; `skip` sem issue aberta é falha escondida.
- **"QA vai pegar os bugs na revisão."**
  - Verdade: QA valida, não adivinha. Empurrar verificação para frente multiplica o custo de cada defeito e viola a autoavaliação obrigatória antes de entregar.
- **"Rodei localmente uma vez, comportamento confirmado."**
  - Verdade: Uma execução manual não é regressão. Sem teste automatizado, o mesmo bug volta no próximo refactor e ninguém percebe até produção.

## Red Flags

- Suíte verde com asserções fracas (`assert result != null`).
- Sleep/timeout fixo no lugar de espera condicional (flakiness programada).
- Testes que dependem de ordem de execução ou estado global compartilhado.
- Bug corrigido sem teste de regressão que o reproduza.
- Mock da própria unidade sob teste (testa a simulação, não o código).
- Snapshot/expectativa gerada do output atual sem revisão humana.
- Casos de teste pulados via skip/disable sem registro do motivo.

## Legacy Reference (v1)

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
