---
name: "remotion-video"
description: "Criação de vídeos programáticos, animações baseadas em código e motion design renderizável em React com Remotion (Compositions, Sequences, useCurrentFrame, springs, áudio sincronizado e renderização MP4/WebM). Gatilhos de ativação: remotion video — vídeo programático & motion graphics em react; 1. conceitos fundamentais do remotion; 2. estrutura canônica de um projeto remotion; 3. composição de cenas e áudio."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Remotion Video — Vídeo Programático & Motion Graphics em React

> Migrado deterministicamente de `skills/remotion-video/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Criação de vídeos programáticos, animações baseadas em código e motion design renderizável em React com Remotion (Compositions, Sequences, useCurrentFrame, springs, áudio sincronizado e renderização MP4/WebM).

- **Escopo canônico:** Remotion Video — Vídeo Programático & Motion Graphics em React
- **Seções do corpo original:** 1. Conceitos Fundamentais do Remotion · 2. Estrutura Canônica de um Projeto Remotion · 3. Composição de Cenas e Áudio · 4. Pipeline de Renderização Determinística
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Root.tsx:

**`Root.tsx`**: Ponto de entrada onde todas as composições (`<Composition />`) e sequências estáticas são registradas com resolução, duração e FPS definidos.

### Passo 2 — Composition:

**`Composition`**:

- `id`: Identificador estável (ex.: `ExplainerVideo`, `SocialPromo`).
   - `component`: Componente React que renderiza a cena.
   - `durationInFrames`: Total de frames da timeline.
   - `fps`: Taxa de quadros (geralmente 30 ou 60).
   - `width` e `height`: Resoluções padrão (1920x1080 para landscape 16:9, 1080x1920 para vertical 9:16, 1080x1080 para square 1:1).
   - `defaultProps`: Propriedades configuráveis dinamicamente em tempo de renderização.

```tsx
import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SaaSDemo"
      component={MainVideo}
      durationInFrames={300} // 10 segundos a 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "Izanagi AI Engine",
        subtitle: "Autonomous Agent Orchestration",
      }}
    />
  );
};
```

---

## Verification Steps

<!-- fonte da verificação: fallback-honesto:design -->

- Comparar o artefato com a direção de design acordada (paleta, tipografia, layout, motion) item a item.
- Executar auditoria anti-AI-slop: zero tells da lista de Red Flags presentes.
- Verificar estados interativos (hover/focus/error/loading) e contraste WCAG AA nos componentes tocados.
- Registrar screenshots/evidência do estado final para revisão.

## Common Rationalizations

- **"Design system a gente monta depois do launch."**
  - Verdade: Sem tokens decididos antes, cada componente nasce com escala própria e o 'depois' vira reescrita total. Direção de design primeiro é HARD-GATE do framework, não preferência.
- **"Inter serve, é neutra."**
  - Verdade: Inter default é o tell nº 1 de 'cara de IA'. Tipografia é decisão de identidade; neutra aqui significa sem intenção — e sem intenção é proibido.
- **"Responsivo eu ajusto no final, primeiro o desktop."**
  - Verdade: Layout pensado só em desktop quebra estruturalmente no mobile: grid, hierarquia e touch targets não se 'ajustam', se redesenham. Mobile-first é mais barato desde a primeira linha.
- **"Acessibilidade a gente adiciona quando tiver demanda."**
  - Verdade: Contraste, foco visível e ARIA são requisitos WCAG, não feature request. Retrofitar acessibilidade custa ordens de magnitude mais que nascer com ela.
- **"O cliente pediu hero com 3 cards, é isso que ele conhece."**
  - Verdade: O cliente pediu resultado, não template estatístico. Cabe ao craft traduzir o pedido em composição com identidade — hero+3cards+gradiente roxo é anti-padrão explícito do framework.
- **"Animação entra no fim, se sobrar tempo."**
  - Verdade: Motion signature decide-se no design, não decorase no deploy. Animação adicionada tarde é ornamento; planejada cedo é comunicação de hierarquia e estado.

## Red Flags

- Hero centralizado + fileira de 3 cards idênticos (composição estatística de IA).
- Gradiente roxo-azul como identidade visual principal.
- border-radius uniforme em todos os elementos, sem hierarquia formal.
- Contraste abaixo de WCAG AA em texto primário.
- Sem estados hover/focus/loading/error definidos nos componentes interativos.
- Tipografia default sem escolha declarada (peso, escala, par de fontes).
- Motion decorativo aleatório em vez de 1–2 momentos-chave com assinatura.

## Legacy Reference (v1)

# Remotion Video — Vídeo Programático & Motion Graphics em React

Esta skill orienta a criação de composições de vídeo programáticas utilizando **Remotion**. Vídeos são tratados como funções de tempo (`frame -> React tree`), permitindo renderização determinística, parametrização dinâmica de conteúdo e exportação com aceleração de hardware.

> **Aviso de Licenciamento (Remotion License):**
> O Remotion é gratuito para indivíduos e empresas com receita bruta anual inferior a US$ 10.000. Para uso corporativo comercial acima desse limite, uma licença comercial oficial do Remotion é exigida. Sempre verifique o enquadramento do projeto antes da implantação em produção.

---

## 1. Conceitos Fundamentais do Remotion

### 1.1 O Modelo Mental: Frame como Timeline
- No Remotion, tudo é derivado de `frame` (número inteiro de 0 a `durationInFrames - 1`).
- A taxa padrão recomendada é **30 fps** para web/social media e **60 fps** para animações ultra-fluidas.
- Duração em segundos = `durationInFrames / fps`.

```tsx
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

