---
name: webgl-3d
description: "Cenas 3D no navegador com Three.js/React Three Fiber, shaders GLSL, partículas, GLTF e scroll-driven 3D, com budget de performance. Use quando o pedido envolver 3D, WebGL, shader ou experiência imersiva."
---

# WebGL 3D — Three.js & React Three Fiber

## Identity

Especialista em 3D para o navegador. Constrói cenas WebGL com Three.js (vanilla) ou React Three Fiber (React), integradas ao DOM e ao scroll. Decide com honestidade quando 3D vale a pena: 3D é o produto ou storytelling — nunca enfeite que custa 60fps e bateria.

## Decisão de stack (Decision Tree)

| Contexto | Stack |
|---|---|
| React/Next.js | **React Three Fiber** (`@react-three/fiber` + `@react-three/drei`) |
| Vanilla JS / sem framework | **Three.js** direto |
| Efeito de imagem disforme / particulas | Shaders GLSL custom sobre Three/R3F |
| Modelo pronto (Blender etc.) | GLTF/GLB via `GLTFLoader`/`useGLTF` + compressão **Draco** |
| Apenas um cubo que gira no hero | Não use WebGL — CSS 3D (`transform-style: preserve-3d`) resolve |
| Dispositivos fracos / muito conteúdo | Fallback 2D estático/imagem + `WebGL` detection |
| Precisa de compute shaders / point clouds massivos / física pesada | **WebGPURenderer** (Three.js r171+, zero-config, fallback automático p/ WebGL2) |

## Workflow

1. **Scene design primeiro**: o que é a cena (objeto, câmera, luz, fundo)? Quantas cenas (uma por seção)?
2. **Setup base**: `npm i three` + (`@react-three/fiber @react-three/drei` p/ React). No Vite: `optimizeDeps: { include: ['three'] }`.
3. **Modelos**: exportar GLB + Draco; texturas KTX2/Basis; carregar com suspense e fallback de loading.
4. **Integrar com scroll/DOM**: câmera e objetos reagem a `ScrollTrigger` (scrub) ou a overlays HTML por cima do canvas fixo.
5. **Performance budget** (obrigatório): DPR cap, render só quando visível, desligar sombras pesadas no mobile.
6. **Fallback + reduced motion**: imagem estática ou cena simplificada.

## Padrões Core

### Canvas fixo + conteúdo HTML por cima (scroll-driven 3D)
```tsx
<div className="fixed inset-0 z-0">      {/* canvas 3D atrás */}
  <Canvas camera={{ position: [0, 0, 8], fov: 45 }}>
    <Scene />
  </Canvas>
</div>
<main className="relative z-10 pointer-events-none">… conteúdo scrolleável …</main>
```
- Câmera move com scroll: `useFrame((state) => (state.camera.position.y = scrollProgress * 10))`.
- Ou `useGSAP` + `ScrollTrigger` mexendo em refs do grupo/câmera.

### Loop de animação (R3F)
```tsx
function RotatingGroup() {
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => { ref.current.rotation.y += delta * 0.5; });
  return <group ref={ref}>…</group>;
}
```
- **Regra de ouro R3F**: mutações por frame (posição, rotação, uniforms) sempre em `useFrame`/refs — **nunca** em `useState`. `setState` a 60fps re-renderiza a árvore React inteira e mata o frame rate.

### WebGPU (quando o caso pedir)
- Three.js r171+ troca `WebGLRenderer` → `WebGPURenderer` em uma linha, com fallback automático para WebGL2 se o navegador não suportar (baseline cross-browser desde 2025: Chrome, Edge, Firefox, Safari/iOS).
- Ganhos reais (10x–100x) aparecem em compute shaders, simulação de física e point clouds/Gaussian splatting — não em cenas simples de produto/portfólio, onde WebGL2 continua suficiente e mais testado.
- R3F ainda não tem suporte de primeira classe ao pipeline WebGPU (TSL/node materials) em todos os cenários — valide a versão de `@react-three/fiber` antes de migrar um projeto em produção.
- Regra prática: comece projetos novos que dependem de compute-heavy em WebGPU; não migre uma cena WebGL2 estável só "porque existe".

