# References — Motion Design (Bibliotecas)

## Anime.js v4 (2025-2026)

- **Site**: animejs.com · **npm**: `animejs` (v4.3.x em 2026) · 58k+ stars · MIT
- **Filosofia**: API modular ESM tree-shakeable (~10KB gzip core; WAAPI ~3KB)
- **Imports**: `animate, stagger, createTimer, createTimeline, engine, eases, spring, defaults, utils, svg` (+ subpaths `animejs/svg`, `animejs/waapi`)
- **Renomeações v3→v4**: `value` → `to`; `easing` → `ease`; `anime()` → `animate()`; `anime.timeline()` → `createTimeline()`
- **Sistemas novos**: springs (`createSpring({mass, stiffness, damping, velocity, bounce})`), `createDraggable`, `createLayout` (v4.3, auto-layout + sync com scroll), `splitText`, módulo SVG (`createMotionPath`, `createDrawable`, morphing), keyframes em 4 sintaxes, composição `replace/blend/none`, GUI de inspeção
- **Perf**: 60fps em 3K elementos DOM (6K tweens) e 50K valores three.js InstancedMesh
- Fontes: github.com/juliangarnier/anime wiki "What's new in Anime.js V4"; solosoft.dev animejs-v4-guide-2026

## GSAP (GreenSock)

- **Site**: gsap.com · plugins: ScrollTrigger, SplitText, Draggable, Flip, MotionPath, Observer
- **Stack recomendada**: `gsap` + `@gsap/react` (useGSAP) + ScrollTrigger + SplitText
- **Padrões mais usados (2026)**: pinned scrub, parallax por camadas, horizontal scroll, text reveals (SplitText), SVG morph, Lottie frame-by-frame por scroll, image sequence em canvas
- **Licença (verificado, gsap.com/blog/3-13)**: desde a aquisição pela Webflow (abr/2025) GSAP é 100% gratuito, **inclusive uso comercial**, com todos os plugins que antes exigiam assinatura Club GreenSock (SplitText, MorphSVG, DrawSVG, ScrollSmoother) incorporados ao pacote `gsap` público no npm/GitHub — não há mais registry privado a configurar.
- **GSAP 3.13**: SplitText reescrito (14 recursos novos, ~50% menor, a11y melhorada, re-split responsivo, suporte a elementos aninhados/emoji); animação direta de CSS custom properties (`gsap.to(el, { color: 'var(--x)' })`); integração 1-clique via painel do Webflow.
- Fontes: gsapify.com, gsapvault.com (tutorial scroll-image-sequence com Lenis + HiDPI + capítulos), freefrontend.com (60+ exemplos), gsapdemos.com

## Motion (Framer Motion → Motion)

- **npm**: `motion` (import `motion/react`, NÃO `framer-motion`) — projeto tornou-se independente da Framer em 2025 e foi renomeado para "Motion".
- **Motion v12** (lançado mar/2026, verificado em motion.dev/docs/react): motor híbrido — roda nativamente via Web Animations API + CSS `ScrollTimeline` do browser (até 120fps, fora da main thread) e cai para JS somente quando precisa de spring physics, keyframes interrompíveis ou tracking de gesto que WAAPI não cobre. APIs de scroll (`useScroll`, `whileInView`) que eram experimentais em v10 agora são o caminho padrão para qualquer animação reativa a scroll.
- API: `motion.*`, `useScroll`, `useTransform`, `useSpring`, `useReducedMotion`, variants, layout animations
- Uso típico: reveals `whileInView`, parallax `useScroll+useTransform`, animações de layout (cards/accordions), gestos (drag, hover)
- Fonte: motion.dev

## Lottie

- `lottie-web` / `lottie-react` · animações After Effects exportadas como JSON
- Controle por scroll: `goToAndStop(progress * totalFrames)` no scrub
- Fontes: lottiefiles.com, animation-addons.com (lottie frame-by-frame com ScrollTrigger)

## Componentes animados de referência (2026)

- **Kinetik UI** (kinetikui.com) — 50+ componentes animados (magnetic buttons, toasts, counters, progress) com Framer Motion; "60fps animations"
- **Kinetic UI** (kineticui.vercel.app) — 100+ open-source: Shiny Button, Aurora Background, Meteor, Typewriter, Dock Menu, Spotlight Card, Number Ticker, Confetti, Parallax Scroll
- **Mellow UI** (mellowui.com) — motion-first editorial: texto que se move com o cursor, texture/timing/theatre
- **Number Flow** (number-flow.barvian.me) — transições numéricas (usado no Skiper UI)
- **Animations.dev** (Emil Kowalski) — padrões de animação de UI (3D card rotation, spring reveals) — base do estilo do Skiper UI

## Skills públicas de estudo

- github.com/BowTiedSwan/animejs-skills — skill Claude Code de Anime.js v4 (SKILL.md + references/)
- skills.rest/skill/animejs — "Master anime.js v4 web animations"

## Regras de timing (resumo)

- Micro-interação: 150-300ms · Reveal: 500-900ms · Narrativa: 1s+
- Stagger: 30-80ms · Easing premium: `cubic-bezier(0.22, 1, 0.36, 1)` ou GSAP `power4.out`/`expo.out`
- Sempre `prefers-reduced-motion`; só transform/opacity; uma lib por projeto
