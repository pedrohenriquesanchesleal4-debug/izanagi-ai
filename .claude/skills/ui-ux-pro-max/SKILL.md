---
name: ui-ux-pro-max
description: "Motor de busca local (BM25) com estilos, paletas, tipografia, guidelines de UX e presets por stack para decisões de design. Use ao projetar páginas, componentes, cores, tipografia ou revisar UI."
---

# UI/UX Pro Max — Design Intelligence

Banco de dados pesquisável de regras de UI/UX com recomendação por prioridade: 84 estilos, 192 paletas, 74 pares de fonte, 192 tipos de produto com regras de raciocínio, 98 diretrizes UX, 104 ícones, 16 presets GSAP e 25 tipos de chart em 22 stacks. **Todo o banco é local (CSVs) — zero chamadas de rede, zero telemetria, dados do projeto nunca saem da máquina.**

## Quando usar

Use quando a tarefa envolver **estrutura de UI, decisões visuais, padrões de interação ou controle de qualidade de UX**: criar páginas novas, criar/refatorar componentes UI, escolher cor/tipografia/espaçamento/layout, revisar UI (UX, acessibilidade, consistência), implementar navegação/animação/responsividade.

**Pule** para backend puro, API/banco, performance não-visual, infra/DevOps ou scripts não-visuais — a menos que a tarefa mude como algo **parece, sente, se move ou é interagido**.

## Categorias de regras por prioridade

*Siga a prioridade 1→10 para decidir qual categoria focar primeiro; use `--domain <Domain>` para consultar detalhes. O texto completo de regras vive em `references/quick-reference.md` — leia sob demanda, não carregue sempre.*

| Prio | Categoria | Impacto | Domain | Checks (deve ter) | Anti-padrões (evite) |
|------|-----------|---------|--------|-------------------|----------------------|
| 1 | Acessibilidade | CRÍTICO | `ux` | Contraste 4.5:1 (texto normal AA) / 3:1 (texto grande e componentes de UI/gráficos, WCAG 2.2) / 7:1 (AAA texto normal), Alt text, Navegação por teclado, Aria-labels | Remover focus rings, Ícone-only sem label |
| 2 | Touch & Interação | CRÍTICO | `ux` | Alvo ≥44×44px, espaçamento 8px+, feedback de loading | Depender só de hover, mudanças instantâneas (0ms) |
| 3 | Performance | ALTO | `ux` | WebP/AVIF, Lazy loading, reservar espaço (CLS < 0.1) | Layout thrashing, Cumulative Layout Shift |
| 4 | Seleção de estilo | ALTO | `style`, `product` | Combinar com tipo de produto, consistência, ícones SVG (sem emoji) | Misturar flat & skeuomorphic, emoji como ícone |
| 5 | Layout & Responsivo | ALTO | `ux` | Mobile-first breakpoints, Viewport meta, sem scroll horizontal | Scroll horizontal, containers px fixos, desabilitar zoom |
| 6 | Tipografia & Cor | MÉDIO | `typography`, `color` | Base 16px, line-height 1.5, tokens semânticos de cor | Texto <12px, cinza-sobre-cinza, hex cru em componentes |
| 7 | Animação | MÉDIO | `ux`, `gsap` | Duração 150–300ms, motion com significado, continuidade espacial | Animação só decorativa, animar width/height, sem reduced-motion |
| 8 | Forms & Feedback | MÉDIO | `ux` | Labels visíveis, erro perto do campo, helper text, progressive disclosure | Placeholder como label, erros só no topo, sobrecarregar |
| 9 | Navegação | ALTO | `ux` | Back previsível, bottom nav ≤5, deep linking | Nav sobrecarregada, back quebrado, sem deep links |
| 10 | Charts & Dados | BAIXO | `chart` | Legends, tooltips, cores acessíveis | Depender só de cor para transmitir valor |

## Rodando o motor de busca

**Motor oficial: Node.js** (`search.mjs`) — zero dependências, funciona em qualquer máquina com Node (que o framework já exige). Os scripts Python originais (`search.py`) também estão disponíveis em `scripts/` como fallback.

O script vive dentro do diretório da skill. Sempre invoque pelo caminho completo (resolvido a partir da raiz do framework — `.agents/skills/ui-ux-pro-max/` em projetos inicializados, ou `skills/ui-ux-pro-max/` no repo):

```bash
node <skill-dir>/scripts/search.mjs "<query>" --domain <domain>
```

## Workflow

### Passo 1: Analisar requisitos do usuário

