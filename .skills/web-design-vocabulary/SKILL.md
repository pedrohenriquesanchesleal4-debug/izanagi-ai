---
name: "web-design-vocabulary"
description: "Vocabulário de webdesign que vira código: nomes de efeitos de scroll, padrões de seção, arquétipos de hero e de onde puxar componentes prontos (21st.dev, React Bits, shadcn). Traduz pedido vago ('quero que o texto apareça enquanto desce') no termo certo e na implementação certa. Use ao interpretar pedido de site/landing, ao descrever uma direção visual ou ao escolher efeito de scroll. Gatilhos de ativação: web design vocabulary: do nome do efeito ao código; quando usar; efeitos de scroll; padrões de seção e estado."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Web Design Vocabulary: do nome do efeito ao código

> Migrado deterministicamente de `skills/web-design-vocabulary/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Vocabulário de webdesign que vira código: nomes de efeitos de scroll, padrões de seção, arquétipos de hero e de onde puxar componentes prontos (21st.dev, React Bits, shadcn). Traduz pedido vago ('quero que o texto apareça enquanto desce') no termo certo e na implementação certa.
- **Ativar quando:** Use ao interpretar pedido de site/landing, ao descrever uma direção visual ou ao escolher efeito de scroll.
- **Escopo canônico:** Web Design Vocabulary: do nome do efeito ao código
- **Seções do corpo original:** Quando usar · Efeitos de scroll · Padrões de seção e estado · Arquétipos de hero (escolha um antes de codar) · Onde puxar componentes prontos
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Título centralizado sobre imagem cheia:

**Título centralizado sobre imagem cheia**: impacto, marcas com fotografia forte.

### Passo 2 — Imagem cheia com texto no canto inferior:

**Imagem cheia com texto no canto inferior**: editorial, moda, arquitetura.

### Passo 3 — Texto em cima, imagem grande embaixo:

**Texto em cima, imagem grande embaixo**: produto digital mostrando a interface.

### Passo 4 — Faixa de imagens (carrossel horizontal) com título curto:

**Faixa de imagens (carrossel horizontal) com título curto**: portfólio, catálogo.

### Passo 5 — Split assimétrico (texto 5 colunas / mídia 7):

**Split assimétrico (texto 5 colunas / mídia 7)**: SaaS, serviços.

### Passo 6 — Tipografia gigante sem imagem:

**Tipografia gigante sem imagem**: estúdios, manifestos.

### Passo 7 — Produto 3D/vídeo como herói com título lateral:

**Produto 3D/vídeo como herói com título lateral**: lançamento de produto físico.

### Passo 8 — Grid de cards já na primeira dobra:

**Grid de cards já na primeira dobra**: marketplaces, dashboards públicos.

Descreva o arquétipo escolhido em uma linha na direção visual: `Hero: arquétipo 2, foto do ateliê, título no canto inferior esquerdo`.

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
