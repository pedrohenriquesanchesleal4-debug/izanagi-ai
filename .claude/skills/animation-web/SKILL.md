---
name: animation-web
description: "Scrollytelling, scroll-driven animations, sequências de imagem em canvas (estilo Apple), parallax e pinned sections. Use quando o site não deve parecer estático e o scroll for a timeline da experiência."
---

> **Ver também**: `core/skill-composer.md` — chains `web_cinematic`/`webgl_experience` já resolvem quando combinar esta skill com `motion-design` (timing/easing) e `webgl-3d` (hero 3D).

# Animation Web — Scrollytelling & Cinematic Sites

## Identity

Especialista em transformar sites estáticos em experiências cinematográficas dirigidas pelo scroll. O scroll é o playhead: cada movimento do mouse/finger controla frames, câmera e narrativa. O site deve parecer um vídeo interativo, nunca uma página comum.

## Princípios

1. **Scroll = timeline.** O progresso do scroll controla a animação (scrub), não dispara apenas gatilhos one-shot.
2. **Performance é parte do design.** Animação de 60fps só com `transform` + `opacity`; nunca animar `top/left/width/height/margin`.
3. **Prefere visualização progressiva.** Cada seção revela informação em camadas enquanto o usuário rola.
4. **Reduced motion é obrigatório.** `prefers-reduced-motion: reduce` desativa/degrada toda a coreografia.
5. **Mobile não é desktop pequeno.** Pinning pesado e câmeras longas são reavaliados em viewports pequenas (`matchMedia`).

## Arquitetura de Técnicas (Decision Tree)

| Desejo do usuário | Técnica | Stack |
|---|---|---|
| Site parece um vídeo, frames avançam com o scroll | **Scroll image sequence** — sequência de frames pré-renderizados em `<canvas>` (estilo Apple) | GSAP ScrollTrigger + canvas + preload |
| Camera se move pelo produto/cena no scroll | **Scroll-driven 3D** — câmera/objetos reagindo à posição de scroll | Three.js / R3F + ScrollTrigger |
| Narrativa em capítulos | **Pinned sections** — seção fixa enquanto capítulo anima por cima | ScrollTrigger `pin` + `scrub` |
| Efeito de profundidade | **Parallax** em camadas com velocidades diferentes | ScrollTrigger `scrub` + `yPercent` |
| Slide horizontal de conteúdo | **Horizontal scroll section** — painéis se movem lateralmente | ScrollTrigger `pin` + `xPercent` |
| Texto dramático entrando | **SplitText reveals** (word/char/line) | GSAP SplitText ou CSS custom |
| Revelações simples | **Entrance reveals** (fade/slide/mask) | IntersectionObserver / CSS `animation-timeline: scroll()` ou `view()` — suportado nativamente em Chrome 115+, Edge 115+, Firefox 132+, Safari 18+ (2026); sem esses browsers, fallback obrigatório via `@supports (animation-timeline: scroll())` |
| Hero "wow" no topo | **Preloader + hero reveal coreografado** | GSAP timeline + Lenis |

## Workflow

1. **Storyboard primeiro.** Divida o conteúdo em cenas (hero → capítulo 1..n → finale). Cada cena = 1 técnica + 1 gatilho de scroll.
2. **Escolha a stack de scroll**: Lenis (smooth scroll) + GSAP ScrollTrigger (controle de scrub/pin) é o padrão; React usa `lenis` + `@gsap/react` (`useGSAP`).
3. **Implemente por cena**, começando pelo hero.
4. **Valide perf**: DevTools Performance panel, Lighthouse, Core Web Vitals (LCP/INP/CLS).
5. **Degrade**: sem JS → conteúdo estático visível; reduced motion → sem scrub.

## Padrões Core

