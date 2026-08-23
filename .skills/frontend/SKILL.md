---
name: "frontend"
description: "Design tokens do Tailwind e padrões de UI de alto craft do projeto, com boas práticas de Next.js. Use ao criar ou editar componentes visuais para manter consistência com o design system. Gatilhos de ativação: skill frontend — izanagi; 🎨 design tokens existentes (`tailwind.config.js`); 📐 padrões de design de alto craft (anti-generic ai mandate); 🆕 adicionando novos design tokens."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Skill Frontend — Izanagi

> Migrado deterministicamente de `skills/frontend/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Design tokens do Tailwind e padrões de UI de alto craft do projeto, com boas práticas de Next.js.
- **Ativar quando:** Use ao criar ou editar componentes visuais para manter consistência com o design system.
- **Escopo canônico:** Skill Frontend — Izanagi
- **Seções do corpo original:** 🎨 Design Tokens Existentes (`tailwind.config.js`) · 📐 Padrões de Design de Alto Craft (Anti-Generic AI Mandate) · 🆕 Adicionando Novos Design Tokens · ⚡ Boas Práticas Next.js · ⚡ Boas Práticas Tailwind
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Verifique se já existe um token que atende sua necessidade (consulte tabelas acima)

**Verifique** se já existe um token que atende sua necessidade (consulte tabelas acima)

### Passo 2 — Se não existe, crie com prefixo semântico do componente/contexto:

Se não existe, **crie com prefixo semântico** do componente/contexto:

```js
// tailwind.config.js → theme.extend
colors: {
  // Prefixo do contexto + propósito
  "card-border": "#e5e7eb",
  "sidebar-bg": "#f8fafc",
  "alert-success": "#059669",
}
```

### Passo 3 — Nunca use cores hardcoded inline quando o token existir:

**Nunca** use cores hardcoded inline quando o token existir:

```tsx
// ✅ BOM
<div className="bg-brand-blue">

// ❌ RUIM
<div className="bg-[#1e40af]">
// ou pior:
<div style={{ backgroundColor: '#1e40af' }}>
```

---

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

# Skill Frontend — Izanagi

## 🎨 Design Tokens Existentes (`tailwind.config.js`)

Antes de criar qualquer estilização, **consulte os tokens abaixo**. Priorize SEMPRE o uso de tokens existentes.

### Cores Customizadas

| Token Tailwind | Valor | Uso |
|----------------|-------|-----|
| `brand-blue` | `#1e40af` | Cor primária da marca. Botões, links, headers |
| `brand-light-blue` | `#3b82f6` | Variante clara do azul. Hovers, destaques |
| `brand-dark-blue` | `#1e3a8a` | Variante escura. Hover de botões, textos de destaque |
| `brand-green` | `#059669` | Cor secundária. Badges de sucesso, benefícios |
| `modal-cancel-bg` | `#f1f5f9` | Background do botão cancelar em modais |
| `modal-cancel-bg-hover` | `#e2e8f0` | Hover do botão cancelar |
| `modal-cancel-border` | `#e2e8f0` | Borda do botão cancelar |
| `modal-cancel-text` | `#4b5563` | Texto do botão cancelar |
| `modal-divider` | `rgba(0,0,0,0.06)` | Divider sutil dentro de modais |

**Como usar:**
```tsx
<button className="bg-brand-blue text-white hover:bg-brand-dark-blue">
  Enviar
</button>

<div className="text-brand-blue">Link azul da marca</div>
```

### Gradientes (Background Image)

| Token | Valor | Uso |
|-------|-------|-----|
| `bg-brand-gradient` | `linear-gradient(90deg, #1e40af, #3b82f6)` | Gradiente horizontal da marca |
| `bg-brand-gradient-2` | `linear-gradient(120deg, #1a3fad 0%, #0f2680 55%, #163ba0 100%)` | Gradiente de ângulo da marca |
| `bg-modal-card` | `linear-gradient(145deg, #ffffff 0%, #f8faff 100%)` | Background de cards de modal |
| `bg-modal-header` | `linear-gradient(90deg, #1d4ed8 0%, #2563eb 60%, #3b82f6 100%)` | Header de modal |
| `bg-modal-btn` | `linear-gradient(90deg, #1d4ed8 0%, #2563eb 100%)` | Botão de modal |
| `bg-modal-btn-hover` | `linear-gradient(90deg, #1e40af 0%, #1d4ed8 100%)` | Hover do botão de modal |

