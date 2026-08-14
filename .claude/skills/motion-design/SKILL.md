---
name: motion-design
description: "Escolha e uso de bibliotecas de animação web (GSAP, Motion, Anime.js, Lottie, CSS scroll-driven, Number Flow). Use ao implementar micro-interações, scroll animations ou motion design de UI."
---

# Motion Design — Bibliotecas de Animação

## Identity

Especialista em escolher e aplicar a biblioteca certa para cada animação. Motion é linguagem de design: timing, easing e hierarquia comunicam tanto quanto cor e tipografia. Animações precisam ter propósito — revelar, orientar, celebrar.

## Decisão de biblioteca (Decision Tree)

| Cenário | Biblioteca |
|---|---|
| Scroll scrub, pin, timeline complexa | **GSAP** + ScrollTrigger (+ SplitText) |
| React/Next.js, animações declarativas | **Motion** (framer-motion) — `motion.div`, `whileInView`, `useSpring` |
| Leve, tree-shakeable, SVG/stagger/springs | **Anime.js v4** (`animate`, `stagger`, `createSpring`, `svg`) |
| Animação pré-fabricada (After Effects) | **Lottie** (`lottie-web`/`lottie-react`) com controle por scroll |
| Efeitos sem JS (hover, reveals, dock) | **CSS Scroll-Driven Animations** (`animation-timeline: scroll()`) |
| Números contando/transitando | **Number Flow** (`@number-flow/react`) |
| Hover/tap simples em qualquer stack | CSS transitions + `transform` (zero deps) |

## GSAP (padrão para scroll & timelines)

```js
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
gsap.registerPlugin(ScrollTrigger, SplitText);

// Reveal com scrub
gsap.from('.el', { opacity: 0, y: 60, duration: 1, ease: 'power3.out',
  scrollTrigger: { trigger: '.el', start: 'top 85%' } });

// Pinned scrub (progresso proporcional ao scroll)
gsap.to('.el', { xPercent: 100, ease: 'none',
  scrollTrigger: { trigger: '#section', start: 'top top', end: '+=1000', pin: true, scrub: 1 } });

// SplitText (palavra a palavra)
const split = new SplitText('.title', { type: 'words,chars' });
gsap.from(split.chars, { yPercent: 120, stagger: 0.02, ease: 'power4.out',
  scrollTrigger: { trigger: '.title', start: 'top 80%' } });
```

- React: use `@gsap/react` (`useGSAP`) — context seguro, cleanup automático de ScrollTriggers.
- Tudo que é scrub leva `ease: 'none'`; reveals one-shot usam eases com personalidade (`power3/4.out`, `expo.out`).
- Batch de muitos elementos: `ScrollTrigger.batch()`.
- **Licença (2026)**: desde a aquisição pela Webflow (abr/2025), GSAP core + **todos** os plugins antes exclusivos do Club GreenSock (`SplitText`, `MorphSVG`, `DrawSVG`, `ScrollSmoother`) são **100% gratuitos, inclusive uso comercial**, instaláveis direto do npm público — não peça nem configure token de registry privado (`GREENSOCK_...`), isso é obsoleto.
- **SplitText 3.13**: reescrito (14 recursos novos, ~50% menor), com melhorias de acessibilidade, re-split responsivo (recalcula em resize) e suporte a elementos aninhados/emoji — prefira sempre a versão atual do pacote `gsap` em vez de forks antigos.
- GSAP também anima direto para CSS custom properties: `gsap.to('.el', { color: 'var(--accent)' })`.

## Anime.js v4 (API modular)

```js
import { animate, stagger, createSpring, createTimeline, splitText } from 'animejs';

animate('.box', { x: 200, rotate: '1turn', ease: 'outExpo', duration: 1200 });
animate('.list li', { opacity: [0, 1], translateY: [20, 0], delay: stagger(60) });

const spring = createSpring({ mass: 1, stiffness: 200, damping: 12, bounce: 0.3 });
animate('.btn', { scale: 1.1, ease: spring });

const tl = createTimeline({ defaults: { duration: 800, ease: 'outExpo' } });
tl.add('.a', { x: 100 }).add('.b', { x: 100 }, '+=200');

// Texto (char/word/line)
const { chars } = splitText('.title', { type: 'chars' });
animate(chars, { translateY: ['100%', 0], delay: stagger(30) });

// SVG: motion path e drawing
import { createMotionPath } from 'animejs/svg';
animate('.dot', { x: createMotionPath('#path') });
```