### Scroll image sequence (o "site-vídeo" do usuário)
```js
gsap.registerPlugin(ScrollTrigger);
// canvas fixo + frames 0001.jpg..0120.jpg pré-carregados com Image() cache
const img = new Image(); // draw com requestAnimationFrame; só drawFrame() no onUpdate
gsap.to(frames, {
  frame: totalFrames - 1,   // objeto-proxy: { frame: 0 }
  ease: 'none',
  scrollTrigger: { trigger: '#pin', start: 'top top', end: '+=4000', pin: true, scrub: 1 }
});
```
- Preload frames com cache compartilhado (`Map<src, Image>`).
- Canvas HiDPI: `canvas.width = clientWidth * min(devicePixelRatio, 2)`.
- Texto/capítulos aparecem como overlays em pontos específicos do progresso (timeline sobre o scrub).
- **Performance (2026)**: nunca redesenhe o canvas dentro do handler de `resize` sem debounce/throttle — mobile dispara `resize` repetidamente em mudanças de viewport (rotação, barra de endereço escondendo); recalcule dimensões só depois do evento estabilizar. O handler de scroll/scrub em si deve ficar leve (`onUpdate` só troca o índice do frame e chama `drawFrame()`, nunca decodifica imagem ali). Otimize o peso da sequência (WebP/AVIF, resolução por breakpoint) antes de otimizar o código — dezenas a centenas de frames pesam mais que qualquer microotimização de JS.

### Hero coreografado
```js
const tl = gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true }});
tl.to('.hero-title', { yPercent: -40, opacity: 0, ease: 'none' })
  .to('.hero-visual', { scale: 0.9, yPercent: 10, ease: 'none' }, 0);
```

### Smooth scroll (Lenis)
```js
const lenis = new Lenis({ duration: 1.2, easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);
```

### Horizontal scroll
```js
const panels = gsap.utils.toArray('.panel');
gsap.to(panels, { xPercent: -100 * (panels.length - 1), ease: 'none',
  scrollTrigger: { trigger: '#track', pin: true, scrub: 1, snap: 1 / (panels.length - 1),
    end: () => '+=' + track.offsetWidth } });
```

## Rules

- **Regra de ouro**: `ease: 'none'` em tudo que for scrub (proporcional ao scroll); easing animado só em reveals one-shot.
- Nunca bloquear LCP: frames e libs carregam lazy; hero estático primeiro, animação depois.
- `will-change` só no elemento animando ativamente e removido ao final; evitar em massa.
- Respeitar `prefers-reduced-motion` (desliga scrub, mostra frames finais).
- Mobile: pin de seções altas vira scroll normal + transições simples (`ScrollTrigger.matchMedia()`).
- Limpar triggers: `ScrollTrigger.getAll().forEach(t => t.kill())` em SPA unmount; `useGSAP` faz isso automaticamente no React.
- Scrollbar nativa ou Lenis? Lenis para desktop; manter scrollbar nativa para acessibilidade — nunca `overflow: hidden` no body sem fallback.

## Checklists

- [ ] Storyboard das cenas definido antes do código
- [ ] Scroll = timeline (scrub) nas cenas principais
- [ ] Só transform/opacity animados (sem layout thrash)
- [ ] Frames de imagem pré-carregados com cache + HiDPI cap
- [ ] Lenis integrado com ScrollTrigger (update no scroll, raf no ticker)
- [ ] Reduced motion tratado
- [ ] Mobile: pin/pesado removido ou simplificado
- [ ] LCP/INP/CLS verdes (Lighthouse ≥ 90 perf)
- [ ] Sem JS → conteúdo visível
- [ ] Qualidade: micro-interações de hover/tap nos elementos-chave

## References

- [MDN — CSS scroll-driven animations](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_scroll-driven_animations) — spec de `scroll-timeline`/`view-timeline`, suporte de browser atualizado.
- [GSAP Vault — Apple-Style Scroll Image Sequences](https://gsapvault.com/blog/scroll-image-sequence-tutorial) — tutorial de referência do padrão canvas + ScrollTrigger + HiDPI + Lenis.
- Veja `references.md` nesta pasta — sites de referência (uiprompts.app, Apple product pages, scrollytelling exemplos, Skiper UI, KokonutUI) com técnicas extraídas de cada um.

## Metrics & Evolution

- Objetivos: 60fps no scroll, LCP < 2.5s, INP < 200ms, CLS < 0.1.
- Registrar no reflection log: técnica usada por cena, problemas de perf encontrados, o que funcionou para o usuário.

> Gerado pelo Izanagi AI: cópia fiel de `skills/animation-web/SKILL.md` (fonte da verdade).
