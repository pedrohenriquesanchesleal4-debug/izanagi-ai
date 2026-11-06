---
name: "image-to-code"
description: "Conversão rigorosa de mockups, screenshots, wireframes e referências visuais em código de interface limpo, semântico, responsivo e testável (HTML/CSS, Tailwind, React, Next.js). Gatilhos de ativação: image to code — reconstrução de interfaces a partir de referências visuais; 1. protocolo de decomposição visual (4 etapas); 2. regras de ouro na geração de código."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Image to Code — Reconstrução de Interfaces a partir de Referências Visuais

> Migrado deterministicamente de `skills/image-to-code/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Conversão rigorosa de mockups, screenshots, wireframes e referências visuais em código de interface limpo, semântico, responsivo e testável (HTML/CSS, Tailwind, React, Next.js).

- **Escopo canônico:** Image to Code — Reconstrução de Interfaces a partir de Referências Visuais
- **Seções do corpo original:** 1. Protocolo de Decomposição Visual (4 Etapas) · 2. Regras de Ouro na Geração de Código
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Zero Stubs / Zero Prosa:

**Zero Stubs / Zero Prosa**: Todo componente deve vir com JSX/HTML completo, classes reais e estados interativos funcionais. Proibido `// Adicione o resto dos itens aqui`.

### Passo 2 — Dados Mock Realistas:

**Dados Mock Realistas**: Se a imagem tem 6 cards com textos e métricas reais, o código deve conter os 6 itens com dados coerentes e verossímeis (nunca `Item 1`, `Item 2`).

### Passo 3 — Responsividade Embutida:

**Responsividade Embutida**: Todo layout reconstruído deve funcionar perfeitamente em mobile (`flex flex-col md:flex-row`, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).

### Passo 4 — Validação Visual com Playwright CLI:

**Validação Visual com Playwright CLI**:

- Rodar a página localmente (`npm run dev`).
   - Disparar `browser.playwright` para tirar screenshot da rota.
   - Comparar o screenshot gerado com a imagem de referência para calibrar padding, tamanho de fonte e alinhamento.

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

# Image to Code — Reconstrução de Interfaces a partir de Referências Visuais

Esta skill estabelece o processo determinístico de engenharia reversa visual: decomposição estrutural de imagens, inferência de hierarquia tipográfica e paleta, geração de código limpo sem stubs e validação por comparação visual via Playwright.

---

## 1. Protocolo de Decomposição Visual (4 Etapas)

### Etapa 1: Análise Macro (Grid, Estrutura e Proporções)
- **Topologia de Página**: Identificar cabeçalho (header/navbar fixo ou estático), zona de conteúdo primário (hero, split 50/50, bento grid assimétrico), barras laterais (sidebar) e rodapé.
- **Limites de Largura**:
  - Container centrado padrão: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
  - Container de leitura/artigo: `max-w-3xl mx-auto`
  - Layout full-width fluido: `w-full` com padding horizontal adaptativo
- **Espaçamento e Densidade**: Medir visualmente o gap entre blocos (ex.: seções separadas por `py-16` a `py-24`, cards internos com `p-6 gap-4`).

### Etapa 2: Extração de Cores e Tokens
- **Fundo Dominante**: Amostrar o background exato (ex.: `#09090b` para dark mode deep, `#0a0a0a` para zinc, `#030712` para gray).
- **Cores de Superfície**: Amostrar elevações (cards com `bg-white/[0.03]`, bordas com `border-white/10`).
- **Acento e Destaque**: Identificar a cor primária de ação (ex.: `#3b82f6`, `#10b981`, `#f59e0b`) e suas variações de hover/active.

### Etapa 3: Tipografia e Iconografia
- **Famílias Tipográficas**:
  - Títulos: Verificar se a fonte é sans geométrica, grotesk, serif elegante ou mono.
  - Pesos: Mapear `font-extrabold` (800) para H1 de impacto, `font-semibold` (600) para subtítulos, `font-medium` (500) para labels/inputs.
- **Ícones**: Mapear para bibliotecas padronizadas (`lucide-react`, `heroicons`, `@tabler/icons-react`), nunca usar caracteres emoji improvisados para ícones de sistema.

### Etapa 4: Componentização Semântica
- Decompor em componentes atômicos reutilizáveis:
  - `Navbar`
  - `HeroSection`
  - `FeatureGrid` / `BentoCard`
  - `PricingCard` / `MetricsBlock`
  - `Footer`

---

## 2. Regras de Ouro na Geração de Código

1. **Zero Stubs / Zero Prosa**: Todo componente deve vir com JSX/HTML completo, classes reais e estados interativos funcionais. Proibido `// Adicione o resto dos itens aqui`.
2. **Dados Mock Realistas**: Se a imagem tem 6 cards com textos e métricas reais, o código deve conter os 6 itens com dados coerentes e verossímeis (nunca `Item 1`, `Item 2`).
3. **Responsividade Embutida**: Todo layout reconstruído deve funcionar perfeitamente em mobile (`flex flex-col md:flex-row`, `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3`).
4. **Validação Visual com Playwright CLI**:
   - Rodar a página localmente (`npm run dev`).
   - Disparar `browser.playwright` para tirar screenshot da rota.
   - Comparar o screenshot gerado com a imagem de referência para calibrar padding, tamanho de fonte e alinhamento.
