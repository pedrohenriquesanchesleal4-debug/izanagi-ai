---
name: remotion-video
description: "Criação de vídeos programáticos, animações e motion graphics em React com Remotion: Composition, Sequence, interpolação por frame e exportação determinística em MP4."
triggers:
  - "criar vídeo programático, animação de produto ou motion graphics com React"
  - "gerar composições de vídeo dinâmicas sincronizadas com áudio"
  - "renderizar animações de UI em MP4/WebM via código"
stack: [remotion, react, typescript, node]
---

# Remotion Video — Motion Graphics & Vídeo Programático em React

Esta skill orienta a criação de composições visuais onde o vídeo é tratado como uma função puramente determinística de tempo: `f(frame) -> React Tree`.

---

## 1. O Modelo Mental do Remotion

- **Frame como Linha do Tempo**: Tudo é derivado de `frame` (inteiro de `0` até `durationInFrames - 1`).
- **Taxas de Quadros (FPS)**: Padrão recomendado de **30 fps** para exportações de mídias sociais e **60 fps** para animações ultra-fluidas de UI.
- **Duração em Segundos**: `durationInFrames = segundos * fps`.

---

## 2. Estrutura de uma Composição Remotion

### 2.1 Registro da Composição (`Root.tsx`)
```tsx
import { Composition } from 'remotion';
import { PromoVideo } from './PromoVideo';

export const RemotionRoot = () => {
  return (
    <Composition
      id="PromoVideo"
      component={PromoVideo}
      durationInFrames={150} // 5 segundos a 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: 'NexusAI v3',
        subtitle: 'Engenharia de Software Autônoma',
      }}
    />
  );
};
```

### 2.2 Componente de Vídeo com Interpolação e Física Spring
```tsx
import {
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Sequence,
} from 'remotion';

export const PromoVideo = ({ title, subtitle }: { title: string; subtitle: string }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animação de escala com física de mola (Spring)
  const scale = spring({
    frame,
    fps,
    config: {
      damping: 12,
      stiffness: 100,
      mass: 0.8,
    },
  });

  // Interpolação linear suave de opacidade
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div className="flex-1 bg-zinc-950 flex flex-col items-center justify-center w-full h-full text-white font-sans">
      <Sequence from={0} durationInFrames={90}>
        <div style={{ transform: `scale(${scale})`, opacity }} className="text-center">
          <h1 className="text-8xl font-bold tracking-tight text-white mb-4">
            {title}
          </h1>
          <p className="text-3xl text-zinc-400 font-mono tracking-wide">
            {subtitle}
          </p>
        </div>
      </Sequence>

      <Sequence from={60}>
        {/* Segunda cena entrando aos 2 segundos */}
        <div className="absolute bottom-24 text-sm font-mono text-emerald-400">
          STATUS: COMPILADO COM SUCESSO
        </div>
      </Sequence>
    </div>
  );
};
```

---

## 3. Checklist de Remotion

- [ ] A duração do vídeo e a taxa de quadros estão sincronizadas com precisão matemática (`durationInFrames = s * fps`).
- [ ] Animações utilizam `spring()` ou `interpolate()` com `extrapolateRight: 'clamp'` para evitar overflow.
- [ ] Múltiplas cenas utilizam `<Sequence>` para isolar o tempo de entrada e saída.
- [ ] Assets estáticos (imagens, áudio, fontes) são importados através da função `staticFile()`.
