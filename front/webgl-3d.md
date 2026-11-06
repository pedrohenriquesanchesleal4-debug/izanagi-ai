---
name: webgl-3d
description: "Cenas 3D interativas no navegador com Three.js e React Three Fiber (R3F): modelos GLTF com Draco, shaders GLSL, orçamento de performance GPU e scroll-driven 3D."
triggers:
  - "integrar canvas 3D interativo ou hero 3D no Next.js/React"
  - "otimizar performance de renderização WebGL e controle de taxa de quadros"
  - "carregar modelos GLTF compactados com Draco e shaders customizados"
stack: [threejs, react-three-fiber, drei, webgl, glsl]
---

# WebGL 3D — Three.js & React Three Fiber (R3F)

Esta skill estabelece os padrões para implementação de gráficos tridimensionais no navegador. 3D deve servir à narrativa do produto com rigoroso orçamento de performance, garantindo 60fps estáveis sem esgotar a bateria do usuário.

---

## 1. Regra de Ouro do React Three Fiber (R3F)

> **NUNCA use `useState` para mutações contínuas a 60fps.** Atualizar um estado React a cada quadro re-renderiza toda a árvore de componentes DOM e destrói a performance. Atualizações de posição, rotação e uniforms devem ser feitas exclusivamente dentro de `useFrame` utilizando referências diretas (`ref.current`).

```tsx
// ✅ CORRETO: Mutação direta via ref no loop de renderização nativo
function RotatingMesh() {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#3b82f6" />
    </mesh>
  );
}
```

---

## 2. Arquitetura de Cena (Canvas Fixo + HTML por Cima)

O padrão mais elegante para landing pages cinematográficas consiste em manter o canvas 3D fixado ao fundo enquanto o conteúdo textual scrola livremente:

```tsx
import { Canvas } from '@react-three/fiber';
import { Suspense } from 'react';
import { ModelScene } from './ModelScene';

export function Hero3D() {
  return (
    <div className="relative min-h-[200vh] bg-zinc-950">
      {/* Canvas 3D Fixo ao Fundo */}
      <div className="fixed inset-0 z-0">
        <Canvas
          camera={{ position: [0, 0, 5], fov: 45 }}
          dpr={[1, 2]} // Limita DPR a no máximo 2 para evitar explosão de pixels em telas 4K
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={1.5} />
          <Suspense fallback={null}>
            <ModelScene />
          </Suspense>
        </Canvas>
      </div>

      {/* Conteúdo HTML Sobreposto com pointer-events-none nas áreas vazias */}
      <main className="relative z-10 pointer-events-none">
        <section className="h-screen flex items-center justify-center p-8">
          <h1 className="text-7xl font-bold tracking-tight text-white pointer-events-auto">
            Design Dimensional.
          </h1>
        </section>
        <section className="h-screen flex items-center justify-start p-16">
          <div className="max-w-md bg-zinc-900/80 backdrop-blur-md p-8 rounded-2xl border border-white/10 pointer-events-auto">
            <h2 className="text-2xl font-bold text-zinc-100">Engenharia Precisa</h2>
            <p className="mt-2 text-zinc-400">Rotacione ou explore os detalhes da cena.</p>
          </div>
        </section>
      </main>
    </div>
  );
}
```

---

## 3. Otimização de Modelos GLTF com Compressão Draco

Nunca carregue arquivos `.obj` ou `.gltf` brutos não otimizados no cliente. Utilize `.glb` comprimido via Draco:

```tsx
'use client';

import { useGLTF } from '@react-three/drei';

export function ProductModel() {
  // O segundo parâmetro `true` ativa o decodificador Draco automaticamente
  const { scene } = useGLTF('/models/product.glb', true);

  return (
    <primitive
      object={scene}
      scale={1.8}
      position={[0, -1, 0]}
    />
  );
}

// Pré-carregamento para eliminar atrasos visuais (streaming antecipado)
useGLTF.preload('/models/product.glb', true);
```

---

## 4. Orçamento de Performance & Degradação Graciosa

1. **Limite de Taxa de Pixel (DPR)**:
   - Telas de smartphones de alta densidade (DPR 3x ou 4x) demandam até 16x mais processamento gráfico. Sempre trave o DPR: `dpr={[1, 2]}`.
2. **Desligar Sombras Dinâmicas Pesadas**:
   - Sombras projetadas (`castShadow` / `receiveShadow`) exigem render pass duplo. Use sombras estáticas pré-bakeadas (*ambient occlusion maps* ou *contact shadows*) sempre que possível.
3. **Detecção de WebGL & Fallback 2D**:
   - Sempre forneça uma imagem estática ou vídeo em loop leve caso o navegador do usuário bloqueie WebGL por drivers desatualizados ou economia extrema de bateria.

---

## 5. Checklist de WebGL 3D

- [ ] Todas as animações e updates contínuos ocorrem dentro de `useFrame` via refs, sem `useState`.
- [ ] O canvas tem limite rigoroso de DPR configurado (`dpr={[1, 2]}`).
- [ ] Modelos 3D estão no formato `.glb` com compressão Draco ativada.
- [ ] O contêiner HTML sobreposto utiliza `pointer-events-none` na raiz para não bloquear a interação do mouse com o canvas 3D.
- [ ] Existe um fallback gracioso (imagem ou ilustração) caso WebGL não esteja disponível.
