# Referências — Repositórios & Fontes de Prompts/Componentes

Curadoria de repositórios GitHub, bancos de prompts e fontes de componentes de alta qualidade para o Discovery usar como vocabulário técnico-visual. URLs canônicas verificadas — **nunca invente URLs além destas**.

## Bancos de Prompts & Workflows de IA

| Recurso | URL | O que extrair |
|---|---|---|
| grill-me (Matt Pocock) | https://github.com/mattpocock/skills (skills/productivity/grill-me) | Entrevista socrática implacável ("grill me") para afiar ideias/designs antes de implementar — base do estilo de entrevista do Discovery |
| Grill-me (engenharia) | https://github.com/TimothyVang/Grill-me | Skills para engenheiros: desafiar planos, arquitetura e código com perguntas duras |
| Humanizer (de-slop) | https://github.com/aihxp/humanizer | Remove marcas de texto gerado por IA (de-slop) — aplicável em copy, prompts ricos e docs para soar humano. Multi-CLI: Claude, Cursor, Codex, OpenCode, Copilot |
| WebsitesPrompts | https://github.com/openwarehq/websiteprompts | 30 prompts prontos de sites cinematográficos (cores, easing, z-index, vídeo de fundo hospedado) — copy-paste para scrollytelling premium |

## Componentes UI & Design Systems (copy-paste / CLI)

| Recurso | URL | O que extrair |
|---|---|---|
| shadcn/ui | https://ui.shadcn.com | Componentes copy-paste acessíveis (Radix + Tailwind) — base do estilo Izanagi |
| 21st.dev | https://21st.dev | Marketplace open-source de componentes shadcn/ui (hero sections, shaders, bento grids, AI chats) — instala via `npx shadcn add "https://21st.dev/r/<autor>/<componente>"` |
| Cult UI | https://www.cult-ui.com | Componentes premium para shadcn/ui (Dynamic Island, Pixel Heading, 3D Carousel) — Motion + Tailwind |
| Skiper UI | https://skiper-ui.com | "Un-common components" para shadcn/ui (106+): Spotlight, Typewriter, Bento Grid — instala via `npx shadcn add @skiper-ui/skiper40` |
| React Bits | https://reactbits.dev | 140+ componentes animados (backgrounds, text effects, animations) — Framer Motion + Tailwind, instala via shadcn/jsrepo |
| OriginKit | https://originkit.dev | Biblioteca grátis de componentes animados (interactive, gallery, text, background) para Framer/React — instala via MCP |
| Uiverse | https://uiverse.io | 4.4k+ elementos UI open-source em CSS/Tailwind — copiar e adaptar |
| Animista | https://animista.net | Gerador on-demand de animações CSS (keyframes prontos por categoria) |
| Phosphor Icons | https://phosphoricons.com | Família de ícones flexível (6 pesos, 2 estilos) — SVG + @phosphor-icons/react |

## Fontes de Inspiração em App Building & 3D

| Recurso | URL | O que extrair |
|---|---|---|
| 10x.app | https://www.10x.app | App builder AI (iOS/macOS SwiftUI) — inspiração de UX de ferramentas de geração de app |
| Three.js | https://threejs.org/examples | Exemplos canônicos 3D/WebGL (ver também references/webgl-3d.md) |

## Como usar no Izanagi

- **Discovery (Fase 3 — pesquisa técnica)**: consultar `references/repos-ai-agents.md` para citar fontes de componentes reais no prompt rico (ex: "hero section no padrão 21st.dev + shaders; componentes de `shadcn add`; texto com easing do WebsitesPrompts").
- **Sempre-verificar**: URLs destes repositórios mudam nome de branch/estrutura — confirme via GitHub antes de citar path específico de arquivo (ex: `skills/productivity/grill-me` existe em `mattpocock/skills`).
- **Anti-colagem**: repositórios são vocabulário, nunca entregar colagem de componente pronto sem adaptar ao design system do projeto (padrão RULES.md anti-genérico).
- **grill-me & Humanizer**: aplicar como método — entrevista dura antes de implementar (Discovery) e revisão de tom em prompts ricos/copy (nunca copiar o prompt inteiro, adaptar ao contexto do projeto).
