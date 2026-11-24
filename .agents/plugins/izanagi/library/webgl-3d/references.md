# References — 3D na Web (WebGL / Three.js / R3F)

Pesquisa 2026: sites 3D premiados e a engenharia por trás. Use como referência de estilo e técnica.

## Portfólios e projetos de referência

| Site | Stack | Técnica principal |
|---|---|---|
| [bruno-simon.com](https://bruno-simon.com/) | Three.js | Portfolio dirigível: você controla um carro pela cena — 3D como gameplay |
| The Monolith ([themonolithproject.net](https://themonolithproject.net/)) | R3F + shaders custom | 13 cenas WebGL ligadas por scroll; framework de renderização componível, partículas GPU (Codrops breakdown) |
| [deepseecommerce.com](https://deepseecommerce.com/) | Three.js | E-commerce 3D: câmera desce pelo iceberg conforme scroll + depth fog; DPR cap, assets comprimidos, render só quando visível (Awwwards Honorable Mention) |
| [Iventions](https://www.awwwards.com/websites/three-js/) | Next.js + Three.js + GSAP | GSAP como sistema de motion com acentos WebGL (Awwwards SOTD) |
| KINESIS ([kinesis.codesempai.com](https://kinesis.codesempai.com/)) | Next.js + R3F + drei + postprocessing | Studio de scroll-driven 3D open-source: drop de .gltf/.glb, câmera com keyframes ligados ao scroll, editor in-browser; "scroll é o playhead, não frames exportados" |
| VANTA Prospector ([github.com/garyhtou/vanta](https://github.com/garyhtou/vanta)) | R3F + Blender | Landing 3D scroll-driven de um rover planetário |
| [weisdevice.xyz](https://www.weisdevice.xyz/) | Three.js | Portfolio 3D |
| [messenger.abeto.co](https://messenger.abeto.co/) | WebGL | Experiência 3D interativa |

## Mapa de técnicas (complexidade real)

| Técnica | O que parece | Dificuldade | Onde brilha |
|---|---|---|---|
| Image displacement | Imagens que derretem/warp no hover ou transição | Média | Portfólios, galerias |
| Particle fields | Pó reativo, pontos que fluem com o cursor | Média | Heros, momentos de marca |
| Scroll-driven 3D | Cena 3D que se move conforme scroll (câmera/objetos) | Alta | Produto, storytelling |

Fonte: análise de dev criativo (membro de júri Awwwards, 11+ anos) em hontran.dev/blog/webgl-website-examples.

## Engenharia invisível que ganha prêmio (checklist de perf)

1. **DPR cap** — `Math.min(devicePixelRatio, 1.5)`; mobile pode ir a 1.
2. **Texturas KTX2/Basis + geometria Draco** — compressão é requisito, não opção.
3. **Render only-when-visible** — pausa o loop fora da viewport.
4. **Reduced motion + fallback** — sem WebGL → imagem 2D estática; `prefers-reduced-motion` → frame congelado.
5. **Lazy init** — canvas nunca bloqueia first paint (LCP verde com WebGL é possível com isso).

## Quando 3D NÃO vale a pena

- Site informativo, blog de conteúdo, funil de conversão enxuto — "forçar WebGL é como pegar um site lento e gimmicky" (hontran.dev).
- 3D só "porque fica legal" gira e distrai — é storytelling, não decoração (scrollytelling.ai).

## Stack recomendada (2026)

- **Three.js** para a maioria dos casos; **R3F** em React/Next.js; **drei** para helpers (controls, gltf, env).
- **@react-three/postprocessing** para bloom/glow.
- Shaders GLSL custom para efeitos pesados (displacement, partículas).
- CSS 3D (`transform-style: preserve-3d`) para efeitos simples de profundidade sem WebGL.
