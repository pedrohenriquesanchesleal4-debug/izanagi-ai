---
name: frontend
description: |
  Skill de frontend para o Portal. Contém todos os design tokens do Tailwind CSS,
  padrões de design identificados nas páginas existentes, e boas práticas de Next.js + Tailwind.
  Use esta skill para criar ou editar componentes visuais, garantindo consistência com o design system existente.
  Antes de criar novas classes ou variáveis, consulte a lista de tokens existentes abaixo.
---

# Skill Frontend — Portal

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

---

## 📐 Padrões de Design Identificados

### Layout de Página Pública

Toda page pública segue exatamente esta estrutura:

```tsx
<main>
  <Header />
  <PageHeader title="..." subtitle="..." breadcrumb={[...]} />
  
  <section className="py-16 bg-gray-50">
    <div className="container mx-auto px-4">
      {/* conteúdo */}
    </div>
  </section>

  <Footer />
</main>
```

### Cards e Containers

```tsx
// Card principal
<div className="bg-white rounded-lg shadow-lg p-8">

// Card compacto
<div className="bg-white shadow-lg rounded-2xl p-6">

// Container de seção
<div className="container mx-auto px-4">
```

### Formulários

```tsx
// Wrapper do formulário
<form className="space-y-4">
  {/* ou space-y-6 para formulários maiores */}
</form>

// Label padrão
<label className="block text-sm font-medium text-gray-700 mb-2">
  Nome <span className="text-red-600">*</span>
</label>

// Input padrão
<input className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent" />

// Select padrão
<select className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent">

// Textarea padrão
<textarea rows={6} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent" />

// Erro de validação
<p className="text-red-500 text-sm mt-1">{errors.campo.message}</p>
```

### Botões

```tsx
// Botão primário (azul)
<button className="w-full bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark-blue transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">

// Botão simples
<button className="w-full bg-blue-500 text-white font-semibold py-2 rounded-lg hover:bg-blue-600 transition-colors">

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
// Sucesso
<div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-6">

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

| Uso | Classes |
|-----|---------|
| Título de página | `text-2xl font-bold text-gray-800` |
| Subtítulo | `text-gray-600` |
| Título de card | `text-xl font-bold text-gray-800` |
| Título de formulário | `text-xl font-semibold mb-4 text-center` |
| Label | `block text-sm font-medium text-gray-700` |
| Texto secundário | `text-gray-600 text-sm` |

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
