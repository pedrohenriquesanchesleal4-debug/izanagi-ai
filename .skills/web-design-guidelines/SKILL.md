---
name: web-design-guidelines
version: 2.0.0
description: Diretrizes essenciais de web design e interface de usuário moderna (Vercel Web Design Guidelines e Awesome Design) com foco em tipografia intencional, ritmo visual, espaçamento de 4px/8px, acessibilidade WCAG 2.2 AA e eliminação de AI-slop.
category: frontend
risk: low
token_budget: 1200
stacks: [all, react, nextjs, html, css, vue]
tools:
  mcp: []
capabilities:
  - design-systems
  - typography-pairing
  - responsive-layouts
  - accessibility-wcag
  - micro-interactions
triggers:
  - projetar ou estilizar páginas e componentes web
  - definir tokens de design, cores, tipografia e espaçamento
  - revisar design para garantir acessibilidade e hierarquia visual
  - eliminar estética genérica de IA (gradientes roxos sem propósito, hero-cards repetitivos)
---

# Web Design Guidelines — Interfaces Modernas & Anti-Generic

Esta skill condensa as melhores práticas de design de produto e engenharia de interface (inspiradas no Vercel Web Design Guidelines, Dieter Rams e sistemas de alta densidade). O objetivo é garantir que nenhuma interface pareça um template genérico gerado por IA.

---

## 1. Princípios Fundamentais

### 1.1 Escala Espacial e Ritmo (Grid de 4px / 8px)
- **Base 4px/8px**: Todos os `paddings`, `margins`, `gaps` e dimensões de componentes devem ser múltiplos de 4px ou 8px (ex.: 4px, 8px, 12px, 16px, 24px, 32px, 48px, 64px, 96px).
- **Consistência de Densidade**:
  - *Alta Densidade (Dashboards, DevTools, FinTech)*: paddings compactos (8px a 12px), fontes de 12px a 14px, lineHeight de 1.4.
  - *Média Densidade (SaaS Marketing, Portais)*: paddings generosos (16px a 24px), fontes de 14px a 16px, lineHeight de 1.6.
- **Hierarquia de Contêineres**: Contêineres pais devem ter padding significativamente maior que os espaçamentos internos dos filhos (ex.: Card com `p-6`, elementos internos com `gap-3`).

### 1.2 Tipografia com Intenção & Escala Modular
- **Font Pairing Intencional**:
  - Evitar o padrão genérico cego (Inter puro em tudo).
  - Use contrastes expressivos: Display serif ou grotesk com personalidade para títulos (`Plus Jakarta Sans`, `Cabinet Grotesk`, `Instrument Serif`, `Clash Display`, `Satoshi`) pareado com corpo neutro e legível (`Inter`, `Geist`, `Geist Mono`).
- **Escala Tipográfica Proporcional**:
  - Display / H1: 2.5rem a 4rem (font-bold, tracking-tight, lineHeight 1.1)
  - H2: 1.75rem a 2.25rem (font-semibold, tracking-tight, lineHeight 1.2)
  - H3: 1.25rem a 1.5rem (font-medium, lineHeight 1.3)
  - Body: 0.875rem a 1rem (font-normal, lineHeight 1.6)
  - Caption / Label: 0.75rem (font-medium, uppercase, tracking-wider, text-muted)
- **Comprimento de Linha (Measure)**: Máximo de 65 a 75 caracteres por linha em blocos de texto (`max-w-prose` ou `max-w-2xl`).

### 1.3 Cores, Contraste e Superfícies
- **Regra 60-30-10**:
  - 60% Cor Dominante de Fundo (ex.: `zinc-950` ou `slate-50`).
  - 30% Superfícies e Estruturas (cards, bordas sutis `border-white/10`, separadores).
  - 10% Cor de Acento Focal (usada estritamente em CTAs primários e status ativos).
- **Eliminação de AI-Slop**:
  - Proibido gradiente genérico roxo/azul (`from-purple-500 to-indigo-500`) em botões e fundos sem justificativa de branding.
  - Substituir por iluminação intencional: luzes radiais sutis (*radial spotlight*), bordas com gradiente de 1px reflexivo (*border gradient overlay*), ou fundos foscos acetinados.

---

## 2. Estados de Componentes Interativos

Todo elemento interativo (botão, input, link, tab) deve ter 6 estados claramente definidos:
1. **Default**: Visual equilibrado, contraste WCAG 2.2 AA (mínimo 4.5:1 para texto normal, 3:1 para componentes).
2. **Hover**: Feedback tátil imediato (mudança de luminosidade de 5-10%, transição suave de 150ms `cubic-bezier(0.16, 1, 0.3, 1)`).
3. **Active (Pressed)**: Leve compressão de escala (`scale-[0.98]` ou `translate-y-0.5`).
4. **Focus-Visible**: Anel de foco nítido e acessível para teclado (`ring-2 ring-offset-2 ring-accent`), nunca removido com `outline: none` sem substituto.
5. **Loading**: Indicador de progresso inline sem alterar a largura do botão (*layout shift zero*).
6. **Disabled**: Opacidade reduzida (`opacity-50`), `cursor-not-allowed` e eventos desativados (`pointer-events-none`).

---

## 3. Workflow de Implementação de Telas

1. **Definição de Layout & Grid**: Escolher entre layout editorial assimétrico, bento grid modular ou split-screen.
2. **Construção de Tokens**: Configurar CSS Variables ou Tailwind config com tokens semânticos (`--bg-canvas`, `--surface-elevated`, `--text-primary`, `--border-subtle`).
3. **Composição Visual**:
   - Criar profundidade com camadas sobrepostas (*z-index layering*).
   - Utilizar divisores com máscaras de fade (`mask-image: linear-gradient(...)`).
4. **Auditoria de Acessibilidade & Responsividade**:
   - Testar em 320px (mobile pequeno), 768px (tablet), 1280px (laptop) e 1920px (ultrawide).
   - Validar contraste com leitor de tela e navegação por Tab.
