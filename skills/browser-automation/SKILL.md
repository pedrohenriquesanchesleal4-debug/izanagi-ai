---
name: browser-automation
description: "Automacao de navegador com Playwright/Selenium: navegacao, formularios, autenticacao, upload/download, tabelas, paginacao, waits inteligentes, retries, seletores resilientes e validacao de resultados. Use quando nao existir API e a automacao web for necessaria."
---

# Browser Automation — Automação de Interface Resiliente

## Quando usar (sempre depois de descartar API)

1. API oficial → 2. integração direta → 3. HTTP documentado → 4. **browser automation** → 5. UI gráfica (último recurso).

Se existe API, use-a. Browser automation é para quando não existe.

## Ferramenta padrão: Playwright

- **Seletores resilientes**: priorize `getByRole`, `getByLabel`, `getByText`, `getByTestId` — NUNCA XPath absoluto nem `css: nth-child` frágil.
- **Waits inteligentes**: `expect(locator).to_be_visible()`, `wait_for_load_state`, autowaiting do Playwright — evite `time.sleep` fixo.
- **Trace/debug**: `--tracing` ou `page.screenshot()` em falha para diagnóstico.

## Padrões obrigatórios

1. **Autenticação**: suporte a sessão persistente (storage state) para não relogar a cada execução.
2. **Formulários**: preencha por label (`get_by_label`), submeta e **verifique resultado** (mensagem de sucesso, redirecionamento, elemento novo).
3. **Tabelas/paginação**: loop com condição de parada clara (botão next desabilitado ou última página) — proteção contra loop infinito (max páginas).
4. **Upload/download**: `set_input_files` e `expect_download`; salve em diretório controlado.
5. **Validação pós-ação**: após cada submissão, confirme o resultado esperado observável; registre sucesso/falha/desconhecido.
6. **Retry**: para erros transitórios (timeout, network), retry com backoff; para validação falha, não retry cego.
7. **Headless por padrão**; headed apenas para debug. Capture screenshot em erro.

## Estrutura

```
integrations/
├── site_client.py   # classe com métodos por ação (login, criar_registro, buscar)
├── selectors.py     # seletores centralizados (resilientes a mudanças)
└── session.json     # storage state (nunca commitar)
```

## Anti-padrões

- `time.sleep(5)` fixo para esperar carregamento.
- Seletores por posição/fragmento de classe.
- Clicar sem verificar resultado.
- Rodar 10.000 iterações sem checkpoint (ver `error-recovery`).

## References

- Playwright Python: https://playwright.dev/python/docs/intro · pytest-playwright: https://playwright.dev/python/docs/test-runners
- Selenium: https://www.selenium.dev/documentation/
