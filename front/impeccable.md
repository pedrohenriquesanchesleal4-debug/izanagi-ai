---
name: impeccable
description: "Direção de arte e vocabulário de design de alta precisão (Impeccable de Paul Bakaus): 4 modos intencionais (Persuade, Operate, Read, Experience), sistema de cores OKLCH com neutros tonalizados, raios concêntricos e comandos de refinamento ('quieter', 'bolder', 'distill', 'polish', 'overdrive')."
triggers:
  - "projetar ou refinar interface com acabamento impecável (Impeccable)"
  - "aplicar cores em OKLCH com neutros tonalizados e contraste perceptual"
  - "ajustar modo de design para Persuade, Operate, Read ou Experience"
  - "executar comandos de direção de arte: polish, distill, quieter, bolder, overdrive"
stack: [react, nextjs, tailwind-css, oklch, design-systems]
---

# Impeccable — Design Engineering & Vocabulário de Direção de Arte

Esta skill incorpora os pilares do framework **Impeccable** (`impeccable.style` / Paul Bakaus) para impedir que LLMs gerem interfaces genéricas. Toda decisão visual deriva do modo de intenção do usuário, geometria concêntrica e cores perceptualmente uniformes em OKLCH.

---

## 1. Os 4 Modos Intencionais de Design (Intentional Design Modes)

Identifique o objetivo primário da página antes de definir densidade, tipografia e espaçamento:

| Modo | Objetivo do Usuário | Densidade & Espaço | Tipografia & Hierarquia | Superfície & Cor |
|---|---|---|---|---|
| **1. Persuade** *(Landing, Pricing, Checkout)* | Decidir e converter com confiança | Generosa (`py-24` a `py-36`), 1 narrativa focal por dobra | Contraste dramático: Display (`clamp(2.75rem, 6vw, 5.5rem)`, `leading-[0.98]`, `tracking-tighter`) vs Body `16-18px` | Paleta expressiva com 1 acento de alta conversão; zero ruído lateral |
| **2. Operate** *(Dashboards, DevTools, Editores)* | Executar tarefas complexas em alta velocidade | Alta densidade (`p-3` a `p-5`, `gap-2` a `gap-4`), aproveitamento total da viewport | Escala contida (`12px-14px` base), `tabular-nums` obrigatório, labels `font-mono uppercase` | Neutros tonalizados em OKLCH; bordas finas de 1px; atalhos `<kbd>` visíveis |
| **3. Read** *(Docs, Artigos, Relatórios)* | Absorver conteúdo longo sem fadiga ocular | Largura de linha estrita (`60ch-75ch` / `max-w-prose`), margens amplas | Ritmo vertical cadenciado (`leading-[1.65]` a `1.75`), subtítulos bem ancorados | Contraste suave (papel quente `#fbfbfa` ou ardósia escura `#0c0d10`) |
| **4. Experience** *(Portfólios, Showcases, WebGL)* | Sentir imersão e memorabilidade | Assimetria editorial, sangria (*bleed*) até a borda da tela | Tipografia como elemento gráfico arquitetural | Iluminação direcional, profundidade em camadas e coreografia de scroll |

---

## 2. Sistema de Cores Perceptual em OKLCH & Neutros Tonalizados

Nunca use cinzas puros mortos (`#808080`). Tonalize todas as superfícies neutras com uma fração sutil de croma (`0.005` a `0.015`) na matiz da marca dentro do espaço **OKLCH**:

```css
:root {
  --hue: 255; /* Matiz base da marca */

  /* Light Mode — Neutros Quentes / Tonalizados */
  --bg-canvas: oklch(0.985 0.004 85);
  --bg-card: oklch(1 0 0);
  --bg-subtle: oklch(0.955 0.006 85);
  --border-subtle: oklch(0.20 0.01 var(--hue) / 0.08);
  --text-main: oklch(0.16 0.015 var(--hue));
  --text-muted: oklch(0.46 0.015 var(--hue));
  --accent: oklch(0.55 0.19 var(--hue));
}

.dark {
  /* Dark Mode — Profundidade Tonalizada (Zero Cinza Chapado) */
  --bg-canvas: oklch(0.13 0.012 var(--hue));
  --bg-card: oklch(0.17 0.014 var(--hue));
  --bg-elevated: oklch(0.21 0.016 var(--hue));
  --border-subtle: oklch(0.98 0.005 var(--hue) / 0.09);
  --text-main: oklch(0.96 0.005 var(--hue));
  --text-muted: oklch(0.68 0.012 var(--hue));
  --accent: oklch(0.68 0.17 var(--hue));
}
```

---

## 3. Raios Concêntricos & Erradicação do "Card-in-Card"

### 3.1 Fórmula Matemática de Raios Concêntricos
Quando um cartão ou botão arredondado está aninhado dentro de um contêiner com padding, **jamais use o mesmo border-radius nos dois**:

$$R_{\text{externo}} = R_{\text{interno}} + \text{Padding}$$

```tsx
// ✅ CORRETO: Interno 8px (rounded-lg) + Padding 8px (p-2) = Externo 16px (rounded-2xl)
<div className="p-2 rounded-2xl bg-zinc-900 border border-white/[0.08]">
  <div className="p-4 rounded-lg bg-zinc-950">
    Curvatura concêntrica harmônica
  </div>
</div>
```

### 3.2 Anti "Card-Within-Card"
Não empilhe caixas com borda dentro de caixas com borda. Use **espaço em branco (`gap`, `py`) e linhas divisórias sutis (`divide-y divide-white/[0.06]`)** para separar grupos de informação.

---

## 4. Vocabulário de Direção de Arte (Design Steering Directives)

1. **`"Make it quieter"`**: Reduzir contraste de bordas para `white/[0.06]`, remover sombras pesadas, aumentar espaçamento em 25%, neutralizar cores de badges secundários.
2. **`"Make it bolder"`**: Dobrar contraste de escala entre Display (`text-7xl+`) e corpo, apertar tracking (`tracking-tighter`), acentuar contraste de superfície.
3. **`"Distill"`**: Eliminar wrappers desnecessários, ícones redundantes e caixas aninhadas; deixar apenas tipografia, dados e espaço negativo.
4. **`"Polish"`**: Corrigir raios concêntricos, alinhar ícones opticamente, aplicar `tabular-nums`, adicionar `active:scale-[0.98]` e `ring-1 ring-inset ring-white/10`.
5. **`"Push into overdrive"`**: Adicionar revelações coreografadas, micro-feedback tátil e iluminação sutil de superfície.

---

## 5. Checklist Impeccable (Pre-Delivery Hook)

- [ ] Densidade e layout obedecem ao Modo de Design (*Persuade, Operate, Read ou Experience*).
- [ ] Cinzas e superfícies são tonalizados (OKLCH / zinc / slate) e não cinzas puros mortos.
- [ ] Todos os contêineres arredondados aninhados respeitam $R_{\text{externo}} = R_{\text{interno}} + \text{Padding}$.
- [ ] Nenhum "card dentro de card dentro de card" desnecessário (*Distill* aplicado).
- [ ] Medida de linha em textos de leitura limitada a `60ch–75ch` (`max-w-prose`).
