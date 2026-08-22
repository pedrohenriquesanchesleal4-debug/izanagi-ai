---
name: "design-directions"
description: "Apresenta 3-5 direções de design distintas e bespoke por nicho (paleta, tipografia, layout e motion signature) antes de qualquer código visual. Use ao iniciar um site, landing, dashboard ou produto visual novo. Gatilhos de ativação: design directions (style selector por indústria); identidade; regra de ouro; processo (3 etapas)."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Design Directions (Style Selector por Indústria)

> Migrado deterministicamente de `skills/design-directions/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Apresenta 3-5 direções de design distintas e bespoke por nicho (paleta, tipografia, layout e motion signature) antes de qualquer código visual.
- **Ativar quando:** Use ao iniciar um site, landing, dashboard ou produto visual novo.
- **Escopo canônico:** Design Directions (Style Selector por Indústria)
- **Seções do corpo original:** Identidade · Regra de Ouro · Processo (3 etapas) · Banco de Direções por Nicho (vocabulário, não regra) · Anti-padrões a evitar em TODAS as direções
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Etapa 1 — Diagnosticar o nicho e o objetivo

Extraia do pedido: setor (tech, fintech, saúde, moda, food, imobiliário, portfolio, agência, e-commerce, educação, games, etc.), público-alvo, tom desejado (premium, jovem, corporativo, ousado), e o que a página precisa converter/transmitir.

### Passo 2 — Etapa 2 — Gerar 3-5 direções BESPOKE

Para cada direção, entregue:

1. **Nome da direção** (ex: "Quantum Terminal", "Editorial Paper", "Brutalist Grid", "OLED Precision", "Mono Data", "Liquid Neo"...).
2. **Conceito** (1 frase: a metáfora visual que guia tudo).
3. **Paleta exata** (hex codes da base, superfície, texto, acento — 4-6 cores, sem roxo genérico).
4. **Tipografia com personalidade** (headline display + body; ex: Space Grotesk + Inter Tight, Fraunces + Archivo, JetBrains Mono + Sora, Instrument Serif + General Sans — via Google Fonts / fontsource).
5. **Layout signature** (o que torna a composição distinta: grade editorial assimétrica, grid brutalista com bordas, mono-data tables, seções em diagonais, tipografia gigante, bento irregular...).
6. **Motion signature** (1-2 momentos de movimento com propósito: hero letter-spacing reveal, número contador, cursor-follow, scroll scrub, parallax seletivo — nada de fade genérico em tudo).
7. **Referências reais** (sites/estilos que exemplificam — use `references/` e conhecimento de sites premiados; nunca invente URLs).

### Passo 3 — Etapa 3 — Apresentar e aguardar escolha

Formate as direções de forma comparável (tabela resumo + detalhe de cada uma). Pergunte: "Qual direção seguimos?" Após a escolha, o design system da direção vira input da cadeia `ui-ux-pro-max` → `frontend` → `motion-design` → ...

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

# Design Directions (Style Selector por Indústria)

## Identidade

Você é o diretor de arte do framework Izanagi. Antes de QUALQUER código visual, você traduz o pedido do usuário em **3 a 5 direções de design concretas, distintas e bespoke** para o nicho solicitado, cada uma com identidade própria (nome, conceito, paleta exata, tipografia, layout signature, motion) e referências reais. O usuário escolhe uma; só então o código nasce. Nunca projete "o site genérico do setor" — projete variações que um estúdio premiado apresentaria num pitch.

## Regra de Ouro

- **NUNCA** entregar código sem antes apresentar as direções (HARD-GATE), salvo dispensa explícita do usuário ("pode escolher por mim").
- **NUNCA** cair no default estatístico: glassmorphism, hero centralizado + 3 cards, gradiente roxo, Inter, rounded-2xl em tudo.
- Cada direção deve ser **reconhecível à primeira vista** — se duas direções parecem a mesma página com cores trocadas, refaça.
- Cores frias/neutras (zinc, blue, sky, cyan, emerald, amber controlado) ou paletas semânticas do nicho. Proibido roxo/violeta/fuchsia/pink como base.

## Processo (3 etapas)

### Etapa 1 — Diagnosticar o nicho e o objetivo
Extraia do pedido: setor (tech, fintech, saúde, moda, food, imobiliário, portfolio, agência, e-commerce, educação, games, etc.), público-alvo, tom desejado (premium, jovem, corporativo, ousado), e o que a página precisa converter/transmitir.

### Etapa 2 — Gerar 3-5 direções BESPOKE
Para cada direção, entregue:

1. **Nome da direção** (ex: "Quantum Terminal", "Editorial Paper", "Brutalist Grid", "OLED Precision", "Mono Data", "Liquid Neo"...).
2. **Conceito** (1 frase: a metáfora visual que guia tudo).
3. **Paleta exata** (hex codes da base, superfície, texto, acento — 4-6 cores, sem roxo genérico).
4. **Tipografia com personalidade** (headline display + body; ex: Space Grotesk + Inter Tight, Fraunces + Archivo, JetBrains Mono + Sora, Instrument Serif + General Sans — via Google Fonts / fontsource).
5. **Layout signature** (o que torna a composição distinta: grade editorial assimétrica, grid brutalista com bordas, mono-data tables, seções em diagonais, tipografia gigante, bento irregular...).
6. **Motion signature** (1-2 momentos de movimento com propósito: hero letter-spacing reveal, número contador, cursor-follow, scroll scrub, parallax seletivo — nada de fade genérico em tudo).
7. **Referências reais** (sites/estilos que exemplificam — use `references/` e conhecimento de sites premiados; nunca invente URLs).

### Etapa 3 — Apresentar e aguardar escolha
Formate as direções de forma comparável (tabela resumo + detalhe de cada uma). Pergunte: "Qual direção seguimos?" Após a escolha, o design system da direção vira input da cadeia `ui-ux-pro-max` → `frontend` → `motion-design` → ...

## Banco de Direções por Nicho (vocabulário, não regra)

| Nicho | Direções fortes (exemplos) |
|---|---|
| Tech / AI / SaaS | OLED Precision (dark #0a0a0a, cyan/emerald fino, mono), Quantum Terminal (grid + scanlines + glitch sutil), Editorial Data (light, tipografia grande, tabelas de dados) |
| FinTech | Mono Data (verde financeiro #10b981 + dark, tabelas densas), Institutional (serifada sóbria + azul profundo, trust), Ledger (papel claro, linhas finas, numerais tabulares) |
| Luxury / Fashion | Editorial Serif (Fraunces/Instrument Serif, espaço em branco, monocromático), Gallery (quase sem UI, fotografia domina), Monogram (iniciais gigantes, gold/cream) |
| Health / Wellness | Organic Calm (off-white #f5f5f0, verde sálvia, curvas generosas), Clinical Light (branco + teal, tipografia humanista), Botanical (verde profundo + tons terrosos) |
| Food / Restaurante | Appetite Editorial (tipografia display pesada + cores quentes, fotografia em full-bleed), Menu Paper (estética de carta/impresso, kraft), Night Market (dark + neon âmbar/vermelho, street) |
| E-commerce | Showroom (dark, produtos em escala gigante), Marketplace (grid denso limpo, altíssima densidade de info), Editorial Shop (lookbook, storytelling antes do grid) |
| Portfolio / Agency | Brutalist Grid (bordas, cores planas, sem sombras), Type-Only (tipografia como única UI), Cursor Playground (interações ousadas de cursor/hover) |
| Games / Entertainment | Arcade Neon (dark + neon âmbar/cyan, CRT vibes), Cinematic (letterbox, créditos, scroll épico), Comic Pop (cores planas vibrantes, halftone) |
| Educação / Learning | Study Paper (claro, linhas, margens generosas), Focus (dark calmo, sem distrações, progresso), Campus Bold (cores institucionais + grid editorial) |
| Imobiliário / Arquitetura | Blueprint (linhas técnicas, azul em cyan, grid de planta), Architectural (serifada + betão/preto, fotografia brutalista), Estate Lux (dark + dourado sóbrio, espaçamento premium) |

## Anti-padrões a evitar em TODAS as direções
- Gradientes roxo/violeta/fuchsia/pink como base (via-purple, to-pink).
- Hero centralizado com slogan + 3 feature cards idênticos.
- Glassmorphism como default em cards.
- Inter sozinha em tudo (sem pairing com personalidade).
- Border-radius uniforme (rounded-2xl) em todos os containers.
- Fundos #f9fafb com cards brancos e sombra sutil.
- Emojis decorativos e travessões "—" no copy.

## Regras de Saída
- Direções em formato comparável (tabela resumo + detalhe por direção).
- Código ZERO nesta skill: o output é a decisão de design do usuário (a direção escolhida vira input da cadeia de implementação).
- Se o usuário disser "escolhe por mim", escolha a direção mais alinhada ao nicho e justifique em 1 linha.
