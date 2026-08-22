# UI/UX Pro Max — Referências

Fonte da inteligência de design (curada do pacote `ui-ux-pro-max-skill`).

> **Atualizado em 2026-08-10**: motor de busca **Node.js** (`scripts/search.mjs`) + dados completos (`data/*.csv`, ~1.7MB) incorporados. Antes eram deliberadamente não-portados (exigiam Python); o port Node remove a dependência.

## Fonte principal

- **Repositório**: https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
  - 115k stars, MIT License
  - 161 reasoning rules por indústria (v2.0), 84 UI styles, 192 paletas, 74 font pairings, 25 chart types, 22 stacks
- **Site oficial**: https://uupm.cc
- **CLI**: `npm i -g ui-ux-pro-max-cli` → `uipro init --ai opencode` (instala a skill completa com scripts de busca Python e dados CSV no projeto)
- **Pacote npm**: `ui-ux-pro-max-cli` (tem instalador próprio; usa diretório `.claude/skills/` ou `.agents/skills/`)

## O que aproveitar no Izanagi

1. **Reasoning engine** — 161 regras por indústria (Tech & SaaS, Finance, Healthcare, E-commerce, Services, Creative, Lifestyle, Emerging Tech) → padrão recomendado, estilo, paleta, tipografia, efeitos e anti-padrões por nicho.
2. **Design System Generator** — saída estruturada (pattern + style + colors + typography + effects + anti-patterns + checklist pré-entrega). Master + page-overrides pattern (`design-system/MASTER.md` + `pages/<page>.md`).
3. **Anti-patterns por indústria** — ex.: "AI purple/pink gradients" para banking; neon para wellness; dark mode avulsa.
4. **Dials**: `--variance 1-10`, `--motion 1-10`, `--density 1-10` para tunar o design system sem mudar a query.

## Assets incorporados localmente (portados)

- `scripts/search.mjs` — **motor Node.js (BM25, offline, zero deps)** — port fiel do `core.py`/`search.py`/`design_system.py` + persistência Master/Overrides. Roda com `node` puro.
- `scripts/search.py` + `core.py` + `design_system.py` — motor Python original (fallback para máquinas com Python).
- `data/*.csv` (~1.7MB) — banco pesquisável: styles, colors, charts, landing, products, ux-guidelines, typography, icons, motion, react-performance, app-interface, google-fonts, ui-reasoning + `stacks/*` (22 stacks).
- `references/quick-reference.md` — regras UX completas (10 categorias priorizadas) em formato estático indexável.
- `references/pro-rules.md` — polish de UI nativa/mobile + checklist canônico pré-entrega.

## Uso rápido

```bash
node skills/ui-ux-pro-max/scripts/search.mjs "saas dashboard" --domain style
node skills/ui-ux-pro-max/scripts/search.mjs "AI tool minimal" --design-system -f markdown
node skills/ui-ux-pro-max/scripts/search.mjs "suspense streaming" --stack nextjs
```

## Estilos de UI citados (84)

- **General (49)**: Minimalism & Swiss, Neumorphism, Glassmorphism, Brutalism, 3D & Hyperrealism, Vibrant & Block-based, Dark Mode OLED, Accessible & Ethical, Claymorphism, Aurora UI, Retro-Futurism, Flat, Skeuomorphism, Liquid Glass, Motion-Driven, Micro-interactions, Inclusive, Zero Interface, Soft UI Evolution, Neubrutalism, Bento Box Grid, Y2K, Cyberpunk, Organic Biophilic, AI-Native UI, Memphis, Vaporwave, Dimensional Layering, Exaggerated Minimalism, Kinetic Typography, Parallax Storytelling, Swiss Modernism 2.0, HUD/FUI, Pixel Art, Bento Grids, Spatial UI (Vision), E-Ink/Paper, Gen Z Maximalism, Biomimetic, Anti-Polish, Tactile Digital, Nature Distilled, Interactive Cursor, Voice-First, 3D Product Preview, Gradient Mesh, Editorial Grid, Chromatic Aberration, Vintage Analog.
- **Landing (8)**: Hero-Centric, Conversion-Optimized, Feature-Rich, Minimal & Direct, Social Proof-Focused, Interactive Demo, Trust & Authority, Storytelling-Driven.
- **Dashboard (10)**: Data-Dense, Heat Map, Executive, Real-Time, Drill-Down, Comparative, Predictive, User Behavior, Financial, Sales Intelligence.

> Para valores exatos (hex, fonts, seções, snippets GSAP), rode o motor: `node <skill-dir>/scripts/search.mjs "<query>" --domain <domain>`.

**Nota de licença GSAP (2026)**: desde a aquisição pela Webflow (abr/2025), GSAP e todos os plugins antes exclusivos do Club GreenSock (SplitText, MorphSVG, DrawSVG, ScrollSmoother) são 100% gratuitos, inclusive uso comercial — sem token/registry privado para instalar via npm. Ver `skills/motion-design/references.md` para detalhes.

## Fontes complementares de design system

- Google Fonts pairing: `fonts.google.com/share?selection.family=...`
- Design tokens: Heroicons / Lucide (ícones SVG, nunca emoji)
- A11y: WCAG AA (4.5:1 texto), prefers-reduced-motion, focus states, 44×44px alvo tátil

## Verificação 2026 (WCAG 2.2, tokens, tipografia)

- **WCAG 2.2** (w3.org/TR/WCAG22): 4.5:1 (texto normal, AA) / 3:1 (texto grande ≥18pt ou ≥14pt bold, e componentes de UI/objetos gráficos) / 7:1 (AAA, texto normal). Confirmado: os limiares numéricos de contraste não mudaram do WCAG 2.1 para o 2.2 — o 2.2 adicionou critérios novos (ex. tamanho de alvo, foco não obscurecido), não recalibrou contraste. Ferramentas: WebAIM Contrast Checker, Level Access, getwcag.com.
- **Design tokens (3 camadas)**: global (valor bruto) → alias/semântico (nome com significado, ex. `color-primary`) → componente (escopo mínimo, ex. `button-background-color`). Fonte: UXPin "What Are Design Tokens? A Complete Guide (2026)", Contentful "Design tokens explained".
- **Font pairing**: heurística de mercado 2026 — 1 fonte de "voz" (display/headline, personalidade forte) + 1 "cavalo de trabalho" (sans/serif neutro de leitura); evitar duas fontes de personalidade forte competindo. Fonte: guias de pareamento tipográfico 2026 (getly.store, Figr "Typography System Design").