### Modelo GLTF + Draco (R3F)
```tsx
import { useGLTF } from '@react-three/drei';
function Model({ url }) {
  const { scene } = useGLTF(url, true);   // true = draco
  return <primitive object={scene} scale={2} />;
}
```

### Partículas
- Points com `PointsMaterial` (tamanho atenuado) ou shader custom para >10k partículas.
- Animar posições em `useFrame` com buffer attributes — nunca recriar a geometria.

### Post-processing (bloom/glow)
- `@react-three/postprocessing` (`<EffectComposer><Bloom/></EffectComposer>`) ou `three/examples/jsm/postprocessing`.
- Bloom barato + bem calibrado > luzes caras.

## Rules (Performance)

- **DPR cap**: `dpr={[1, 1.5]}` (R3F) ou `renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5))`.
- **Budget de geometria**: ≤ 500k triângulos no total da cena para compatibilidade ampla (mid-range incluso); acima disso, **LOD é obrigatório**, não opcional.
- **LOD (Level of Detail)**: `<Detailed distances={[0, 50, 100]}>` (drei) trocando entre versões alta/média/baixa poli conforme distância da câmera — ganhos medidos de 30-40% em FPS em cenas grandes.
- **Draw calls**: mesclar geometrias estáticas (instancing/`BufferGeometryUtils.mergeGeometries` ou `InstancedMesh` para repetições) reduz draw calls, especialmente em cenas com muitos objetos não-interativos.
- **Frustum culling**: confiar no culling automático do Three.js, mas evitar geometrias gigantes que nunca saem do frustum (bounding volumes grandes demais escondem culling).
- **Renderização condicional**: pausar `useFrame` quando a seção está fora da viewport (`IntersectionObserver`/`ScrollTrigger` `toggleActions`).
- **Geometria/textura**: Draco + KTX2/Basis; texturas ≤ 2048²; `texture.colorSpace = SRGBColorSpace`; atlas de texturas para reduzir trocas de material.
- **Sombras**: sombras suaves só em 1-2 luzes; mobile desliga.
- **`prefers-reduced-motion`**: pausa loop, mostra frame estático.
- **Sem WebGL**: `WebGL.isWebGLAvailable()` check → fallback.
- **Memory**: `dispose()` geometrias/texturas em unmount; `useGLTF.preload()` fora do componente.
- Nunca bloquear LCP: canvas lazy (`React.lazy`/dynamic import) e placeholder estático.

## Checklists

- [ ] Decisão de stack justificada (3D vale a pena aqui?)
- [ ] Canvas lazy + fallback estático
- [ ] DPR cap aplicado
- [ ] Modelos comprimidos (Draco/KTX2)
- [ ] Render pausado fora da viewport
- [ ] Reduced motion + sem-WebGL tratados
- [ ] Scroll-driven integrado (câmera/objetos ↔ scroll)
- [ ] 60fps confirmado em mid-range Android (DevTools/Perf)
- [ ] Dispose de recursos no unmount

## References

Veja `references.md` nesta pasta — portfólios e projetos 3D premiados (Bruno Simon, The Monolith, DeepSee Commerce, KINESIS) e o mapa de técnicas (image displacement, particle fields, scroll-driven 3D).

Fontes técnicas (2026): [Three.js docs](https://threejs.org/docs/) e [Three.js WebGPURenderer migration notes](https://www.utsubo.com/blog/webgpu-threejs-migration-guide) (r171+, fallback automático); [100 Three.js performance tips](https://www.utsubo.com/blog/threejs-best-practices-100-tips) (budget de triângulos, LOD, draw calls); [React Three Fiber docs](https://github.com/pmndrs/react-three-fiber) (mutações em `useFrame`, não em state); [Soft8Soft — Optimizing WebGL performance](https://www.soft8soft.com/docs/manual/en/introduction/Optimizing-WebGL-performance.html) (merging de geometrias, texture atlas).

## Metrics & Evolution

- FPS alvo 60 (mid-range); INP < 200ms; LCP < 2.5s.
- Registrar no reflection log: técnica 3D usada, tamanho do bundle, dispositivos testados.

> Gerado pelo Izanagi AI — cópia fiel de `skills/webgl-3d/SKILL.md` (fonte da verdade).
