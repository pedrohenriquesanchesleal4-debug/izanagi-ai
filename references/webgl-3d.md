# Referências — WebGL & 3D na Web

Curadoria técnica para projetos com 3D, WebGL, Three.js e shaders. Todas as URLs são canônicas e verificáveis. **Nunca invente URLs além destas — confirme na web antes de citar no prompt rico.**

## Base oficial

| Recurso | URL | O que extrair |
|---|---|---|
| Three.js — site oficial | https://threejs.org | Docs, exemplos, editor, learning path oficial |
| Three.js — exemplos | https://threejs.org/examples | Dezenas de demos reais: `webgl_animation_keyframes` (animação por keyframes), `webgl_materials_pbr` (materiais PBR), `webgl_loader_gltf` (carregar modelo GLTF), `webgl_shaders_ocean` (shader de oceano), `webgl_points_waves`/`webgl_points_sprites` (partículas/points), `webgl_postprocessing_unreal_bloom` (post-processing) |
| Three.js — editor visual | https://threejs.org/editor | Montar cenas no browser e exportar GLTF/JSON |
| Three.js — docs | https://threejs.org/docs | API completa (Scene, Camera, Mesh, GLTFLoader, ShaderMaterial) |
| Repo oficial | https://github.com/mrdoob/three.js | Código-fonte dos exemplos em `examples/` — referência de implementação real |

## Modelos gratuitos (GLTF/GLB)

| Recurso | URL | O que extrair |
|---|---|---|
| Sketchfab | https://sketchfab.com | Modelos gratuitos (filtro de busca: `features=downloadable&type=models`); licenças CC |
| Poly Pizza | https://poly.pizza | Modelos low-poly gratuitos, ótimos para estilização |
| Market (pmndrs) | https://market.pmnd.rs | Modelos curados para React Three Fiber/drei, download direto |
| Visualizador GLTF | https://gltf-viewer.donmccurdy.com | Validar/inspecionar qualquer GLTF antes de usar no projeto |

## React Three Fiber (ecossistema)

| Recurso | URL | O que extrair |
|---|---|---|
| React Three Fiber | https://github.com/pmndrs/react-three-fiber | Componentes React para Three.js; exemplos no repo e em drei |
| Drei | https://github.com/pmndrs/drei | Helpers prontos: `ScrollControls`, `Environment`, `Float`, `Text3D`, `GLTF` — docs em https://drei.pmnd.rs |
| Postprocessing | https://github.com/pmndrs/postprocessing | Bloom, depth-of-field, vignette, noise — pós-efeitos cinematográficos |

## Shaders

| Recurso | URL | O que extrair |
|---|---|---|
| Shadertoy | https://shadertoy.com | Milhares de shaders GLSL (fragment/vertex) prontos para estudar e portar |
| The Book of Shaders | https://thebookofshaders.com | Aprender GLSL do zero (noções, easing, noise, shaders de cor) |

## Como usar no Izanagi

- **Quando consultar**: Discovery deve abrir esta curadoria sempre que o usuário pedir 3D/WebGL (nível de animação "3D" na Fase 3) ou quando a Trilha Técnica precisar de exemplos de implementação.
- **Como citar no prompt rico**: cite URLs específicas na seção "Referências — trilha técnica", com o porquê (ex: "usar `webgl_animation_keyframes` como base para a animação do herói" ou "carregar modelo GLTF de poly.pizza via `useGLTF` do drei").
- **Para o senior-engineer/animation**: serve de roteiro de implementação — o agente de animação deve abrir os exemplos do three.js antes de codar a cena.
- **Regra de ouro**: só citar uma demo/modelo depois de verificar que a URL existe (webfetch); preferir os exemplos canônicos do threejs.org/examples.