- **Tipo de produto**: SaaS, e-commerce, portfólio, dashboard, entretenimento, ferramenta, produtividade ou híbrido
- **Público-alvo e contexto**: faixa etária, contexto de uso
- **Keywords de estilo**: playful, vibrant, minimal, dark mode, content-first, imersivo, etc.
- **Stack**: detecte do projeto (package.json, pubspec.yaml, *.xcodeproj). Se nada detectável, pergunte ou use `html-tailwind`. **Nunca assuma uma stack** — um default hardcoded desvia todas as recomendações.

### Passo 2: Gerar Design System (OBRIGATÓRIO para páginas/projetos novos)

Sempre comece com `--design-system` para obter recomendações completas com raciocínio:

```bash
node <skill-dir>/scripts/search.mjs "<tipo_produto> <industria> <keywords>" --design-system [-p "Nome do Projeto"]
```

Isso busca produto/estilo/cor/landing/tipografia em paralelo, aplica as regras de raciocínio (`ui-reasoning.csv`) e retorna padrão, estilo, cores, tipografia, efeitos e anti-padrões.

### Passo 2b: Persistir Design System (padrão Master + Overrides)

```bash
node <skill-dir>/scripts/search.mjs "<query>" --design-system --persist -p "Nome" --output-dir "<raiz-do-projeto>"
```

Cria `design-system/<slug>/MASTER.md` (fonte da verdade) + `design-system/<slug>/pages/` (overrides por página). Com `--page "dashboard"`, cria override específico. Se `MASTER.md` já existe, `--persist` **não sobrescreve** sem `--force`.

**Modelo de tokens (aplique ao formalizar cor/tipografia no MASTER.md)**: 3 camadas — **global** (valor bruto: `#6366F1`, `16px`), **alias/semântico** (aponta pro global: `color-primary` → global, `font-size-body` → global) e **componente** (escopo mínimo: `button-background-color` → alias). Nunca hardcode hex/px direto em componente; sempre via alias semântico — é o que permite dark mode e re-tema sem tocar em componente.

**Recuperação ao construir página específica:** 1) leia `MASTER.md`; 2) se `pages/<page>.md` existir, suas regras sobrescrevem o Master; 3) senão use só o Master.

### Passo 2c: Design Dials (opcional)

Três sliders 1-10 que ajustam a saída sem mudar a query:

| Dial | Baixo (1-3) | Médio (4-7) | Alto (8-10) |
|------|-------------|-------------|-------------|
| `--variance` | Centrado / minimal | Equilibrado / moderno | Ousado / assimétrico (Brutalism, Bento) |
| `--motion` | Micro-interações sutis | Scroll/stagger padrão | Coreografia complexa (pin, Flip, SplitText) |
| `--density` | Espaçoso (24-96px) | Padrão (16-64px) | Denso/dashboard (8-32px) |

### Passo 3: Buscas detalhadas complementares

```bash
node <skill-dir>/scripts/search.mjs "<keyword>" --domain <domain> [-n <max>]
```

| Necessidade | Domain | Exemplo |
|-------------|--------|---------|
| Padrões por tipo de produto | `product` | `--domain product "entertainment social"` |
| Mais opções de estilo | `style` | `--domain style "glassmorphism dark"` |
| Paletas de cor | `color` | `--domain color "entertainment vibrant"` |
| Pares de tipografia | `typography` | `--domain typography "playful modern"` |
| Google Fonts individuais | `google-fonts` | `--domain google-fonts "sans serif variable"` (regra rápida se o banco não cobrir o caso: 1 "voz" de destaque — display/headline — + 1 "cavalo de trabalho" — sans ou serif de leitura — nunca duas fontes de personalidade forte juntas) |
| Charts | `chart` | `--domain chart "real-time dashboard"` |
| Práticas UX | `ux` | `--domain ux "animation accessibility"` |
| Estrutura de landing | `landing` | `--domain landing "hero social-proof"` |
| Ícones | `icons` | `--domain icons "navigation outline"` |
| Presets GSAP | `gsap` | `--domain gsap "scroll reveal stagger"` |
| Performance React/Next | `react` | `--domain react "rerender memo list"` |
| Diretrizes app/nativo | `web` | `--domain web "accessibilityLabel touch safe-areas"` |

### Passo 4: Guidelines por stack

```bash
node <skill-dir>/scripts/search.mjs "<keyword>" --stack <stack>
```

**Stacks:** `react`, `nextjs`, `vue`, `svelte`, `astro`, `nuxtjs`, `nuxt-ui`, `angular`, `laravel`, `swiftui`, `react-native`, `flutter`, `jetpack-compose`, `html-tailwind`, `shadcn`, `threejs`, `javafx`, `wpf`, `winui`, `avalonia`, `uno`, `uwp`.

