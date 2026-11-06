---
name: frontend-architecture
description: "Padrões de arquitetura de componentes, design tokens do Tailwind CSS (v3 e v4 @theme), organização de pastas e convenções de estilização mobile-first de alto craft."
triggers:
  - "estruturar sistema de design tokens ou tailwind config"
  - "organizar arquitetura de pastas e componentes frontend"
  - "implementar layouts responsivos mobile-first"
  - "padronizar estados interativos (hover, active, focus-visible, disabled)"
stack: [react, nextjs, tailwind-css, typescript]
---

# Frontend Architecture & Design Tokens

Esta skill estabelece a fundação técnica para construção de componentes e páginas: gerenciamento de design tokens, organização modular de diretórios e padrões rigorosos de estilização com Tailwind CSS.

---

## 1. Regra de Ouro dos Design Tokens

> **Se um valor aparece mais de uma vez, ele é um token semântico.** Nunca use hexadecimais inline (`bg-[#1e40af]`) ou estilos inline (`style={{ ... }}`) no código de componentes.

### 1.1 Configuração de Tokens (Tailwind v3 vs v4)

#### No Tailwind CSS v3 (`tailwind.config.ts`):
```ts
// tailwind.config.ts
import type { Config } from 'tailwindcss';

const config: Config = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1e40af',
          light: '#3b82f6',
          dark: '#1e3a8a',
          accent: '#059669',
        },
        surface: {
          base: '#09090b',
          subtle: '#18181b',
          elevated: '#27272a',
        },
      },
      boxShadow: {
        'elevated-card': '0 25px 50px -12px rgba(0, 0, 0, 0.45)',
        'glow-primary': '0 0 20px -3px rgba(59, 130, 246, 0.3)',
      },
    },
  },
};
export default config;
```

#### No Tailwind CSS v4 (`globals.css` com `@theme`):
```css
@import "tailwindcss";

@theme {
  --color-brand-primary: #1e40af;
  --color-brand-light: #3b82f6;
  --color-brand-dark: #1e3a8a;
  --color-surface-base: #09090b;
  --color-surface-subtle: #18181b;
  --shadow-elevated-card: 0 25px 50px -12px rgba(0, 0, 0, 0.45);
}
```

---

## 2. Estrutura Modular de Pastas (Feature-First)

Mantenha pastas organizadas por domínio/funcionalidade, não por tipo de arquivo:

```
src/
├── app/                      # Rotas e layouts do Next.js (Server-First)
│   ├── (auth)/login/
│   ├── dashboard/
│   └── layout.tsx
├── components/               # Componentes globais compartilhados
│   ├── ui/                   # Primitivos agnósticos (Button, Input, Dialog, Table)
│   └── feedback/             # Toast, Modal, Skeleton, EmptyState
├── features/                 # Módulos verticais ricos por domínio
│   ├── billing/
│   │   ├── components/       # PricingCard.tsx, InvoiceTable.tsx
│   │   ├── actions/          # checkoutAction.ts
│   │   └── types/            # billing.types.ts
│   └── projects/
├── hooks/                    # Custom hooks utilitários
├── lib/                      # Configurações de terceiros (db, stripe, utils)
└── styles/                   # Configuração de temas e tokens
```

---

## 3. Convenções de Classes Tailwind & Mobile-First

### 3.1 Ordem Canônica de Classes
Para manter legibilidade e manutenibilidade, organize as classes nesta sequência:
1. **Layout / Display**: `flex`, `grid`, `block`, `hidden`, `relative`, `absolute`
2. **Posicionamento & Grid**: `items-center`, `justify-between`, `grid-cols-1`, `gap-4`
3. **Dimensões & Espaçamento**: `w-full`, `max-w-md`, `h-10`, `px-4`, `py-2`, `m-auto`
4. **Tipografia**: `font-sans`, `text-sm`, `font-medium`, `text-zinc-100`, `tracking-tight`
5. **Cores & Superfícies**: `bg-zinc-900`, `border border-zinc-800`, `rounded-lg`
6. **Efeitos & Sombras**: `shadow-md`, `backdrop-blur-sm`, `opacity-90`
7. **Estados Interativos**: `hover:bg-zinc-800`, `active:scale-[0.98]`, `focus-visible:ring-2`
8. **Transições**: `transition-colors duration-150 ease-out`

### 3.2 Mobile-First Rigoroso
Sempre estipule o layout mobile como padrão (sem prefixo), e expanda com breakpoints progressivos (`sm:`, `md:`, `lg:`, `xl:`):

```tsx
// ✅ BOM: Mobile (1 col) -> Tablet (2 col) -> Desktop (3 col)
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">

// ❌ RUIM: Desktop-first caótico
<div className="grid grid-cols-3 sm:grid-cols-1 gap-6">
```

---

## 4. Estados Interativos e Acessibilidade

Todo componente interativo deve tratar todos os 5 estados fundamentais:

```tsx
export function PrimaryButton({ children, disabled, isLoading }: ButtonProps) {
  return (
    <button
      disabled={disabled || isLoading}
      className={clsx(
        // Base
        "inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium",
        // Superfície e Cores
        "bg-brand-primary text-white shadow-sm",
        // Hover
        "hover:bg-brand-dark transition-all duration-150",
        // Active / Micro-pressão
        "active:scale-[0.97]",
        // Focus-visible (WCAG AA - nunca use outline-none desprotegido!)
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base",
        // Disabled
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
      )}
    >
      {isLoading ? <Spinner className="w-4 h-4 animate-spin" /> : children}
    </button>
  );
}
```

---

## 5. Checklist de Verificação

- [ ] Nenhum hexadecimal solto ou estilo inline no JSX; apenas tokens do Tailwind.
- [ ] Grids e flexboxes são implementados como mobile-first (`grid-cols-1 md:grid-cols-3`).
- [ ] Todos os botões e links tratam `:hover`, `:active`, `:focus-visible` e `:disabled`.
- [ ] Transições de UI usam durações perceptualmente confortáveis (150ms a 300ms).
- [ ] O componente pai não depende de estilos vazando dos filhos (`encapsulamento semântico`).