**Como usar:**
```tsx
<div className="bg-brand-gradient text-white">
  Banner com gradiente
</div>
```

### Sombras (Box Shadow)

| Token | Valor | Uso |
|-------|-------|-----|
| `shadow-modal-card` | `0 25px 60px rgba(0,0,0,0.25), 0 8px 24px rgba(59,130,246,0.12)` | Sombra elevada para modais |
| `shadow-modal-img` | `0 4px 16px rgba(0,0,0,0.10)` | Sombra suave para imagens |
| `shadow-modal-btn` | `0 2px 10px rgba(37,99,235,0.35)` | Sombra de botão azul |
| `shadow-modal-btn-hover` | `0 4px 16px rgba(37,99,235,0.45)` | Sombra de botão azul em hover |

### Backdrop Blur

| Token | Valor | Uso |
|-------|-------|-----|
| `backdrop-blur-modal` | `4px` | Blur de fundo em overlays de modal |

### Animações

| Token | Keyframe | Efeito |
|-------|----------|--------|
| `animate-modal-in` | `modalIn 0.22s ease-out` | Entrada suave do modal (translateY + scale) |

### Plugin Ativo

- **`@tailwindcss/typography`** — Classe `.prose` para conteúdo rico (posts, artigos)

> **Nota de versão (Tailwind v4)**: v4 eliminou o `tailwind.config.js` como fonte única de tokens — cores, espaçamento e tipografia passam a viver em CSS via bloco `@theme` (`--color-brand-500`, `--shadow-soft` etc.), gerando utilities reais (`bg-brand-500`) sem precisar de um segundo sistema de estilo. Este projeto ainda usa `tailwind.config.js` (estilo v3) — ao migrar para v4, portar os tokens da tabela acima para `@theme` mantendo os mesmos nomes semânticos. Heurística útil independente da versão: **se um valor aparece mais de uma vez, ele é um token** — promova para `theme.extend`/`@theme` em vez de repetir `bg-[#1e40af]`.

---

## 📐 Padrões de Design de Alto Craft (Anti-Generic AI Mandate)

> ⛔ **PROIBIDO LAYOUT "CARA DE IA"**: Nunca gere sites monótonos com fundos cinzas chapados (`bg-gray-50`), cards brancos genéricos idênticos em grid simétrico, blocos de texto chatos sem ritmo visual ou ausência total de animações.
> ✅ **A direção visual concreta (paleta, dark/light, glass ou não) vem de `design-directions`/`ui-ux-pro-max` PRIMEIRO, escolhida pelo usuário para o nicho do projeto (RULES.md regras 14-15) — nunca aplique zinc-950/glassmorphism/bento por padrão só porque é "o jeito bonito". O que é sempre obrigatório, qualquer que seja a direção escolhida:**
> - **Identidade visual real**: paleta e tipografia que respiram o nicho (fintech ≠ luxury fashion ≠ AI tech), não um template único reaproveitado.
> - **Efeitos com propósito**: glow, blur, glassmorphism só onde reforçam hierarquia (1-2 momentos-chave), nunca em todo card.
> - **Layouts Dinâmicos (Bento Grids & Assimetria)**: quando a direção escolhida pedir, grids variados, seções com contraste visual marcante, espaçamento generoso (`py-24`/`py-32`), tipografia precisa.
> - **Motion & Micro-interações**: transições fluidas, animações de scroll, stagger entry e feedback visual em elementos interativos — sempre com `prefers-reduced-motion` respeitado.

### Layout de Página Moderna / Cinematográfica

**Exemplo de referência — não é template a copiar literalmente.** Só é aplicável tal como está se a direção escolhida na fase de design for "dark tech futurista"; para qualquer outro nicho, troque paleta/glow/radius pelos tokens da direção escolhida antes de usar:

```tsx
<main className="min-h-screen bg-zinc-950 text-zinc-100 selection:bg-indigo-500 selection:text-white">
  <Header />
  
  {/* Hero Cinematográfico com Radial Glow */}
  <section className="relative overflow-hidden py-28 md:py-36">
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
    <div className="container mx-auto px-4 relative z-10">
      {/* Título com tracking-tight e subtítulo refinado */}
    </div>
  </section>

  {/* Seção Bento Grid / Conteúdo Dinâmico */}
  <section className="py-20 border-t border-zinc-900/80">
    <div className="container mx-auto px-4">
      {/* Grid assimétrico / bento cards */}
    </div>
  </section>

  <Footer />
</main>
```

### Cards e Containers de Alto Padrão

```tsx
// Card Bento com Glassmorphism e Glow no Hover
<div className="group relative rounded-2xl bg-zinc-900/60 p-8 backdrop-blur-xl border border-zinc-800/80 hover:border-indigo-500/50 transition-all duration-300 hover:shadow-2xl hover:shadow-indigo-500/10">
  <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent rounded-2xl pointer-events-none" />
  {/* conteúdo */}
</div>
```

### Formulários

> Use os tokens da marca (`brand-blue`, `modal-*`) já declarados acima, não cores default do Tailwind (`gray-*`, `blue-500`) — ver `anti-ai-slop` para o porquê.

```tsx
// Wrapper do formulário
<form className="space-y-4">
  {/* ou space-y-6 para formulários maiores */}
</form>

// Label padrão
<label className="block text-sm font-medium text-brand-dark-blue mb-2">
  Nome <span className="text-red-600">*</span>
</label>

// Input padrão
<input className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent" />

// Select padrão
<select className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent">

// Textarea padrão
<textarea rows={6} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent" />

// Erro de validação
<p className="text-red-500 text-sm mt-1">{errors.campo.message}</p>
```

### Botões

```tsx
// Botão primário (tokens da marca)
<button className="w-full bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark-blue transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">

// Botão com loading
{loading ? (
  <>
    <Loader className="w-5 h-5 animate-spin" />
    Enviando...
  </>
) : (
  <>
    <Send className="w-5 h-5" />
    Enviar
  </>
)}
```

### Grids Responsivos

```tsx
// 2 colunas (mobile: 1)
<div className="grid grid-cols-1 md:grid-cols-2 gap-4">

// 3 colunas com sidebar (mobile: 1)
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

// 2 colunas + sidebar
<div className="lg:col-span-2"> {/* conteúdo principal */}
<div> {/* sidebar */}
```

### Feedbacks

```tsx
// Sucesso (usa brand-green já declarado nos tokens)
<div className="bg-brand-green/10 border border-brand-green/30 text-emerald-800 px-4 py-3 rounded-lg mb-6">

// Erro
<div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg mb-6">
```

### Informações de Contato / Sidebar

```tsx
<div className="flex items-start gap-3">
  <Icon className="w-5 h-5 text-brand-blue mt-1 flex-shrink-0" />
  <div>
    <p className="font-semibold text-gray-800">Título</p>
    <p className="text-gray-600 text-sm">Conteúdo</p>
  </div>
</div>
```

### Tipografia

> **Nunca use Inter como fonte única do projeto sem decisão explícita** — é o tell #1 de "cara de IA" (`anti-ai-slop`). Escolha um pairing com personalidade para o nicho (ex.: uma serifada editorial para display + uma sans neutra para corpo, ou uma mono para dados/fintech) e declare em `tailwind.config.js`/`@theme` antes de usar as classes abaixo.

| Uso | Classes |
|-----|---------|
| Título de página | `text-2xl font-bold text-slate-800 tracking-tight` |
| Subtítulo | `text-slate-600` |
| Título de card | `text-xl font-bold text-slate-800` |
| Título de formulário | `text-xl font-semibold mb-4 text-center` |
| Label | `block text-sm font-medium text-slate-700` |
| Texto secundário | `text-slate-600 text-sm` |

---

## 🆕 Adicionando Novos Design Tokens

Quando precisar criar um **novo token**, adicione-o no `tailwind.config.js`:

### Passo a passo:

1. **Verifique** se já existe um token que atende sua necessidade (consulte tabelas acima)
2. Se não existe, **crie com prefixo semântico** do componente/contexto:

```js
// tailwind.config.js → theme.extend
colors: {
  // Prefixo do contexto + propósito
  "card-border": "#e5e7eb",
  "sidebar-bg": "#f8fafc",
  "alert-success": "#059669",
}
```