## Se a busca retornar 0 resultados

Não fabrique saída:
1. Tente uma vez com keywords mais amplas ou diferentes (produto e estilo separados).
2. Se ainda vazio, use a tabela de prioridades acima e diga explicitamente ao usuário que a recomendação veio dos defaults embutidos, não de um match do banco.
3. Nunca apresente uma busca de 0 resultados como se tivesse retornado dados.

## Exemplo de workflow

**Pedido:** "Faça uma homepage de busca com IA." (stack detectada: Next.js)

```bash
node <skill-dir>/scripts/search.mjs "AI search tool modern minimal" --design-system -p "AI Search"
node <skill-dir>/scripts/search.mjs "search loading animation" --domain ux
node <skill-dir>/scripts/search.mjs "suspense streaming bundle" --stack nextjs
```

Depois, sintetize o design system + buscas detalhadas e implemente.

## Formatos de saída

`--design-system` suporta `-f ascii` (default, terminal), `-f markdown` (documentação) e `--json` (máquina).

## Dicas para melhores resultados

- Use **keywords multidimensionais**: combine produto + indústria + tom + densidade: `"entertainment social vibrant content-dense"`, não só `"app"`.
- Tente diferentes frases para a mesma necessidade: `"playful neon"` → `"vibrant dark"` → `"content-first minimal"`.
- Use `--design-system` primeiro, depois `--domain` para aprofundar.
- Passe a stack detectada para orientação de implementação específica.

| Problema | O que fazer |
|----------|-------------|
| Não decide estilo/cor | Rode `--design-system` com keywords diferentes |
| Contraste em dark mode | `references/quick-reference.md` §6: `color-dark-mode` + `color-accessible-pairs` |
| Animações artificiais | `references/quick-reference.md` §7: `spring-physics` + `easing` + `exit-faster-than-enter` |
| Form UX ruim | `references/quick-reference.md` §8: `inline-validation` + `error-clarity` + `focus-management` |
| Navegação confusa | `references/quick-reference.md` §9: `nav-hierarchy` + `bottom-nav-limit` + `back-behavior` |
| Layout quebra em telas pequenas | `references/quick-reference.md` §5: `mobile-first` + `breakpoint-consistency` |
| Performance / jank | `references/quick-reference.md` §3: `virtualize-lists` + `main-thread-budget` + `debounce-throttle` |

## Antes de entregar UI de app

Leia `references/pro-rules.md` e percorra seu checklist canônico pré-entrega (ícones, feedback de interação, contraste light/dark, safe areas, acessibilidade) — escopado para UI nativa/mobile (iOS/Android/React Native/Flutter).

## Referências

- **WCAG 2.2** (w3.org/TR/WCAG22, mantido pelo W3C) — critérios 1.4.3 (Contrast Minimum, 4.5:1/3:1) e 1.4.6 (Contrast Enhanced/AAA, 7:1); os limiares numéricos vieram inalterados do WCAG 2.1, o 2.2 adicionou critérios novos (ex. tamanho de alvo) sem mexer em contraste.
- **Design tokens** — modelo de 3 camadas (global/alias/componente): ver UXPin "What Are Design Tokens?" e Contentful "Design tokens explained" para o vocabulário padrão do mercado em 2026.
- **Font pairing** — heurística "1 voz + 1 cavalo de trabalho" (display/headline contrastando com um sans ou serif de leitura) é consenso nos guias de pareamento tipográfico de 2026.
- **Banco de regras**: [nextlevelbuilder/ui-ux-pro-max-skill](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) — fonte primária de todo o motor local (estilos, paletas, tipografia, UX guidelines, reasoning rules).
- Curadoria completa (com o que foi portado e como usar): `references.md` desta skill.

## Nota de segurança e integração Izanagi

- **Motor 100% offline**: `search.mjs` (Node.js, port do motor original) e os scripts Python de referência usam apenas a biblioteca padrão e leem CSVs locais. Sem rede, sem upload, sem telemetria.
- **Sem dependências**: Node.js já é exigido pelo framework — `search.mjs` roda sem `npm install` extra.
- **Privacidade**: dados do projeto permanecem na máquina do usuário.
- **Licença**: MIT (ui-ux-pro-max-skill, 115k★) — integrado e adaptado ao framework Izanagi.

> Gerado pelo Izanagi AI: cópia fiel de `skills/ui-ux-pro-max/SKILL.md` (fonte da verdade).
