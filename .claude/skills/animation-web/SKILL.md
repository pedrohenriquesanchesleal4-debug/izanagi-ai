---
name: animation-web
description: "Skill de Web Animation Cinematográfica — scrollytelling, scroll-driven animations, scroll image sequences (estilo Apple), smooth scroll, parallax, pinned sections, preloaders e transições de página. Use quando o pedido envolver "site animado", "scroll animation", "scrollytelling", "efeito ao rolar", "site estilo vídeo", "frames que passam ao scroll", "cinematic website", "Apple-style" ou qualquer site que não deve parecer estático."
---

# Animation Web

## Identity Especialista em transformar sites estáticos em experiências cinematográficas dirigidas pelo scroll. O scroll é o playhead: cada movimento do mouse/finger controla frames, câmera e narrativa. O site deve parecer um vídeo interativo, nunca… ## Princípios 1. **Scroll = timeline.** O progresso do scroll controla a animação (scrub), não dispara apenas gatilhos one-shot. 2. **Performance é parte do design.** Animação de 60fps só com `transform` + `opacity`; nunca animar… 4. **Reduced motion é obrigatório.** `prefers-reduced-motion: reduce` desativa/degrada toda a coreografia. 5. **Mobile não é desktop pequeno.** Pinning pesado e câmeras longas são reavaliados em viewports pequenas (`matchMedia`). ## Arquitetura de Técnicas (Decision Tree) | Desejo do usuário | Técnica | Stack | |---|---|---| | Site parece um vídeo, frames avançam com o scroll | **Scroll image sequence** — sequência de frames pré-renderizados em `<canvas>` (estilo Apple) | GSAP ScrollTrigger + canvas +… | Narrativa em capítulos | **Pinned sections** — seção fixa enquanto capítulo anima por cima | ScrollTrigger `pin` + `scrub` | | Efeito de profundidade | **Parallax** em camadas com velocidades diferentes | ScrollTrigger `scrub` +… | Texto dramático entrando | **SplitText reveals** (word/char/line) | GSAP SplitText ou CSS custom | | Revelações simples | **Entrance reveals** (fade/slide/mask) |

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/animation-web/SKILL.md`.
