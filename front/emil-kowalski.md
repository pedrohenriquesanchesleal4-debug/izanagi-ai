---
name: emil-kowalski
description: "Design Engineering e física de interfaces ('Agents with Taste' de Emil Kowalski — Vercel/Linear/Sonner/Vaul): micro-interações rápidas (140-220ms), curvas ease-out físicas, proibição de scale(0), transform-origin contextual, bordas semitransparentes hairline e quando NÃO animar."
triggers:
  - "implementar ou revisar micro-interações, animações de UI e transições"
  - "aplicar heurísticas do Emil Kowalski (Agents with Taste / emil-design-eng)"
  - "polir botões, popovers, modais, toasts, drawers e componentes interativos"
  - "decidir quando animar vs quando manter transição instantânea"
stack: [react, nextjs, motion-react, tailwind-css, radix-ui, sonner, vaul]
---

# Emil Kowalski — Agents with Taste & UI Motion Craft

Esta skill codifica as heurísticas de Design Engineering de **Emil Kowalski** (`emilkowalski/skills` · autor de *Sonner* e *Vaul*, Vercel/Linear). Seu propósito é eliminar falhas sutis que denunciam código gerado por IA — como animações lentas, curvas `ease-in` em entradas, elementos escalando de `scale(0)` e bordas hexadecimais duras.

---

## 1. As 7 Leis da Física de Interfaces (`animate` & `review-animations`)

### 1.1 Proibição Absoluta de `scale(0)` em Entradas
Nada no mundo real surge do zero absoluto. Iniciar um modal, popover ou botão em `scale(0)` produz um efeito artificial de "balão inflando".
- **Regra**: Sempre inicie entradas em **`scale(0.95)` a `scale(0.97)`** combinado com `opacity: 0`.

```tsx
// ✅ CORRETO: Ancoragem física com scale(0.96) + ease-out exponencial rápido
<motion.div
  initial={{ opacity: 0, scale: 0.96, y: 4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.97, y: 2 }}
  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
/>
```

### 1.2 Curvas de Easing por Direção Física
- **Entradas (Elementos surgindo na tela)**: Devem começar rápidos e desacelerar suavemente (**`ease-out`**):
  - Curvas canônicas: `cubic-bezier(0.16, 1, 0.3, 1)` ou `cubic-bezier(0.22, 1, 0.36, 1)`.
  - **NUNCA** use `ease-in` ou `linear` em entradas (cria sensação de lentidão e travamento no clique).
- **Saídas (Elementos fechando)**: Mais rápidas que a entrada (`120ms–150ms`).
- **Mudança de Posição / Layout na Tela**: Use `spring` físico (`type: "spring", duration: 0.4, bounce: 0.15`).

### 1.3 Durações Rápidas para Controles de UI (140ms – 220ms)
Interações de produto precisam de resposta imediata:
- **Botões / Links (hover e press)**: `100ms – 150ms`
- **Dropdowns / Popovers / Tooltips**: `140ms – 180ms`
- **Modais / Drawers / Toasts**: `180ms – 240ms`
- *Acima de 300ms em controles operacionais faz a interface parecer pesada e lenta.*

### 1.4 `transform-origin` Contextual Obrigatório
Popovers, menus e tooltips devem escalar **a partir do elemento gatilho que os abriu**, nunca do centro genérico:
```css
.dropdown-content {
  transform-origin: var(--radix-dropdown-menu-content-transform-origin);
}
```

### 1.5 Quando NÃO Animar (`find-animation-opportunities`)
- **Navegação de alta frequência via teclado**: Mudar o item selecionado com setas `↑/↓` numa Command Palette (`Cmd+K`) ou menu de contexto deve ser **instantâneo (`0ms`)**. Animar seleção de teclado faz o aplicativo parecer atrasado.
- **Telas operacionais abertas dezenas de vezes ao dia**: Não force animações longas de entrada nos dados principais de um dashboard.

### 1.6 Feedback Tátil Imediato (`emil-design-eng`)
Todo botão ou controle clicável deve responder ao clique com leve compressão física sem deslocar o layout vizinho:
```tsx
<button className="transition-transform duration-150 ease-out active:scale-[0.97]">
  Confirmar
</button>
```

### 1.7 Exclusividade de Propriedades GPU
Anime apenas `transform`, `opacity`, `filter` e `clip-path`. Jamais anime `width`, `height`, `top`, `left` ou `margin`.

---

## 2. Acabamento de Superfície: Bordas Translúcidas & Sombras

Substitua bordas sólidas (`border: 1px solid #e5e7eb`) por **bordas semitransparentes com `background-clip: padding-box`** e sombras em camadas:

```css
/* Light Mode: anel translúcido 1px + sombra de elevação em camadas */
.surface-light {
  background: #ffffff;
  background-clip: padding-box;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 8px 16px -4px rgba(0, 0, 0, 0.06);
}

/* Dark Mode: brilho superior interno (inner highlight) + anel sutil */
.surface-dark {
  background: #141417;
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.07),
    0 12px 24px -6px rgba(0, 0, 0, 0.5);
}
```

---

## 3. Escolha de Primitivos de UI (`pick-ui-library`)

Não recrie do zero componentes complexos sujeitos a bugs de foco e gestos:
- **Modais, Popovers, Menus Acessíveis**: `@radix-ui/react-*` ou `@base-ui-components/react`
- **Toasts Empilháveis**: `sonner`
- **Drawers com Física de Arraste**: `vaul`
- **Command Palette (`Cmd+K`)**: `cmdk`

---

## 4. Checklist Emil Kowalski

- [ ] Nenhuma entrada de componente parte de `scale(0)` (usa `scale(0.95–0.97)`).
- [ ] Entradas usam `ease-out` (`[0.16, 1, 0.3, 1]`) com duração entre `140ms` e `220ms`.
- [ ] Menus e popovers usam `transform-origin` apontando para o botão gatilho.
- [ ] Botões possuem resposta `:active` (`active:scale-[0.97]`).
- [ ] Bordas usam transparência perceptual (`white/[0.08]` ou `black/[0.06]`) em vez de cinza sólido.
- [ ] Ações rápidas de teclado (`↑/↓`) não possuem atraso de animação.
- [ ] Suporte a `prefers-reduced-motion` garantido.
