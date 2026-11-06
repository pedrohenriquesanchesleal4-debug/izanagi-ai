---
name: "web-design-guidelines"
description: "Diretrizes essenciais de web design e interface de usuário moderna (Vercel Web Design Guidelines e Awesome Design) com foco em tipografia intencional, ritmo visual, espaçamento de 4px/8px, acessibilidade WCAG 2.2 AA e eliminação de AI-slop. Gatilhos de ativação: web design guidelines — interfaces modernas & anti-generic; 1. princípios fundamentais; 2. estados de componentes interativos; 3. workflow de implementação de telas."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Web Design Guidelines — Interfaces Modernas & Anti-Generic

> Migrado deterministicamente de `skills/web-design-guidelines/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Diretrizes essenciais de web design e interface de usuário moderna (Vercel Web Design Guidelines e Awesome Design) com foco em tipografia intencional, ritmo visual, espaçamento de 4px/8px, acessibilidade WCAG 2.2 AA e eliminação de AI-slop.

- **Escopo canônico:** Web Design Guidelines — Interfaces Modernas & Anti-Generic
- **Seções do corpo original:** 1. Princípios Fundamentais · 2. Estados de Componentes Interativos · 3. Workflow de Implementação de Telas
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Definição de Layout & Grid:

**Definição de Layout & Grid**: Escolher entre layout editorial assimétrico, bento grid modular ou split-screen.

### Passo 2 — Construção de Tokens:

**Construção de Tokens**: Configurar CSS Variables ou Tailwind config com tokens semânticos (`--bg-canvas`, `--surface-elevated`, `--text-primary`, `--border-subtle`).

### Passo 3 — Composição Visual:

**Composição Visual**:

- Criar profundidade com camadas sobrepostas (*z-index layering*).
   - Utilizar divisores com máscaras de fade (`mask-image: linear-gradient(...)`).

### Passo 4 — Auditoria de Acessibilidade & Responsividade:

**Auditoria de Acessibilidade & Responsividade**:

- Testar em 320px (mobile pequeno), 768px (tablet), 1280px (laptop) e 1920px (ultrawide).
   - Validar contraste com leitor de tela e navegação por Tab.

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
