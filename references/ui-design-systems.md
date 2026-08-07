# Referências — UI, Design Systems & Estilo Premium

Curadoria para direção de arte e design systems de alto craft (dark premium, glassmorphism, bento grids, tipografia). URLs canônicas — **nunca invente URLs além destas**.

## Design systems & componentes

| Recurso | URL | O que extrair |
|---|---|---|
| Tailwind CSS docs | https://tailwindcss.com/docs | Design tokens (cores, espaçamento, tipografia) e utilitários — base do estilo Izanagi |
| shadcn/ui | https://ui.shadcn.com | Componentes copy-paste acessíveis (Radix + Tailwind) — botões, cards, dialogs, toasts |
| Radix UI | https://www.radix-ui.com | Primitivos acessíveis e sem estilo (base do shadcn/ui) |
| Aceternity UI | https://ui.aceternity.com | Componentes premium copy-paste: bento grids, glassmorphism, sparkles, efeitos de luz |
| Lucide | https://lucide.dev | Ícones consistentes e leves (SVG) — padrão para qualquer projeto |
| Motion | https://motion.dev | Animações de UI (entrada, layout, gestos) em React |
| 21st.dev | https://21st.dev | Marketplace open-source de componentes shadcn/ui (heroes, shaders, bento grids, AI chats) |
| Cult UI | https://www.cult-ui.com | Componentes premium para shadcn/ui (Dynamic Island, Pixel Heading, 3D Carousel) |
| Skiper UI | https://skiper-ui.com | "Un-common components" shadcn/ui (106+): Spotlight, Typewriter, Bento Grid |
| React Bits | https://reactbits.dev | 140+ componentes animados (backgrounds, text effects, animations) |
| OriginKit | https://originkit.dev | Componentes animados grátis (interactive, gallery, text, background) — Framer/React |
| Uiverse | https://uiverse.io | 4.4k+ elementos UI open-source em CSS/Tailwind |
| Animista | https://animista.net | Gerador de animações CSS on-demand (keyframes prontos) |
| Phosphor Icons | https://phosphoricons.com | Ícones flexíveis (6 pesos) — SVG + @phosphor-icons/react |

## Fontes & paletas

| Recurso | URL | O que extrair |
|---|---|---|
| Google Fonts | https://fonts.google.com | Famílias canônicas (Inter, Geist, Space Grotesk...) — escolher display + body com contraste |
| Coolors | https://coolors.co | Gerador de paletas e paletas prontas por mood |
| Realtime Colors | https://www.realtimecolors.com | Paleta dark/light em tempo real, testada numa UI de exemplo |

## Guias de linguagem visual

| Recurso | URL | O que extrair |
|---|---|---|
| Apple Human Interface Guidelines | https://developer.apple.com/design/human-interface-guidelines/ | Clareza, profundidade, hierarquia, dark mode premium |
| Material Design 3 | https://m3.material.io | Sistema de cor dinâmica, estados e elevação |
| Design Systems (Figma) | https://www.designsystems.com | Referência de como documentar tokens e componentes |

## Como usar no Izanagi

- **Quando consultar**: Discovery deve abrir esta curadoria na Fase 3 (P12 — preferências visuais) para propor direção de arte; e sempre antes do passo "Direção criativa" (2-3 caminhos com trade-offs).
- **Como citar no prompt rico**: na seção "Mood & Direção de Arte" e "Referências — trilha visual", com URLs e o porquê (ex: "dark premium estilo shadcn/ui + aceternity bento grid; tipografia Inter + Space Grotesk do Google Fonts").
- **Padrão Izanagi (RULES.md)**: anti-genérico, high-craft — `bg-zinc-950`, glassmorphism, bento grids, micro-interações. Estas referências são o vocabulário para isso, nunca colagem.
- **Para o senior-engineer/frontend**: consultar a skill `frontend` (tokens existentes) e `ui-ux-pro-max` antes de criar novos tokens; usar shadcn/ui como base de componentes.
