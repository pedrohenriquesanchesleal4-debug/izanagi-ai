# Referências — Scrollytelling & Motion

Curadoria técnica para sites cinematográficos: scroll-driven animations, smooth scroll, pinned sections e transições. URLs canônicas e verificáveis — **nunca invente URLs além destas**.

## Ferramentas core

| Recurso | URL | O que extrair |
|---|---|---|
| Lenis | https://github.com/darkroomengineering/lenis | Smooth scroll moderno (sucessor do Locomotive Scroll), leve e fácil de integrar; docs e exemplos no repo |
| GSAP + ScrollTrigger | https://gsap.com/docs | Docs oficiais: ScrollTrigger (pinned, scrub, timeline), SplitText, ScrollSmoother |
| Repo GSAP | https://github.com/gsap/GSAP | Código-fonte, issues e exemplos da comunidade |
| GSAP Showcase | https://gsap.com/showcase | Casos reais de sites que usam GSAP — inspiração com implementação provada |
| Scroll-Driven Animations (CSS) | https://developer.chrome.com/docs/css-ui/scroll-driven-animations | Animações nativas do browser via `animation-timeline: scroll()` — zero JS, performático |
| Demos de scroll-driven (Bramus) | https://scroll-driven-animations.style | Dezenas de demos reais de scroll-driven animations em CSS puro |
| Motion | https://motion.dev | Biblioteca de animação para React (sucessora do Framer Motion): `useScroll`, `useSpring`, layouts animados |
| CodePen | https://codepen.io | Buscar `ScrollTrigger`, `lenis`, `scroll driven` — snippets reais e rodáveis |

## Casos canônicos (referências visuais)

| Recurso | URL | O que extrair |
|---|---|---|
| Apple — iPhone 15 Pro | https://www.apple.com/iphone-15-pro/ | Padrão-ouro de scroll image sequence: frames que trocam conforme o scroll; micro-interações |
| Apple — AirPods Pro | https://www.apple.com/airpods-pro/ | Scrollytelling de produto: texto que entra/sai conforme seções fixam |
| Awwwards | https://www.awwwards.com | Galeria de sites premiados — filtrar por "scroll" / "animation" para achar casos recentes |

## Como usar no Izanagi

- **Quando consultar**: Discovery deve abrir esta curadoria sempre que o nível de animação (Fase 3, P11) for "cinematográfico/scrollytelling", ou quando a Trilha Técnica precisar de bibliotecas de movimento.
- **Como citar no prompt rico**: na seção "Referências — trilha técnica", cite a biblioteca escolhida com URL e o porquê (ex: "Lenis + GSAP ScrollTrigger para pinned sections no herói, como apple.com/iphone-15-pro").
- **Decisão de stack**: preferir Lenis (scroll) + GSAP ScrollTrigger (pinned/scrub) para storytelling complexo; CSS Scroll-Driven Animations quando o alvo for performance pura sem JS; Motion para micro-interações de UI em React.
- **Para o animation-agent**: deve ler esta curadoria antes de desenhar a motion signature; verificar os demos do Bramus para decidir entre CSS nativo vs JS.
