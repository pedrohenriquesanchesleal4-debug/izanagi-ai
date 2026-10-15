---
name: "browser-playwright"
description: "Automação e testes de navegador ponta a ponta com Playwright CLI. Use para validar interfaces reais, inspecionar elementos, capturar screenshots, verificar console errors e testar fluxos com máxima economia de tokens."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
references:
  - "references.md"
---

# Browser Automation & Testing com Playwright CLI

## Triggering Criteria
- Validação de páginas web, fluxos ponta a ponta e formulários reais.
- Captura de evidências visuais (screenshots).
- Inspeção de console logs e regressões de interface.

## Step-by-Step Workflow
1. Verificar CLI: \`npx -y @playwright/cli --version\`
2. Abrir sessão com identificador único: \`npx -y @playwright/cli open <url> --session=<task-id>\`
3. Executar comandos pontuais (fill, click, type)
4. Capturar screenshot e conferir logs: \`npx -y @playwright/cli screenshot\`
5. Encerrar sessão: \`npx -y @playwright/cli close --session=<task-id>\`

## Verification Steps
- Arquivo de screenshot persistido.
- Sem erros críticos nos logs de console.
- Critérios BDD do fluxo atendidos.

## Common Rationalizations
- "A página abriu sem erro 500, então está funcionando": FALSO. Verifique o DOM e os elementos funcionais.

## Red Flags
- Injetar árvore inteira de acessibilidade no prompt.
- Ignorar sessões abertas sem fechamento após o teste.
