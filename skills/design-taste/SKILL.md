---
name: design-taste
description: "Direção de design de alto nível e estética anti-genérica. Use ao projetar ou implementar interfaces para definir tipografia expressiva, paleta intencional, ritmo visual, espaçamento refinado e eliminar padrões repetitivos de IA."
version: 2.0.0
category: frontend
triggers:
  - "criar nova interface ou landing page"
  - "definir direção visual e design tokens"
  - "revisar design para remover cara de IA"
  - "aplicar hierarquia tipográfica e ritmo visual"
capabilities:
  - "design-taste"
  - "visual-direction"
  - "anti-ai-slop"
  - "typography"
  - "design-tokens"
dependencies: []
token_budget: 1000
risk: low
compatibility: ">=2.0.0"
---

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
