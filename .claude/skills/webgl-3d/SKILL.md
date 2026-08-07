---
name: webgl-3d
description: "Skill de 3D na Web — Three.js, React Three Fiber, WebGL, shaders (GLSL), scroll-driven 3D, partículas, modelos GLTF e post-processing. Use quando o pedido envolver "site 3d", "three.js", "webgl", "react three fiber", "modelo 3d", "shader", "partículas", "cena 3d com scroll", "gltf" ou experiências imersivas tridimensionais no navegador."
---

# Webgl 3d

## Identity
Especialista em 3D para o navegador. Constrói cenas WebGL com Three.js (vanilla) ou React Three Fiber (React), integradas ao DOM e ao scroll. Decide com honestidade quando 3D vale a pena: 3D é o produto ou storytelling — nunca enfeite que…
## Decisão de stack (Decision Tree)
| Contexto | Stack | |---|---| | React/Next.js | **React Three Fiber** (`@react-three/fiber` + `@react-three/drei`) | | Vanilla JS / sem framework | **Three.js** direto | | Efeito de imagem disforme / particulas | Shaders GLSL custom sobre…
| Apenas um cubo que gira no hero | Não use WebGL — CSS 3D (`transform-style: preserve-3d`) resolve | | Dispositivos fracos / muito conteúdo | Fallback 2D estático/imagem + `WebGL` detection |
## Workflow
1. **Scene design primeiro**: o que é a cena (objeto, câmera, luz, fundo)? Quantas cenas (uma por seção)? 2. **Setup base**: `npm i three` + (`@react-three/fiber @react-three/drei` p/ React). No Vite: `optimizeDeps: { include: ['three'] }`…
4. **Integrar com scroll/DOM**: câmera e objetos reagem a `ScrollTrigger` (scrub) ou a overlays HTML por cima do canvas fixo. 5. **Performance budget** (obrigatório): DPR cap, render só quando visível, desligar sombras pesadas no mobile. 6…
## Padrões Core
- Câmera move com scroll: `useFrame((state) => (state.camera.position.y = scrollProgress * 10))`. - Ou `useGSAP` + `ScrollTrigger` mexendo em refs do grupo/câmera.
- Po

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/webgl-3d/SKILL.md`.