3. **Nunca** use cores hardcoded inline quando o token existir:

```tsx
// ✅ BOM
<div className="bg-brand-blue">

// ❌ RUIM
<div className="bg-[#1e40af]">
// ou pior:
<div style={{ backgroundColor: '#1e40af' }}>
```

---

## ⚡ Boas Práticas Next.js

### Server Components por padrão (App Router)

- Todo arquivo em `/app` é **React Server Component por padrão** — só vira Client Component com `"use client"` explícito no topo. Regra: comece server, suba `"use client"` só até onde a interatividade exige.
- Buscar dados direto dentro de Server Components `async` — sem `useEffect`, sem `getServerSideProps`. O React deduplica automaticamente `fetch()` com a mesma URL/opções entre `generateMetadata` e a página no mesmo request.
- **Cache de `fetch` é agressivo por padrão** no Next.js — isso quebra silenciosamente dados que precisam ser sempre frescos (dashboards, dados por usuário). Toda chamada que não pode ser cacheada precisa de `cache: 'no-store'` ou `next: { revalidate: 0 }` explícito.
- Impacto real: mover data-fetching de Client → Server Components costuma cortar 30-60% do JS enviado ao cliente (ex.: dashboards caindo de ~400KB para ~150KB de first-load JS).

### `params`/`searchParams` são `Promise` (Next.js 15+)

```tsx
// ✅ Next.js 15+ — params e searchParams chegam como Promise, precisam de await
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <div>{slug}</div>;
}

// ❌ Desestruturar direto (funcionava até o Next 14) causa erro/bug silencioso no 15+
export default function Page({ params }: { params: { slug: string } }) {
  const { slug } = params; // quebra em Next.js 15+
}
```

### `"use client"` — Quando usar
- ✅ Componentes com `useState`, `useEffect`, `useRef`
- ✅ Event handlers (`onClick`, `onChange`, `onSubmit`)
- ✅ Hooks customizados
- ❌ **NÃO** usar em pages que são puramente estáticas

### Importações
- Usar `@/` para imports absolutos (configurado no `tsconfig.json`)
- Agrupar imports: React → Next.js → libs externas → componentes → utils → types

```tsx
// 1. React
import { useState, useEffect } from "react";

// 2. Next.js
import { useRouter } from "next/navigation";

// 3. Libs externas
import { z } from "zod";
import axios from "axios";

// 4. Componentes
import Header from "@/components/Header";
import Footer from "@/components/Footer";

// 5. Utils/Services
import { formatCPF } from "@/utils/validCPF";

// 6. Types
import type { Post } from "@/types";
```

### Imagens
- Usar `OptimizedImage` (componente do projeto) para lazy loading
- Imagens estáticas em `public/images/`
- Imagens dinâmicas via Supabase Storage

---

## ⚡ Boas Práticas Tailwind

### Mobile-first
- Sempre estilizar para **mobile primeiro**, depois adicionar breakpoints
- Breakpoints: `sm:` (640px), `md:` (768px), `lg:` (1024px), `xl:` (1280px)

```tsx
// ✅ Mobile-first
<div className="px-4 md:px-8 lg:px-16">

// ❌ Desktop-first
<div className="px-16 sm:px-4">
```

### Responsividade de Grid
```tsx
// Padrão do projeto: 1 col mobile → 2 col tablet → 3 col desktop
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

### Hover e Transições
- Sempre incluir `transition-colors` em botões e links
- Usar `duration-300` para transições suaves
- Padrão de desabilitado: `disabled:opacity-50 disabled:cursor-not-allowed`

### Organização de Classes
Ordenar classes Tailwind por:
1. Layout (display, position, grid, flex)
2. Sizing (width, height, padding, margin)
3. Typography (font, text)
4. Visual (background, border, shadow)
5. States (hover, focus, disabled)
6. Animation (transition, animate)

```tsx
// Exemplo ordenado
<button className="flex items-center justify-center gap-2 w-full px-6 py-3 text-white font-semibold bg-brand-blue rounded-lg shadow-lg hover:bg-brand-dark-blue focus:ring-2 transition-colors duration-300">
```

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
