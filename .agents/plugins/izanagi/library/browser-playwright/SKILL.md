---
name: "browser-playwright"
description: "Automação e testes de navegador ponta a ponta com Playwright CLI. Use para validar interfaces reais, inspecionar elementos, capturar screenshots, verificar console errors e testar fluxos com máxima economia de tokens. Gatilhos de ativação: browser automation & testing com playwright cli; triggering criteria; step-by-step workflow; verification steps."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
---

# Browser Automation & Testing com Playwright CLI

> Migrado deterministicamente de `skills/browser-playwright/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Automação e testes de navegador ponta a ponta com Playwright CLI.
- **Ativar quando:** Use para validar interfaces reais, inspecionar elementos, capturar screenshots, verificar console errors e testar fluxos com máxima economia de tokens.
- **Escopo canônico:** Browser Automation & Testing com Playwright CLI
- **Seções do corpo original:** Triggering Criteria · Step-by-Step Workflow · Verification Steps · Red Flags & Anti-Patterns
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Verificação de Disponibilidade:

**Verificação de Disponibilidade:**

- Conferir se o `@playwright/cli` está disponível no ambiente:
     ```bash
     npx -y @playwright/cli --version
     ```
   - Se os browsers não estiverem instalados:
     ```bash
     npx playwright install chromium --with-deps
     ```

### Passo 2 — Abertura de Sessão Isolada:

**Abertura de Sessão Isolada:**

- Inicie a sessão com nome descritivo para não interferir em outros testes:
     ```bash
     npx -y @playwright/cli open <url> --session=<task-id>
     ```

### Passo 3 — Interação Determinística:

**Interação Determinística:**

- Preencha formulários e clique em elementos usando seletores semânticos ou texto:
     ```bash
     npx -y @playwright/cli fill <selector> "<text>"
     npx -y @playwright/cli click <selector>
     npx -y @playwright/cli press Enter
     ```

### Passo 4 — Captura de Evidências (Screenshots & Logs):

**Captura de Evidências (Screenshots & Logs):**

- Salve a evidência visual no diretório de saída:
     ```bash
     npx -y @playwright/cli screenshot --filename=evidence.png
     ```
   - Inspecione mensagens e erros de console:
     ```bash
     npx -y @playwright/cli console-logs
     ```

### Passo 5 — Finalização Limpa da Sessão:

**Finalização Limpa da Sessão:**

- Feche a página e finalize o navegador:
     ```bash
     npx -y @playwright/cli close --session=<task-id>
     ```

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- O arquivo de screenshot existe e não está vazio.
- Não há exceções não tratadas nos console logs da página.
- O fluxo de teste devolve código de saída 0.

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
