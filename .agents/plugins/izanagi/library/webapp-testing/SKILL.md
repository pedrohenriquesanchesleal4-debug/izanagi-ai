---
name: "webapp-testing"
description: "Testa apps web locais com Playwright: scripts de verificação de UI, screenshots e logs do navegador. Use ao validar páginas, fluxos, formulários ou regressões visuais. Gatilhos de ativação: webapp testing — automação playwright de aplicações web; adaptação para o izanagi; árvore de decisão; padrão recomendo (node/playwright)."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
references:
  - "references.md"
---

# Webapp Testing — Automação Playwright de Aplicações Web

> Migrado deterministicamente de `skills/webapp-testing/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Testa apps web locais com Playwright: scripts de verificação de UI, screenshots e logs do navegador.
- **Ativar quando:** Use ao validar páginas, fluxos, formulários ou regressões visuais.
- **Escopo canônico:** Webapp Testing — Automação Playwright de Aplicações Web
- **Seções do corpo original:** Adaptação para o Izanagi · Árvore de decisão · Padrão recomendo (Node/Playwright) · Padrão Python (rápido) · Reconhecimento-ante-ação
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Inspecione o DOM renderizado:

Inspecione o DOM renderizado: screenshot full-page + `page.content()` + `locator().all()`.

### Passo 2 — Identifique seletores de texto/role/CSS.

Identifique seletores de texto/role/CSS.

### Passo 3 — Execute ações com os seletores descobertos.

Execute ações com os seletores descobertos.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:testing -->

- Rodar a suíte de testes relevante e registrar contagem passed/failed (evidência, não afirmação).
- Confirmar que cada passo do Step-by-Step Workflow foi aplicado ao caso real.
- Verificar que nenhum Red Flag (asserção fraca, skip silencioso, mock excessivo) persiste no resultado.
- Corrigido um bug, provar regressão: teste que reproduz o defeito passa após o fix.

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
