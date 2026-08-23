---
name: "accessibility-reviewer"
description: "Audita acessibilidade WCAG 2.2 AA/AAA: contraste, navegação por teclado, ARIA e leitores de tela. Use ao revisar componentes ou páginas antes de merge/deploy. Gatilhos de ativação: accessibility reviewer (wcag 2.2 aa); quando usar; princípios wcag 2.2 (perceptível, operável, compreensível, robusto); workflow de auditoria (4 passos)."
version: 2.0.0
category: testing
tools:
  mcp:
    - mcp:execute_command
references:
  - "references.md"
---

# Accessibility Reviewer (WCAG 2.2 AA)

> Migrado deterministicamente de `skills/accessibility-reviewer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Testes & QA (`testing`)
- **Resumo:** Audita acessibilidade WCAG 2.2 AA/AAA: contraste, navegação por teclado, ARIA e leitores de tela.
- **Ativar quando:** Use ao revisar componentes ou páginas antes de merge/deploy.
- **Escopo canônico:** Accessibility Reviewer (WCAG 2.2 AA)
- **Seções do corpo original:** Quando usar · Princípios WCAG 2.2 (Perceptível, Operável, Compreensível, Robusto) · Workflow de auditoria (4 passos) · Exemplo de código acessível (componente de botão com loading e ARIA) · Checklist de qualidade (antes de entregar)
- **Ferramentas MCP esperadas:** mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Inspeção automatizada (triagem inicial)

```bash
npx axe-core-cli https://localhost:3000   # ou integração com Playwright/Lighthouse
```

### Passo 2 — Validação de teclado (sem mouse)

- Navegue pela página inteira usando apenas `Tab` e `Shift+Tab`.
- Verifique se a ordem de foco é lógica (esquerda para direita, cima para baixo).
- Confirme se o anel de foco (`focus-visible`) está visível em todos os botões, links e inputs.

### Passo 3 — Verificação de contraste e zoom

- Use ferramentas de cor (Eyedropper / axe DevTools) nas combinações texto/fundo.
- Teste a página com zoom de `200%` — o layout não pode quebrar nem perder conteúdo.

### Passo 4 — Relatório de achados

Formate os achados com severidade, elemento HTML, falha WCAG e correção em código.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Contraste de texto atende 4.5:1 (AA)
- [ ] 100% operável via teclado, sem armadilhas de foco
- [ ] Indicador de foco (`focus-visible`) presente e destacado
- [ ] Inputs com `<label>` associado ou `aria-label`
- [ ] Estrutura de headings (`h1` a `h6`) sem saltar níveis
- [ ] Atributos ARIA corretos em componentes customizados
- [ ] Suporte a zoom 200% sem perda de funcionalidade
- [ ] Testado com axe-core ou leitor de tela

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

# Accessibility Reviewer (WCAG 2.2 AA)

Auditoria de acessibilidade rigorosa contra padrões **WCAG 2.2 (nível AA e AAA)** — garantindo que pessoas com deficiência visual, motora, auditiva ou cognitiva consigam operar o sistema perfeitamente.

## Quando usar

Use ao: revisar componentes ou telas novas; auditar páginas antes de release; testar navegação por teclado e leitores de tela; validar contraste de cores do design system. **Pule** para: revisão geral de usabilidade sem foco em a11y (skill `ux-reviewer`); auditoria de código geral (skill `code-auditor`).

## Princípios WCAG 2.2 (Perceptível, Operável, Compreensível, Robusto)

### 1. Perceptible (Perceptível)
- **Contraste de cores**: Relação mínima de `4.5:1` para texto normal e `3:1` para texto grande (≥18pt ou bold ≥14pt). Componentes de UI e ícones ativos: mínimo `3:1` contra o fundo.
- **Alternativas textuais**: Toda imagem informativa tem `alt` descritivo; imagens puramente decorativas usam `alt=""` ou `aria-hidden="true"`.
- **Conteúdo adaptável**: Informação e estrutura conveyadas por apresentação podem ser programaticamente determinadas (uso de headings h1-h6 sem pular níveis).

### 2. Operable (Operável)
- **Acessível por teclado**: 100% das funcionalidades operáveis via teclado (`Tab`, `Shift+Tab`, `Enter`, `Space`, setas). Zero armadilhas de foco (*keyboard traps*).
- **Indicador de foco visível**: `focus-visible` customizado e claro (nunca `outline: none` sem substituto visível).
- **Tempo suficiente**: Sem limites de tempo em formulários sem opção de extensão ou pausa.
- **Área de toque adequada**: Alvos interativos com mínimo de `44x44px` (ou espaçamento equivalente).

### 3. Understandable (Compreensível)
- **Idioma da página**: Atributo `lang="pt-BR"` (ou adequado) no elemento `<html>`.
- **Rótulos claros**: Todo input de formulário possui `<label>` explícito (`for`/`id`) ou `aria-label`/`aria-labelledby`.
- **Prevenção e recuperação de erro**: Mensagens de erro inline claras, associadas ao campo via `aria-describedby` ou `aria-invalid="true"`.

### 4. Robust (Robusto)
- **HTML Semântico**: Uso correto de landmarks (`<main>`, `<nav>`, `<header>`, `<footer>`, `<aside>`, `<section>`).
- **Atributos ARIA válidos**: Uso estrito apenas quando o HTML nativo não basta (ex: estados complexos como `aria-expanded`, `aria-selected`, `aria-live`).

## Workflow de auditoria (4 passos)

### 1. Inspeção automatizada (triagem inicial)
```bash
npx axe-core-cli https://localhost:3000   # ou integração com Playwright/Lighthouse
```

### 2. Validação de teclado (sem mouse)
- Navegue pela página inteira usando apenas `Tab` e `Shift+Tab`.
- Verifique se a ordem de foco é lógica (esquerda para direita, cima para baixo).
- Confirme se o anel de foco (`focus-visible`) está visível em todos os botões, links e inputs.

### 3. Verificação de contraste e zoom
- Use ferramentas de cor (Eyedropper / axe DevTools) nas combinações texto/fundo.
- Teste a página com zoom de `200%` — o layout não pode quebrar nem perder conteúdo.

### 4. Relatório de achados
Formate os achados com severidade, elemento HTML, falha WCAG e correção em código.

## Exemplo de código acessível (componente de botão com loading e ARIA)

```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  children: React.ReactNode;
}

