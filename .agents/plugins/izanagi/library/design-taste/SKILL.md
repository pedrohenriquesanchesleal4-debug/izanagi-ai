---
name: "design-taste"
description: "Direção de design de alto nível e estética anti-genérica. Use ao projetar ou implementar interfaces para definir tipografia expressiva, paleta intencional, ritmo visual, espaçamento refinado e eliminar padrões repetitivos de IA. Gatilhos de ativação: design taste & anti-generic frontend engine; triggering criteria; princípios de alto craft; verification steps."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Design Taste & Anti-Generic Frontend Engine

> Migrado deterministicamente de `skills/design-taste/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Direção de design de alto nível e estética anti-genérica.
- **Ativar quando:** Use ao projetar ou implementar interfaces para definir tipografia expressiva, paleta intencional, ritmo visual, espaçamento refinado e eliminar padrões repetitivos de IA.
- **Escopo canônico:** Design Taste & Anti-Generic Frontend Engine
- **Seções do corpo original:** Triggering Criteria · Princípios de Alto Craft · Verification Steps
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Tipografia com Voz Própria:

**Tipografia com Voz Própria:**

- Evitar fontes de sistema ou Inter como escolha impensada.
   - Usar contraste deliberado de escala (ex: Display grande + mono/sans balanceada).
   - Manter tracking e leading ajustados para leitura fluida.

### Passo 2 — Cores Intencionais:

**Cores Intencionais:**

- Paleta restrita: 1 cor dominante + 1 acento afiado + tons neutros calculados (HSL equilibrado).
   - Nada de gradientes arbitrários no hero sem fundamentação da marca.

### Passo 3 — Ritmo, Densidade e Espaçamento:

**Ritmo, Densidade e Espaçamento:**

- Quebrar o grid repetitivo com assimetrias elegantes (layouts editoriais, bento grids conscientes).
   - Hierarquia clara entre o foco principal e os elementos de suporte.

### Passo 4 — Microinterações Sutis:

**Microinterações Sutis:**

- Hover states suaves, transições de 150-250ms com curvas cubic-bezier naturais.
   - Respeitar a preferência de movimento reduzido (`prefers-reduced-motion`).

## Verification Steps

<!-- fonte da verificação: quality-section-original -->

- A página possui personalidade reconhecível sem templates óbvios.
- Cores de texto cumprem os índices de contraste WCAG AA (mínimo 4.5:1).
- O layout permanece impecável em resoluções mobile (375px) e desktop (1440px+).

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

# Design Taste & Anti-Generic Frontend Engine

> Inspirado em Taste-Skill e Web Design Guidelines: transforma interfaces frias e genéricas em produtos com identidade visual marcante, proporção elegante e personalidade bespoke para cada nicho.

## Triggering Criteria
- Início de implementação de qualquer tela, componente ou página pública.
- Auditoria de frontend para erradicar o padrão repetitivo "AI-Slop" (cards idênticos, fundo cinza sem vida, gradientes roxos padronizados).

## Princípios de Alto Craft
1. **Tipografia com Voz Própria:**
   - Evitar fontes de sistema ou Inter como escolha impensada.
   - Usar contraste deliberado de escala (ex: Display grande + mono/sans balanceada).
   - Manter tracking e leading ajustados para leitura fluida.

2. **Cores Intencionais:**
   - Paleta restrita: 1 cor dominante + 1 acento afiado + tons neutros calculados (HSL equilibrado).
   - Nada de gradientes arbitrários no hero sem fundamentação da marca.

3. **Ritmo, Densidade e Espaçamento:**
   - Quebrar o grid repetitivo com assimetrias elegantes (layouts editoriais, bento grids conscientes).
   - Hierarquia clara entre o foco principal e os elementos de suporte.

4. **Microinterações Sutis:**
   - Hover states suaves, transições de 150-250ms com curvas cubic-bezier naturais.
   - Respeitar a preferência de movimento reduzido (`prefers-reduced-motion`).

## Verification Steps
- A página possui personalidade reconhecível sem templates óbvios.
- Cores de texto cumprem os índices de contraste WCAG AA (mínimo 4.5:1).
- O layout permanece impecável em resoluções mobile (375px) e desktop (1440px+).
