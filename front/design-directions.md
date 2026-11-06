---
name: design-directions
description: "Metodologia para criação de 3 a 5 direções de design distintas e bespoke por nicho (paleta com hex exatos, pareamento tipográfico, layout signature e motion) antes da codificação visual."
triggers:
  - "iniciar novo site, landing page, dashboard ou identidade de produto"
  - "apresentar opções de direção visual antes de codificar"
  - "escolher identidade estética personalizada de acordo com o nicho de mercado"
stack: [art-direction, design-systems, typography, color-palettes]
---

# Design Directions — Seletor de Estilos & Direção de Arte Bespoke

Antes de escrever qualquer linha de código visual, o design deve ser ancorado em uma direção de arte intencional. Esta skill fornece os arquétipos estéticos e o protocolo de seleção para criar interfaces com personalidade única.

---

## 1. Protocolo das Direções de Design (Hard Gate)

1. **Diagnóstico do Nicho**:
   - Identifique a indústria (FinTech, DevTools, Saúde, Moda, Educação, Imobiliário, SaaS B2B, etc.).
   - Defina o sentimento desejado: *Técnico e Seguro*, *Editorial e Sofisticado*, *Ousado e Energético*, ou *Calmo e Minimalista*.
2. **Geração das 3 a 5 Opções Bespoke**:
   - Para cada direção, defina:
     - **Conceito & Metáfora**: A ideia visual condutora.
     - **Paleta Exata (Hexadecimal)**: Base, Superfície, Texto, Borda e 1 Acento Afiado.
     - **Pareamento Tipográfico**: Display (Títulos) + Sans/Mono (Corpo).
     - **Layout Signature**: A estrutura geométrica predominante da interface.
     - **Motion Signature**: A cadência e comportamento das animações.
3. **Validação ou Escolha**: Selecione a direção antes de iniciar a construção dos componentes.

---

## 2. Os 5 Grandes Arquétipos Visuais

### Arquétipo 1: Quantum Terminal (DevTools, IA, Infraestrutura, Segurança)
- **Metáfora**: Console de comando de alta precisão, cockpit de desenvolvedor.
- **Paleta**:
  - Base: `#09090b` (Dark OLED)
  - Superfície: `#121215` / `#18181b`
  - Bordas: `#27272a`
  - Texto: `#f4f4f5` (Primário) e `#a1a1aa` (Secundário)
  - Acento: `#10b981` (Emerald elétrico) ou `#06b6d4` (Cyan analítico)
- **Tipografia**: `JetBrains Mono` / `Geist Mono` (Display & Badges) + `Geist Sans` (Corpo).
- **Layout Signature**: Bento grids com métricas em tempo real, delimitadores finos de 1px, badges monospaçados, command palette `Cmd+K`.
- **Motion**: Micro-interações rápidas (120-180ms), feedback instantâneo de teclado, sem transições lentas.

### Arquétipo 2: Editorial Paper (Luxo, Cultura, Conteúdo, Consultoria Estratégica)
- **Metáfora**: Revista impressa de prestígio, design suíço contemporâneo.
- **Paleta**:
  - Base: `#fbfbfa` (Off-white papel quente)
  - Superfície: `#f4f4f0`
  - Bordas: `#e7e7e2`
  - Texto: `#18181b` (Preto profundo) e `#71717a` (Cinza editorial)
  - Acento: `#991b1b` (Bordeaux profundo) ou `#1e3a5f` (Azul marinho clássico)
- **Tipografia**: `Instrument Serif` ou `Fraunces` (Títulos monumentais 80-140px) + `General Sans` (Corpo fluido).
- **Layout Signature**: Grid de 12 colunas com elementos sangrando na margem (*bleed*), pull-quotes em 2 colunas, grandes vazios com respiro generoso.
- **Motion**: Revelação suave por máscara (*mask-reveal*), rolagem fluida e transições de página contemplativas (400-600ms).

### Arquétipo 3: FinTech Precision (Bancos, Finanças, Pagamentos, Analytics)
- **Metáfora**: Sala de operações financeiras de alta fidelidade e clareza analítica.
- **Paleta**:
  - Base: `#ffffff` (Clean) ou `#0f172a` (Slate Pro)
  - Superfície: `#f8fafc` / `#1e293b`
  - Bordas: `#e2e8f0` / `#334155`
  - Texto: `#0f172a` e `#64748b`
  - Acento: `#0284c7` (Azul confiança) ou `#059669` (Verde liquidez)
- **Tipografia**: `Space Grotesk` (Títulos técnicos) + `Inter Tight` (com `tabular-nums` ativo em todos os dados).
- **Layout Signature**: Tabelas de dados de alta densidade, cartões de KPI com micro-sparklines, barras de filtros contextuais com debounce.
- **Motion**: Interpolação de valores numéricos via `@number-flow/react`, transições de abas instantâneas.

### Arquétipo 4: Neo-Industrial / Brutalist Minimal (Moda Streetwear, Web3, Agências)
- **Metáfora**: Arquitetura brutalista, sinalização industrial, precisão funcional crua.
- **Paleta**:
  - Base: `#000000` (Preto absoluto)
  - Superfície: `#111111`
  - Bordas: `#333333` (linhas grossas de 2px a 3px)
  - Texto: `#ffffff`
  - Acento: `#eab308` (Amarelo industrial) ou `#f97316` (Laranja sinalização)
- **Tipografia**: `Syne` ou `Clash Display` (Display agressivo) + `Archivo` (Corpo condensado).
- **Layout Signature**: Grid ortogonal visível, tipografia em caixa-alta estendida, cantos retos (`rounded-none`), separadores geométricos rígidos.
- **Motion**: Transições secas com easing escalonado (stagger rígido de 40ms).

---

## 3. Checklist de Validação da Direção Escolhida

- [ ] A direção estética reflete a credibilidade e expectativas do nicho.
- [ ] A paleta possui contraste formal verificado (WCAG AA).
- [ ] A fonte escolhida possui pesos adequados (Regular, Medium, Bold) e suporte completo a acentuação.
- [ ] As decisões de layout (cantos retos vs arredondados, densidade de dados) foram unificadas em todo o projeto.
