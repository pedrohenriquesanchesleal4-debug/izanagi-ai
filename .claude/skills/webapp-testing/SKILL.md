---
name: webapp-testing
description: "Testa apps web locais com Playwright: scripts de verificação de UI, screenshots e logs do navegador. Use ao validar páginas, fluxos, formulários ou regressões visuais."
---

# Webapp Testing — Automação Playwright de Aplicações Web

Teste aplicações web locais com **scripts Python nativos + Playwright**. Não leia o código dos scripts auxiliares inteiros — use-os como caixa-preta.

## Adaptação para o Izanagi

O original depende de scripts Python (`with_server.py`). No Izanagi você pode usar **DREIR** (Playwright), **ou o equivalente em Node se o projeto for JS**: `@playwright/test` para testes E2E versionáveis, ou scripts Python curtos para exploração rápida. Escolha o que mantém consistência com a stack do projeto.

## Árvore de decisão

```
Tarefa → é HTML estático?
├─ Sim → leia o HTML direto e identifique seletores
│         └─ Sucesso → script com seletores
│         └─ Incompleto → trate como dinâmico
└─ Não (SPA/dinâmica) → o servidor já está rodando?
    ├─ Não → suba o servidor (npm run dev / docker-compose / with_server.py --help)
    └─ Sim → Reconhecimento-ante-ação:
        1. Navega e espera networkidle (CRÍTICO para SPA)
        2. Screenshot ou inspeção do DOM
        3. Identifica seletores no estado renderizado
        4. Executa ações com os seletores descobertos
```

## Padrão recomendo (Node/Playwright)

```ts
import { test, expect } from '@playwright/test';

test('fluxo de checkout completo', async ({ page }) => {
  await page.goto('http://localhost:5173');
  await page.waitForLoadState('networkidle'); // CRÍTICO: espera o JS executar
  await page.getByRole('button', { name: 'Adicionar' }).first().click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
```

## Padrão Python (rápido)

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)  # sempre headless chromium
    page = browser.new_page()
    page.goto('http://localhost:5173')
    page.wait_for_load_state('networkidle')  # CRÍTICO
    page.screenshot(path='/tmp/inspect.png', full_page=True)
    print(page.locator('button').all_text_contents())
    browser.close()
```

## Reconhecimento-ante-ação

1. Inspecione o DOM renderizado: screenshot full-page + `page.content()` + `locator().all()`.
2. Identifique seletores de texto/role/CSS.
3. Execute ações com os seletores descobertos.

## Boas práticas

- Sempre `wait_for_load_state('networkidle')` ANTES de inspecionar apps dinâmicos.
- Fecha o navegador ao final.
- Seletore descritivos: `text=`, `role=`, `data-testid`, CSS.
- Waits: `wait_for_selector()` / `wait_for_timeout()` quando necessário.
- Para fluxos complexos múltiplos servidores: gerencie ambos (backend + frontend).

## Exemplos locais (`examples/`)

Scripts de referência (Playwright Python; use como caixa-preta — não edite a menos que necessário):

- `with_server.py` — sobe 1+ servidores locais, espera as portas ficarem prontas e roda seu script. Uso: `python examples/with_server.py --server "npm run dev" --port 5173 -- python examples/element_discovery.py`
- `element_discovery.py` — descobre botões/links/inputs no estado renderizado + screenshot full-page.
- `console_logging.py` — captura mensagens do console do navegador durante a automação.
- `static_html_automation.py` — automação de arquivos HTML estáticos via `file://`.

Requisitos: `pip install playwright` + `playwright install chromium`. Saídas (screenshots/logs) vão para `outputs/` do projeto.

## References

- Repo original: [ComposioHQ/awesome-claude-skills](https://github.com/ComposioHQ/awesome-claude-skills) — skill `webapp-testing/` (índice curado, 66k stars); scripts portados localmente em `examples/`.
- Playwright docs: https://playwright.dev/docs/intro
- Curadoria completa em `references.md`.

> Gerado pelo Izanagi AI — cópia fiel de `skills/webapp-testing/SKILL.md` (fonte da verdade).
