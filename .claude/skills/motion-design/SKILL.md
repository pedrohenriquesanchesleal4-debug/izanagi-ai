---
name: motion-design
description: "Skill de Motion Design para Web — escolha e uso correto de bibliotecas de animação: GSAP (ScrollTrigger, SplitText), Anime.js v4, Motion (Framer Motion), Lottie, CSS Scroll-Driven Animations e Number Flow. Use quando o pedido envolver "gsap", "anime.js", "framer motion", "lottie", "micro-interações", "hover animation", "text reveal", "stagger", "spring", "motion design" ou animações de interface em geral."
---

# Motion Design

## Identity Especialista em escolher e aplicar a biblioteca certa para cada animação. Motion é linguagem de design: timing, easing e hierarquia comunicam tanto quanto cor e tipografia. Animações precisam ter propósito — revelar, orientar, celebrar. ## Decisão de biblioteca (Decision Tree) | Cenário | Biblioteca | |---|---| | Scroll scrub, pin, timeline complexa | **GSAP** + ScrollTrigger (+ SplitText) | | React/Next.js, animações declarativas | **Motion** (framer-motion) — `motion.div`, `whileInView`, `useSpring` | |… | Animação pré-fabricada (After Effects) | **Lottie** (`lottie-web`/`lottie-react`) com controle por scroll | | Efeitos sem JS (hover, reveals, dock) | **CSS Scroll-Driven Animations** (`animation-timeline: scroll()`) | | Números… ## GSAP (padrão para scroll & timelines) - React: use `@gsap/react` (`useGSAP`) — context seguro, cleanup automático de ScrollTriggers. - Tudo que é scrub leva `ease: 'none'`; reveals one-shot usam eases com personalidade (`power3/4.out`, `expo.out`). - Batch de muitos… ## Anime.js v4 (API modular) - Nomes v4: `to` (era `value`), `ease` (era `easing`), composição `replace/blend/none`. - `waapi` submodule (~3KB) quando o target é WAAPI puro; `engine` para config global (frameRate, pauseOnDocumentHidden). ## Motion (Framer Motion) — React ## Lottie - `lottie-react` com `<Lottie animationData={anim} />`; nunca carregar JSON gigante

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/motion-design/SKILL.md`.
