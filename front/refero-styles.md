---
name: refero-styles
description: "Padrões de design de interfaces extraídos de produtos reais de alto nível (Linear, Stripe, Raycast, Vercel e Supabase): Command Palettes, Data Tables, Settings e KPI Cards."
triggers:
  - "projetar componentes de produtos complexos (SaaS, DevTools, FinTech, Dashboards)"
  - "implementar Command Palette (Cmd+K), Data Tables analíticas ou Settings em abas"
  - "estruturar cartões de métricas (KPIs) com micro-sparklines e números tabulares"
stack: [react, nextjs, tailwind-css, lucide-icons]
---

# Refero Styles — Padrões de Componentes de Produtos Reais

Esta skill conecta o desenvolvimento de frontend aos padrões de interação e elevação visual consolidados por gigantes da indústria de tecnologia como Linear, Stripe, Raycast e Vercel.

---

## 1. Catálogo de Componentes de Elite

### 1.1 Command Palette (Cmd + K — Linear & Raycast Pattern)
A Command Palette é o coração da produtividade em DevTools e SaaS modernos:
- **Backdrop**: `backdrop-blur-md bg-black/50 fixed inset-0 z-50 flex items-start justify-center pt-24`.
- **Janela**: `w-full max-w-xl rounded-xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden`.
- **Input de Busca**: Auto-focado, sem bordas pesadas, com ícone de lupa e badge `ESC` à direita.
- **Lista de Ações Agrupadas**: Seções identificadas por títulos discretos (`text-[11px] font-mono uppercase tracking-wider text-zinc-500 px-3 py-2`).
- **Item em Foco**: Destaque de superfície suave (`bg-zinc-800 text-zinc-100 rounded-md px-3 py-2`) acompanhado de atalhos em `<kbd>`:
  ```tsx
  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-zinc-800/80 cursor-pointer text-sm">
    <div className="flex items-center gap-3 text-zinc-200">
      <FileTextIcon className="w-4 h-4 text-zinc-400" />
      <span>Criar nova tarefa</span>
    </div>
    <kbd className="px-1.5 py-0.5 text-xs font-mono bg-zinc-950 border border-zinc-700 text-zinc-400 rounded">
      C
    </kbd>
  </div>
  ```

### 1.2 Data Tables Profissionais (Stripe & Supabase Pattern)
Tabelas de dados não são grids estáticos, mas ferramentas operacionais:
- **Alinhamento Semântico**:
  - Textos e nomes: alinhados à esquerda (`text-left`).
  - Números, moedas, datas e status: alinhados à direita com `text-right font-mono tabular-nums`.
- **Linhas e Estados de Hover**:
  ```tsx
  <tr className="border-b border-zinc-800/60 hover:bg-zinc-900/60 transition-colors">
    <td className="py-3.5 px-4 text-sm font-medium text-zinc-200">faturamento_outubro.csv</td>
    <td className="py-3.5 px-4 text-sm text-zinc-400">Processado</td>
    <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums text-zinc-300">
      R$ 42.850,00
    </td>
  </tr>
  ```

### 1.3 KPI Cards com Micro-Sparkline
Cartões de métricas devem sintetizar valor e contexto histórico em espaço mínimo:
```tsx
export function KpiCard({ title, value, change, isPositive, sparklineData }: KpiProps) {
  return (
    <div className="p-5 rounded-xl bg-zinc-900/80 border border-zinc-800/80 flex flex-col justify-between">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">
          {title}
        </span>
        <span className={clsx(
          "text-xs font-medium px-2 py-0.5 rounded-full font-mono",
          isPositive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
        )}>
          {isPositive ? `+${change}%` : `${change}%`}
        </span>
      </div>

      <div className="mt-4 flex items-baseline justify-between">
        <div className="text-3xl font-bold font-mono tracking-tight text-zinc-100 tabular-nums">
          {value}
        </div>
        {/* Sparkline SVG minimalista */}
        <svg className="w-20 h-8 stroke-current" viewBox="0 0 100 30" fill="none">
          <polyline
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={isPositive ? "text-emerald-500" : "text-red-500"}
            points={sparklineData}
          />
        </svg>
      </div>
    </div>
  );
}
```

---

## 2. Camadas de Elevação Tonal (Dark Theme)

- **Canvas Base**: `bg-zinc-950` (`#09090b`)
- **Superfície Nível 1 (Sidebars e Navegações)**: `bg-zinc-900` (`#18181b`) + `border-r border-zinc-800`
- **Superfície Nível 2 (Cards e Tabelas)**: `bg-zinc-900/60` com borda sutil `border-white/10`
- **Superfície Nível 3 (Modais, Dropdowns, Popovers)**: `bg-zinc-800` (`#27272a`) + `shadow-2xl shadow-black/60`

---

## 3. Checklist de Validação Refero

- [ ] Todos os valores numéricos utilizam a propriedade `tabular-nums` para evitar saltos visuais em atualizações.
- [ ] Listas e tabelas possuem tratamento de linha no `:hover` com transições suaves (100ms a 150ms).
- [ ] A Command Palette e modais possuem fechamento intuitivo com tecla `Escape` e clique no backdrop.
- [ ] As superfícies respeitam a hierarquia de camadas tonais do escuro ao mais elevado.
