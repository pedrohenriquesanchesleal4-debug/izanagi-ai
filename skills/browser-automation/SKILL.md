---
name: browser-automation
description: "Automação de navegador com Playwright: navegação, formulários, upload/download, extração de tabelas e seletores resilientes. Use quando não existir API e a automação web for necessária."
---

# Browser Automation

Automação de navegador com **Playwright** (preferência; Selenium só em legado) para quando não existe API: navegação, formulários, autenticação, upload/download, extração e validação — com seletores resilientes e waits que não flakam.

## Quando usar

Use ao: não existir API pública para o sistema-alvo; preencher formulários em sistemas legados; extrair dados de páginas com tabelas/paginação; automatizar upload/download de arquivos em portal; validar fluxo E2E. **Pule** para: existe API → `api-automation` (sempre mais barato e estável); só ler dados → verificar se há endpoint/export antes.

## Stack recomendada

- **Playwright** (Python ou Node) — auto-wait embutido, seletor por role/texto, screenshots, trace.
- **Selenium** apenas para manutenção de script legado — nunca em projeto novo.
- **`pytest` + playwright** para testes E2E estruturados (ver `testing-automation`).

## Workflow (6 passos)

### 1. Seletores resilientes (nunca XPath frágil de classe)

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()

    page.goto("https://sistema.internal/login")
    page.get_by_label("Usuário").fill(os.environ["USUARIO"])   # role/texto > classe
    page.get_by_label("Senha").fill(os.environ["SENHA"])
    page.get_by_role("button", name="Entrar").click()
```

### 2. Waits inteligentes (não `sleep` cego)

```python
page.wait_for_load_state("networkidle")                    # quando a rede assenta
page.get_by_text("Bem-vindo").wait_for()                   # condição real de sucesso
page.wait_for_timeout(500)                                  # só como último recurso
```

### 3. Tabelas e paginação com teto

```python
rows = []
for pagina in range(1, 6):                                  # teto de segurança
    page.get_by_role("row").all_inner_texts()               # extração
    rows.extend(page.locator("tbody tr").all_inner_texts())
    next_btn = page.get_by_role("button", name="Próxima")
    if not next_btn.is_enabled():
        break
    next_btn.click()
    page.get_by_role("row").first.wait_for()                # espera a página trocar
```

### 4. Upload e download

```python
page.locator('input[type="file"]').set_input_files("dados.xlsx")   # direto, sem janela
with page.expect_download() as dl:
    page.get_by_role("button", name="Exportar").click()
arquivo = dl.value
arquivo.save_as(f"exports/{arquivo.suggested_filename}")
```

### 5. Validação de resultado (o fluxo só é sucesso com evidência)

```python
assert page.get_by_text("Importado com sucesso").is_visible()
```

### 6. Evidência e limpeza

```python
page.screenshot(path="evidencia.png", full_page=True)
browser.close()
```

## Regras de ouro

- **Sempre preferir API** — browser é último recurso (frágil, lento, bloqueável).
- **Seletor por papel/texto** (`get_by_role`, `get_by_label`, `get_by_text`) antes de classe CSS; `data-testid` quando o app permite.
- **Espera condição real** (elemento visível/texto de sucesso), nunca `sleep` fixo como estratégia.
- **Headless + `--screenshot`/trace** para debugar falha sem abrir o browser.
- **Re-executável**: login idempotente (verifica se já logado), paginação com teto, download com nome único.
- **Menor privilégio**: credenciais via `.env`; nunca imprimir senha (ver `automation-security`).

## Checklist de qualidade (antes de entregar)

- [ ] Alternativa via API descartada com justificativa
- [ ] Seletores resilientes (role/texto/testid, não XPath de classe)
- [ ] Waits por condição, não `sleep` cego
- [ ] Paginação com teto e condição de parada
- [ ] Upload/download com nome único e pasta determinada
- [ ] Validação de sucesso com evidência (assert + screenshot)
- [ ] Credenciais em `.env`, zero segredos em log
- [ ] Headless + trace/screenshot para diagnóstico de falha

## Anti-padrões (proibido)

1. ❌ Automação de browser quando existe API (custo/flakiness desnecessário)
2. ❌ `time.sleep(5)` como espera universal
3. ❌ Seletores `div#app > div:nth-child(3)` (quebram a cada deploy)
4. ❌ Loop de paginação sem teto
5. ❌ Ignorar popup/modal de sucesso e seguir em frente
6. ❌ Senha hardcoded ou impressa em log/screenshot
7. ❌ Sem evidência — "deu certo" sem assert nem screenshot

## Composição com outras skills

- **Antes**: `automation-planning` → `automation-research` (conhecer o app-alvo) → `technology-selection` (API vs browser)
- **Depois**: `data-validation` (extrair/validar dados das páginas) → `error-recovery` (checkpoints) → `automation-documentation` (README)

## References

- Playwright Python: https://playwright.dev/python/docs/intro · Playwright locators: https://playwright.dev/python/docs/locators · Selenium (legado): https://www.selenium.dev/documentation
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
