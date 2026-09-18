# Referências — Motion & Web Animation (2025–2026)

Curadoria da stack de animação web canônica (scroll-driven, text splitting, 3D). URLs canônicas — **nunca invente URLs além destas**.

| Recurso | URL | O que extrair |
|---|---|---|
| GSAP docs | https://gsap.com | ScrollTrigger (scroll-driven), SplitText (animação de texto palavra/char/linha), timeline de precisão — padrão de scrollytelling profissional |
| Motion | https://motion.dev | Sucessor do Framer Motion: animação de UI em React (entrada, layout, gestos, scroll-linked via useScroll) — leve e declarativa |
| Three.js | https://threejs.org | WebGL 3D: cenas, shaders GLSL, partículas, GLTF — base de experiências imersivas |
| React Three Fiber | https://r3f.docs.pmnd.rs | Three.js declarativo em React (canvas, componentes, performance): 3D com DX de React |
| Lenis (smooth scroll) | https://github.com/darkroomengineering/lenis | Smooth scroll leve e performático (repo canônico, MIT; showcase visual em lenis.studio) — base de qualquer scrollytelling premium |
| Splitting.js | https://splitting.js.org | Divide texto em chars/words/lines para animação CSS/web — complemento não-JS-pesado ao SplitText |

## Composição no Izanagi

| Padrão | Cadeia de skills |
|---|---|
| Scrollytelling premium | `animation-web` (pinned sections, canvas sequence) + Lenis + GSAP ScrollTrigger |
| Micro-interações de UI | `motion-design` + Motion (layout/gestos) |
| Experiência 3D imersiva | `webgl-3d` + Three.js/R3F (budget de performance obrigatório) |
| Texto com personalidade | SplitText ou Splitting.js em 1-2 momentos-chave (nunca em tudo — RULES #16) |

Performance: motion é camada, não decoração (RULES #8). Ver `performance-seo.md` para budget de LCP/CLS/INP.