export function AccessibleButton({ isLoading, children, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      className="px-4 py-2 rounded-lg bg-zinc-100 text-zinc-900 font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4 text-current" viewBox="0 0 24 24" aria-hidden="true">
            {/* path do spinner */}
          </svg>
          <span className="sr-only">Carregando...</span>
          <span>{children}</span>
        </span>
      ) : (
        children
      )}
    </button>
  );
}
```

## Checklist de qualidade (antes de entregar)
- [ ] Contraste de texto atende 4.5:1 (AA)
- [ ] 100% operável via teclado, sem armadilhas de foco
- [ ] Indicador de foco (`focus-visible`) presente e destacado
- [ ] Inputs com `<label>` associado ou `aria-label`
- [ ] Estrutura de headings (`h1` a `h6`) sem saltar níveis
- [ ] Atributos ARIA corretos em componentes customizados
- [ ] Suporte a zoom 200% sem perda de funcionalidade
- [ ] Testado com axe-core ou leitor de tela

## Anti-padrões (proibido)
1. ❌ `outline: none` em elementos interativos sem anel de foco customizado
2. ❌ Usar `<div>` ou `<span>` com `onClick` sem `role="button"`, `tabIndex={0}` e suporte a `Enter`/`Space`
3. ❌ Imagens informativas sem `alt` ou com `alt="imagem"`
4. ❌ Texto cinza claro (#9ca3af) em fundo branco (contraste insuficiente)
5. ❌ Modais que permitem o foco escapar para o fundo da página (sem focus trap)
6. ❌ Uso excessivo de ARIA desnecessário onde HTML nativo resolve (`<button>` vs `<div role="button">`)

## Composição com outras skills
- **Antes**: `frontend` (construção da UI) → `design-directions` (paleta com contraste garantido)
- **Depois**: `ux-reviewer` (heurísticas de usabilidade) → `qa` (testes E2E com axe/Playwright)

## References
- WCAG 2.2 QuickRef: https://www.w3.org/WAI/WCAG22/quickref/ · ARIA Authoring Practices Guide (APG): https://www.w3.org/WAI/ARIA/apg/ · axe-core: https://www.deque.com/axe/
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).