- Nomes v4: `to` (era `value`), `ease` (era `easing`), composição `replace/blend/none`.
- `waapi` submodule (~3KB) quando o target é WAAPI puro; `engine` para config global (frameRate, pauseOnDocumentHidden).

## Motion (Framer Motion) — React

**Motion v12 (mar/2026)**: projeto independente (renomeado de "Framer Motion" pra "Motion" em 2025); import path é `motion/react` (não `framer-motion`). Motor híbrido: roda nativo via Web Animations API + `ScrollTimeline` do browser quando possível (até 120fps, fora da main thread), e cai pra JS só quando precisa de recurso que WAAPI não cobre (spring física, keyframes interrompíveis, gestos). As APIs de scroll (`useScroll`, `whileInView`) que eram experimentais em v10 hoje são o caminho padrão para qualquer coisa reativa a scroll.

```tsx
import { motion, useScroll, useSpring, useTransform } from 'motion/react';

// Reveal in-view
<motion.div initial={{ opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }}
  viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />

// Scroll-driven (useScroll + useTransform)
const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
const y = useTransform(scrollYProgress, [0, 1], [80, -80]);
const opacity = useSpring(useTransform(scrollYProgress, [0, 0.5, 1], [0, 1, 1]), { stiffness: 100 });

// Variants + stagger
const container = { show: { transition: { staggerChildren: 0.08 } } };
```

## Lottie

- `lottie-react` com `<Lottie animationData={anim} />`; nunca carregar JSON gigante inline — dynamic import.
- Controlar por scroll: `lottie.goToAndStop(progress * totalFrames, true)` dentro do ScrollTrigger scrub.
- preferir `renderer: 'svg'` (escalável) sobre canvas para Lotties simples.

## CSS Scroll-Driven Animations (sem JS)

```css
@supports (animation-timeline: scroll()) {
  .reveal { animation: fadeUp linear both;
    animation-timeline: view(); animation-range: entry 0% entry 60%; }
}
```

## Rules

- **Menos é mais**: uma animação por atenção. Animar para comunicar, não para decorar.
- Timing: micro-interações 150-300ms; reveals 500-900ms; narrativas 1s+.
- Easing com personalidade: `cubic-bezier(0.22, 1, 0.36, 1)` (expo-ish) é o default premium; evitar `linear` em reveals e `ease-in` em entradas.
- Stagger: 30-80ms entre itens; nunca > 200ms (parece travado).
- Só `transform` + `opacity` (GPU); `will-change` pontual.
- `prefers-reduced-motion`: `gsap.matchMedia()` / `useReducedMotion` / CSS media query → versão estática.
- Uma lib por projeto quando possível; tree-shaking no import.
- Não misturar dois sistemas de easing na mesma cena sem propósito.

## Checklists

- [ ] Biblioteca escolhida pela decision tree (não pelo hype)
- [ ] Easing/timing com intenção (nunca default `ease`)
- [ ] Stagger limitado e consistente
- [ ] ScrollTrigger registrado (`registerPlugin`) e limpo (useGSAP/kill)
- [ ] Reduced motion tratado
- [ ] Só transform/opacity nos hot paths
- [ ] Bundle tree-shaken (Anime.js modular / Motion por import)
- [ ] Números com Number Flow se houver counters

## References

- [GSAP 3.13 release notes](https://gsap.com/blog/3-13/) — confirma licenciamento 100% gratuito (todos os plugins Club GreenSock inclusos) e reescrita do SplitText.
- [Motion (motion.dev)](https://motion.dev/docs/react) — docs oficiais v12, motor híbrido WAAPI/ScrollTimeline + fallback JS.
- Veja `references.md` nesta pasta — Anime.js v4 API, Kinetik/Kinetic/Mellow UI (padrões de micro-interação) e skills públicas de anime.js para estudo.

## Metrics & Evolution

- 60fps; INP < 200ms; bundle de animação < 60KB gzip (apenas o que usa).
- Reflection: qual lib usada e por quê, o que o usuário achou do "feel".

> Gerado pelo Izanagi AI — cópia fiel de `skills/motion-design/SKILL.md` (fonte da verdade).
