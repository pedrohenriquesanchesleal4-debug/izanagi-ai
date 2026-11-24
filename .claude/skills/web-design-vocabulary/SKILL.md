---
name: web-design-vocabulary
description: "Vocabulário de webdesign que vira código. Use ao interpretar pedido de site/landing, ao descrever uma direção visual ou ao…"
---

# Web Design Vocabulary: do nome do efeito ao código

Quem não sabe o nome do efeito pede "deixa mais bonito" e recebe o template de sempre. Esta skill dá nome às coisas e liga cada nome a uma implementação.

## Quando usar

Ao receber pedido de site, landing ou seção com descrição vaga, e ao escrever a direção visual antes de codar. Combine com `design-directions` (escolher a direção) e `anti-ai-slop` (auditar o resultado).

## Efeitos de scroll

| Termo | O que é | Implementação |
|---|---|---|
| **Scroll-trigger** | algo dispara ao entrar na tela (uma vez) | `IntersectionObserver` ou GSAP `ScrollTrigger` com `once: true` |
| **Scroll-linked** | a animação acompanha a posição do scroll (avança e volta) | CSS `animation-timeline: view()`/`scroll()`; GSAP `scrub: true` |
| **Parallax** | camadas se movem em velocidades diferentes | `translateY` ligado ao scroll; poucas camadas, nunca no texto |
| **Sticky / pinned** | um bloco fica preso enquanto o conteúdo ao lado rola | `position: sticky`; GSAP `pin: true` para sequências |
| **Horizontal scroll** | rolar para baixo move a página para o lado | seção pinada + `translateX` com `scrub` |
| **Text reveal** | palavras ou linhas se revelam com o scroll | split por palavra + opacidade scroll-linked |
| **Smooth scroll** | rolagem com inércia | Lenis (respeitar `prefers-reduced-motion`) |

Regra: no máximo 2 tipos de efeito por página. Todo efeito tem fallback estático com `prefers-reduced-motion: reduce`.

## Padrões de seção e estado

- **Hero section**: primeira dobra; diz o que é, para quem e o próximo passo.
- **Bento grid**: cards de tamanhos diferentes num grid; bom para 4 a 7 features com peso desigual.
- **Marquee**: faixa contínua de logos ou frases.
- **Testimonial cards**: só com depoimento real, nome e contexto verificáveis.
- **Hover state / focus state / active state**: todo elemento interativo tem os três, transição de 120 a 180ms.
- **Glassmorphism**: superfície translúcida com blur. Use pontualmente sobre fundo com conteúdo, nunca como estilo da página inteira.

## Arquétipos de hero (escolha um antes de codar)

1. **Título centralizado sobre imagem cheia**: impacto, marcas com fotografia forte.
2. **Imagem cheia com texto no canto inferior**: editorial, moda, arquitetura.
3. **Texto em cima, imagem grande embaixo**: produto digital mostrando a interface.
4. **Faixa de imagens (carrossel horizontal) com título curto**: portfólio, catálogo.
5. **Split assimétrico (texto 5 colunas / mídia 7)**: SaaS, serviços.
6. **Tipografia gigante sem imagem**: estúdios, manifestos.
7. **Produto 3D/vídeo como herói com título lateral**: lançamento de produto físico.
8. **Grid de cards já na primeira dobra**: marketplaces, dashboards públicos.

Descreva o arquétipo escolhido em uma linha na direção visual: `Hero: arquétipo 2, foto do ateliê, título no canto inferior esquerdo`.

## Onde puxar componentes prontos

| Fonte | Bom para | Cuidado |
|---|---|---|
| 21st.dev | centenas de componentes animados com prompt pronto para colar no agente | adaptar aos tokens da marca |
| React Bits | animações de texto, fundos, botões | um efeito chamativo por tela |
| shadcn/ui | base acessível de formulários, diálogos, menus | personalizar raio, cor e tipografia |

Regra: componente pronto entra **adaptado** (cores, fontes, espaçamento e raio do projeto). Colar cru é a forma mais rápida de parecer template.

> Gerado pelo Izanagi AI: cópia fiel de `skills/web-design-vocabulary/SKILL.md` (fonte da verdade).