export const AnimatedCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Animação com física de mola (Spring)
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, mass: 0.5, stiffness: 100 },
  });

  // Interpolação linear controlada
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <div style={{ opacity, transform: `scale(${scale})` }}>
      <h1>Título em Movimento</h1>
    </div>
  );
};
```

---

## 2. Estrutura Canônica de um Projeto Remotion

1. **`Root.tsx`**: Ponto de entrada onde todas as composições (`<Composition />`) e sequências estáticas são registradas com resolução, duração e FPS definidos.
2. **`Composition`**:
   - `id`: Identificador estável (ex.: `ExplainerVideo`, `SocialPromo`).
   - `component`: Componente React que renderiza a cena.
   - `durationInFrames`: Total de frames da timeline.
   - `fps`: Taxa de quadros (geralmente 30 ou 60).
   - `width` e `height`: Resoluções padrão (1920x1080 para landscape 16:9, 1080x1920 para vertical 9:16, 1080x1080 para square 1:1).
   - `defaultProps`: Propriedades configuráveis dinamicamente em tempo de renderização.

```tsx
import { Composition } from 'remotion';
import { MainVideo } from './MainVideo';

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SaaSDemo"
      component={MainVideo}
      durationInFrames={300} // 10 segundos a 30fps
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{
        title: "Izanagi AI Engine",
        subtitle: "Autonomous Agent Orchestration",
      }}
    />
  );
};
```

---

## 3. Composição de Cenas e Áudio

- **`<Sequence from={startFrame} durationInFrames={length}>`**: Isola componentes no tempo. Dentro da Sequence, `useCurrentFrame()` é relativo ao início daquela cena (começa em 0).
- **`<Audio src={staticFile("audio.mp3")} />`**: Reprodução de trilha sonora ou narração com volume animável (`volume={(f) => interpolate(f, [0, 15], [0, 1])}`).
- **`<Series>`**: Encadeia clipes em sequência automática sem necessidade de calcular offsets manuais para cada corte.

---

## 4. Pipeline de Renderização Determinística

- **Pré-visualização Interativa**:
  ```bash
  npx remotion preview
  ```
- **Renderização Headless em MP4**:
  ```bash
  npx remotion render src/index.ts SaaSDemo out/video.mp4 --props='{"title":"Nova Feature"}'
  ```
- **Otimização de Render**:
  - Evite carregar recursos remotos não cacheados durante o loop de frames; pré-carregue fontes e imagens estáticas via `staticFile()` ou `delayRender()`.
