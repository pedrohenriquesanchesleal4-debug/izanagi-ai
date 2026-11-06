---
name: webapp-testing
description: "Testes automatizados de interface web ponta a ponta (E2E) com Playwright: seletores semânticos, espera resiliente de rede (networkidle) e prevenção de regressões visuais."
triggers:
  - "criar suítes de testes de interface ou fluxos de usuário com Playwright"
  - "validar fluxos críticos (login, onboarding, checkout) antes de deploy"
  - "auditar testes frágeis e substituir por locators semânticos estáveis"
stack: [playwright, typescript, testing, e2e]
---

# Webapp Testing — Testes E2E Resilientes com Playwright

Esta skill estabelece a metodologia para testes de interface ponta a ponta. Um bom teste de frontend reflete a ótica do usuário real, priorizando seletores semânticos e tolerância a atrasos de rede.

---

## 1. A Hierarquia de Seletores (Best Practices)

> **Sempre use seletores acessíveis e orientados a papel.** Nunca amarre testes a classes CSS frágeis do Tailwind (`.bg-blue-600`) ou caminhos de XPath que quebram com qualquer refatoração cosmética.

| Prioridade | Locator do Playwright | Exemplo de Uso | Quando Usar |
|---|---|---|---|
| **1 (Ideal)** | `page.getByRole()` | `page.getByRole('button', { name: 'Salvar' })` | Botões, links, caixas de diálogo, checkboxes, cabeçalhos |
| **2** | `page.getByLabel()` | `page.getByLabel('E-mail corporativo')` | Inputs de formulário associados a labels |
| **3** | `page.getByPlaceholder()` | `page.getByPlaceholder('Buscar...')` | Campos de busca quando não houver label visível |
| **4** | `page.getByText()` | `page.getByText('Projeto criado com sucesso')` | Mensagens de confirmação, textos e parágrafos |
| **5 (Fallback)** | `page.getByTestId()` | `page.getByTestId('cart-total-badge')` | Elementos complexos sem semântica nativa clara |

---

## 2. Padrão Canônico de Teste E2E (TypeScript)

```ts
import { test, expect } from '@playwright/test';

test.describe('Fluxo Crítico de Cadastro & Onboarding', () => {
  test('deve permitir cadastro completo com feedback visual correto', async ({ page }) => {
    // 1. Navega até a página
    await page.goto('/cadastro');

    // 2. Aguarda estabilização de rede (crítico para SPAs que hidratam via JS)
    await page.waitForLoadState('networkidle');

    // 3. Preenche formulário usando locators semânticos
    await page.getByLabel('Nome Completo').fill('Pedro Leal');
    await page.getByLabel('E-mail Corporativo').fill('pedro@empresa.com');
    await page.getByRole('combobox', { name: 'Tamanho da Equipe' }).selectOption('11-50');
    await page.getByRole('checkbox', { name: 'Aceito os termos' }).check();

    // 4. Submete a ação
    const submitBtn = page.getByRole('button', { name: 'Continuar' });
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 5. Verifica transição de tela e asserção de sucesso
    await expect(page).toHaveURL(/.*dashboard/);
    await expect(page.getByRole('heading', { name: 'Bem-vindo ao Painel' })).toBeVisible();
  });

  test('deve exibir mensagens de erro inline para entradas inválidas', async ({ page }) => {
    await page.goto('/cadastro');
    await page.waitForLoadState('networkidle');

    // Clica no botão sem preencher os campos
    await page.getByRole('button', { name: 'Continuar' }).click();

    // Valida mensagens de erro semânticas
    await expect(page.getByText('Informe seu nome completo')).toBeVisible();
    await expect(page.getByText('Digite um e-mail corporativo válido')).toBeVisible();
  });
});
```

---

## 3. Testes de Regressão Visual com Screenshots

Para garantir que uma alteração em CSS não destruiu a harmonia estética da página:

```ts
test('deve manter fidelidade visual do componente de card', async ({ page }) => {
  await page.goto('/componentes/pricing');
  await page.waitForLoadState('networkidle');

  const pricingCard = page.getByTestId('pricing-pro-card');
  await expect(pricingCard).toHaveScreenshot('pricing-card-pro.png', {
    maxDiffPixelRatio: 0.05, // Tolerância de 5% para diferenças de renderização de fontes
  });
});
```

---

## 4. Checklist de Testes de Webapp

- [ ] Testes utilizam `getByRole` e `getByLabel` em vez de seletores CSS acoplados.
- [ ] O teste aguarda a hidratação completa da aplicação (`waitForLoadState('networkidle')`).
- [ ] Cenários de erro e validação de formulários são testados de ponta a ponta.
- [ ] Asserções utilizam os matchers assíncronos do Playwright (`await expect(...).toBeVisible()`).
