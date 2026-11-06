---
name: motion-design
description: "Seleção e aplicação de bibliotecas de animação web (Motion/Framer Motion v12, GSAP ScrollTrigger, Anime.js v4, Number Flow): micro-interações, curvas de easing e acessibilidade de movimento."
triggers:
  - "implementar animações de entrada, micro-interações e transições de UI"
  - "escolher biblioteca de animação adequada para o projeto"
  - "animar contadores numéricos ou transições de abas/layouts"
stack: [motion-react, gsap, animejs, tailwind-css, number-flow]
---

# Motion Design — Bibliotecas de Animação & Micro-Interações

Esta skill estabelece a engenharia de movimento para interfaces web. Animações não existem para decorar, mas para orientar o usuário, comunicar estado e conferir peso físico às interações digitais.

---

## 1. Árvore de Decisão de Bibliotecas de Animação

| Cenário de Uso | Biblioteca Recomendada | Import Oficial / Pacote |
|---|---|---|
| **React / Next.js declarativo (Padrão)** | **Motion (antigo Framer Motion v12)** | `import { motion, useScroll } from 'motion/react'` |
| **Scroll complexo com pin e scrub milimétrico** | **GSAP + ScrollTrigger** | `import gsap from 'gsap'; import { ScrollTrigger } from 'gsap/ScrollTrigger'` |
| **Contadores numéricos e transição de moedas** | **Number Flow** | `import NumberFlow from '@number-flow/react'` |
| **Animações SVG de desenho de caminho (Path)** | **Anime.js v4** | `import { animate, createSpring } from 'animejs'` |
| **Micro-interações de botões e hovers simples** | **CSS Transitions nativas** | `transition-all duration-150 ease-out` |

---

## 2. Princípios Físicos de Movimento

1. **Duração Perceptual**:
   - Micro-interações (hover, clique, toggle): **150ms a 250ms**.
   - Revelações de componentes (modais, menus, dropdowns): **250ms a 400ms**.
   - Transições de página e narrativas cênicas: **500ms a 800ms**.
2. **A Curva de Easing Canônica (Expo-Decel)**:
   - Evite `linear` e evite `ease` padrão do navegador.
   - Padrão premium de alta sofisticação:
     ```css
     transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
     ```
3. **Proibição de `scale(0)` em Entradas**:
   - Elementos nunca devem brotar de um ponto inexistente no vácuo. Use no máximo `scale(0.95)` para preservar a ancoragem espacial e física do objeto.
4. **Feedback Tátil em Botões**:
   - Todo botão interativo deve reagir ao estado `:active` com leve compressão:
     ```tsx
     <button className="transition-transform duration-100 active:scale-[0.97]">
     ```

---

## 3. Padrões de Código Executáveis

### 3.1 Motion (React 19 / Next.js App Router)
No React 19, utilize o pacote unificado `motion/react`:

```tsx
'use client';

import { motion } from 'motion/react';

export function FadeInCard({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.98 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{
        duration: 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
      className="p-6 rounded-xl bg-zinc-900 border border-zinc-800"
    >
      {children}
    </motion.div>
  );
}
```

### 3.2 Transições de Abas com `layoutId` (Framer/Motion)
Crie o efeito de marcador deslizante tipo macOS/Apple sem calcular posições em pixel:

```tsx
'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

const tabs = ['Visão Geral', 'Analytics', 'Faturamento'];

export function AnimatedTabs() {
  const [active, setActive] = useState(tabs[0]);

  return (
    <div className="flex gap-2 p-1 rounded-xl bg-zinc-900 border border-zinc-800">
      {tabs.map((tab) => (
        <button
          key={tab}
          onClick={() => setActive(tab)}
          className="relative px-4 py-2 text-sm font-medium transition-colors text-zinc-300 hover:text-white"
        >
          {active === tab && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 rounded-lg bg-zinc-800 shadow-sm"
              transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}
```

### 3.3 Transição Numérica com Number Flow
```tsx
'use client';

import NumberFlow from '@number-flow/react';

export function BalanceDisplay({ amount }: { amount: number }) {
  return (
    <div className="text-4xl font-mono font-bold tabular-nums text-zinc-100">
      <NumberFlow
        value={amount}
        format={{ style: 'currency', currency: 'BRL' }}
        trend={true}
      />
    </div>
  );
}
```

---

## 4. Acessibilidade de Movimento (`prefers-reduced-motion`)

É obrigatório fornecer fallback para usuários que possuem sensibilidade a movimento vestibular:

```tsx
// Exemplo em Tailwind CSS
<div className="transition-transform duration-300 motion-reduce:transition-none motion-reduce:transform-none">
```

---

## 5. Checklist de Motion

- [ ] Biblioteca correta escolhida (Motion para React, GSAP para scroll com pin/scrub).
- [ ] Curva de easing calibrada (`cubic-bezier(0.22, 1, 0.36, 1)` ou spring).
- [ ] Nenhuma entrada de elemento utiliza `scale(0)` (apenas `scale(0.95)` para cima).
- [ ] Botões possuem resposta ao estado `:active` (`scale-[0.97]`).
- [ ] O código respeita `prefers-reduced-motion` para usuários sensíveis.
- [ ] Apenas propriedades aceleradas por hardware GPU (`transform` e `opacity`) são animadas continuamente.
