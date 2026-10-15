---
name: image-to-code
version: 2.0.0
description: Conversão rigorosa de mockups, screenshots, wireframes e referências visuais em código de interface limpo, semântico, responsivo e testável (HTML/CSS, Tailwind, React, Next.js).
category: frontend
risk: low
token_budget: 1500
stacks: [react, nextjs, html, css, vue, tailwind]
tools:
  mcp: []
capabilities:
  - visual-decomposition
  - screenshot-to-code
  - layout-reconstruction
  - typography-extraction
  - pixel-perfection
triggers:
  - converter screenshot ou imagem em código
  - replicar interface a partir de imagem ou mockup
  - clonar visual de site existente a partir de captura
  - reconstruir componente a partir de design visual
---

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
