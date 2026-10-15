---
name: browser-playwright
description: "Automação e testes de navegador ponta a ponta com Playwright CLI. Use para validar interfaces reais, inspecionar elementos, capturar screenshots, verificar console errors e testar fluxos com máxima economia de tokens."
---

# Browser Automation & Testing com Playwright CLI

> Padrão Izanagi de automação web orientada a economia de tokens: utiliza a CLI direta em vez de despejar árvores gigantescas de acessibilidade no contexto do modelo.

## Triggering Criteria
- O usuário solicita validação de páginas web, fluxos de login, checkout ou formulários.
- Necessidade de inspecionar elementos ou capturar evidências visuais (screenshots).
- Verificação de renderização visual após alterações de frontend.

## Step-by-Step Workflow

1. **Verificação de Disponibilidade:**
   - Conferir se o `@playwright/cli` está disponível no ambiente:
     ```bash
     npx -y @playwright/cli --version
     ```
   - Se os browsers não estiverem instalados:
     ```bash
     npx playwright install chromium --with-deps
     ```

2. **Abertura de Sessão Isolada:**
   - Inicie a sessão com nome descritivo para não interferir em outros testes:
     ```bash
     npx -y @playwright/cli open <url> --session=<task-id>
     ```

3. **Interação Determinística:**
   - Preencha formulários e clique em elementos usando seletores semânticos ou texto:
     ```bash
     npx -y @playwright/cli fill <selector> "<text>"
     npx -y @playwright/cli click <selector>
     npx -y @playwright/cli press Enter
     ```

4. **Captura de Evidências (Screenshots & Logs):**
   - Salve a evidência visual no diretório de saída:
     ```bash
     npx -y @playwright/cli screenshot --filename=evidence.png
     ```
   - Inspecione mensagens e erros de console:
     ```bash
     npx -y @playwright/cli console-logs
     ```

5. **Finalização Limpa da Sessão:**
   - Feche a página e finalize o navegador:
     ```bash
     npx -y @playwright/cli close --session=<task-id>
     ```

## Verification Steps
- O arquivo de screenshot existe e não está vazio.
- Não há exceções não tratadas nos console logs da página.
- O fluxo de teste devolve código de saída 0.

## Red Flags & Anti-Patterns
- **Nunca** despeje o HTML completo da página no prompt do modelo para decidir o que clicar. Use seletores pontuais ou snapshots curtos.
- **Nunca** declare um teste bem-sucedido apenas porque a página retornou HTTP 200: valide elementos e estados esperados.

> Gerado pelo Izanagi AI: cópia fiel de `skills/browser-playwright/SKILL.md` (fonte da verdade).
