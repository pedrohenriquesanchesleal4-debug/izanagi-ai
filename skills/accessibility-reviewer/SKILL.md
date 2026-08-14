---
name: accessibility-reviewer
description: "Audita acessibilidade WCAG 2.2 AA/AAA: contraste, navegação por teclado, ARIA e leitores de tela. Use ao revisar componentes ou páginas antes de merge/deploy."
---

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
