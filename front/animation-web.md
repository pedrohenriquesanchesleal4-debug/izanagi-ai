---
name: animation-web
description: "Scrollytelling cinematográfico, sequências de imagens em canvas estilo Apple, seções fixadas (pinned sections), rolagem suave com Lenis e timelines controladas por GSAP ScrollTrigger."
triggers:
  - "criar landing page cinematográfica com narrativa conduzida pelo scroll"
  - "implementar sequência de frames em canvas 60fps (efeito Apple product page)"
  - "configurar Lenis smooth scroll e seções com pinned scrub no GSAP"
stack: [gsap, scroll-trigger, lenis, canvas, react]
---

# Animation Web — Scrollytelling & Experiências Cinematográficas

Esta skill orienta a construção de sites onde a rolagem da página atua como o *playhead* de um vídeo interativo. Cada movimento do cursor ou dedo comanda câmeras, frames e transições de cena sem perda de fluidez.

---

## 1. Princípios de Engenharia de Scrollytelling

1. **Scroll = Linha do Tempo (Timeline Scrub)**:
   - O progresso do scroll comanda diretamente a animação (`scrub: 1` ou `scrub: true`).
   - **Regra de Ouro**: Em tudo que for atrelado ao scrub de scroll, use obrigatoriamente `ease: 'none'`. Easing curvado em scrub cria sensação de atraso pegajoso e desconexão entre a mão do usuário e o movimento da tela.
2. **Aceleração Exclusiva por GPU**:
   - Anime exclusivamente `transform` (`xPercent`, `yPercent`, `scale`, `rotation`) e `opacity`.
   - NUNCA anime `top`, `left`, `width`, `height` ou `margin` durante a rolagem (provoca *layout thrashing* e derruba a taxa de quadros).
3. **Gerenciamento de Ciclo de Vida**:
   - Em aplicações React/Next.js, utilize `@gsap/react` (`useGSAP`) ou limpe os gatilhos no desmontar do componente com `ScrollTrigger.kill()` para prevenir memory leaks.

---

## 2. Integração do Lenis Smooth Scroll com GSAP

A combinação de Lenis com GSAP garante sincronia perfeita entre a inércia da rolagem e os gatilhos visuais:

```tsx
'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: 'vertical',
      smoothWheel: true,
    });

    // Sincroniza Lenis com o ticker do GSAP
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);

    return () => {
      lenis.destroy();
      gsap.ticker.remove(lenis.raf);
    };
  }, []);

  return <>{children}</>;
}
```

---

## 3. Padrão Apple: Sequência de Imagens em Canvas no Scroll

Reproduz a experiência de desmonte/rotação de produtos enquanto a página rola:

```tsx
'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const TOTAL_FRAMES = 120;

export function CanvasImageSequence() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Configuração HiDPI para telas Retina
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;

    // Cache de imagens pré-carregadas
    const images: HTMLImageElement[] = [];
    const frameState = { currentFrame: 0 };

    for (let i = 0; i < TOTAL_FRAMES; i++) {
      const img = new Image();
      img.src = `/sequence/frame_${String(i).padStart(4, '0')}.webp`;
      images.push(img);
    }

    const render = () => {
      const img = images[Math.floor(frameState.currentFrame)];
      if (img && img.complete) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
    };

    // Timeline do GSAP vinculada ao scroll da seção
    const trigger = ScrollTrigger.create({
      trigger: containerRef.current,
      start: 'top top',
      end: '+=3000',
      pin: true,
      scrub: 0.5,
      onUpdate: (self) => {
        frameState.currentFrame = self.progress * (TOTAL_FRAMES - 1);
        render();
      },
    });

    return () => trigger.kill();
  }, []);

  return (
    <div ref={containerRef} className="relative h-screen w-full bg-black overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full object-cover" />
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <h2 className="text-6xl font-bold tracking-tight text-white/90">
          Precisão Milimétrica.
        </h2>
      </div>
    </div>
  );
}
```

---

## 4. Seção com Rolagem Horizontal Pinned

Transforma a rolagem vertical do mouse em deslocamento horizontal suave de painéis:

```tsx
'use client';

import { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function HorizontalPanels() {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    const ctx = gsap.context(() => {
      gsap.to(track, {
        xPercent: -100 * (4 - 1), // 4 painéis
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          pin: true,
          scrub: 1,
          snap: 1 / 3,
          end: () => `+=${track.offsetWidth}`,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={containerRef} className="relative h-screen overflow-hidden bg-zinc-950">
      <div ref={trackRef} className="flex h-full w-[400vw]">
        {[1, 2, 3, 4].map((panel) => (
          <div key={panel} className="w-screen h-full flex items-center justify-center p-12 border-r border-zinc-800">
            <span className="text-8xl font-mono font-bold text-zinc-700">0{panel}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
```

---

## 5. Checklist de Scrollytelling

- [ ] Todas as animações atreladas ao scrub utilizam `ease: 'none'`.
- [ ] O canvas trata densidade de tela com `devicePixelRatio` com teto de 2 para poupar memória.
- [ ] Lenis e GSAP estão sincronizados via `gsap.ticker`.
- [ ] Os gatilhos de `ScrollTrigger` são devidamente destruídos (`kill()` / `ctx.revert()`) no ciclo de unmount.
- [ ] Elementos pesados de pinning são simplificados para fluxo normal em telas mobile via `ScrollTrigger.matchMedia()`.
