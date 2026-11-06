---
name: anti-ai-slop
description: "Elimina estéticas genéricas de IA (Inter default, gradientes roxos, hero + 3 cards, rounded-2xl uniforme) e aplica padrões de design de alto craft com escolhas intencionais de tipografia, cor, grid e motion."
triggers:
  - "criar ou revisar qualquer página, landing ou componente de interface"
  - "auditar código visual para eliminar 'cara de IA'"
  - "definir identidade visual, tipografia ou paleta sem recorrer a padrões clichês"
stack: [react, nextjs, tailwind, css]
---

# Anti AI-Slop — Padrão High-Craft & Zero "Cara de IA"

Esta skill é a diretriz inegociável de direção de arte do ecossistema. IAs geram código esteticamente mediano porque convergem para a média estatística de seus dados de treino. Esta skill impõe escolhas deliberadas de design que rompem essa média e entregam interfaces de nível Awwwards / Apple-grade.

---

## 1. Catálogo dos 10 Tells Mortais de IA (Detectar & Eliminar)

| # | Tell de IA (O que a IA faz) | Impacto | Substituição Obrigatória (High-Craft) |
|---|-----------------------------|---------|---------------------------------------|
| 1 | **Inter como fonte única** | Denuncia IA no primeiro segundo | Tipografia com voz e contraste expressivo de escala (veja Tabela de Pareamentos). |
| 2 | **Gradientes Roxo/Violeta/Rosa** (`from-purple-600 to-pink-500`) | O maior clichê visual de IA | 1 cor dominante forte + 1 acento afiado; ou paleta monocromática tonal (Dark OLED / Papel quente). |
| 3 | **Hero Centralizado + 3 Cards Idênticos** | Estrutura repetitiva e preguiçosa | Layout assimétrico, grade editorial, split 60/40, diagonais, listas tipográficas, ou visualização de produto imersiva. |
| 4 | **`rounded-2xl` Uniforme em Tudo** | Efeito "bolha de sabão" sem contraste | Raios funcionais e variados: `rounded-none` ou `rounded-sm` para dados técnicos; `rounded-lg` para botões; `rounded-3xl` apenas em elementos herói. |
| 5 | **Fundo `#f9fafb` + Cards Brancos + Sombra Suave** | Visual de template SaaS genérico de 2021 | Superfícies com caráter: Dark OLED (`#09090b`), off-white quente (`#fbfbfa`), cinzas frios com textura ou papel de revista. |
| 6 | **Simetria Perfeita em Todas as Seções** | Monotonia que impede o escaneamento | Quebra de simetria intencional: um elemento sangrando na borda da tela (*bleed*), pull-quotes em 2 colunas, desalinhamento controlado. |
| 7 | **Headlines Vagas & Corporativas** | "Build the future", "Elevate your business", "Seamless" | Copy afiada, específica e mensurável: "Reduza custos de API em 63% usando cache distribuído". |
| 8 | **Glassmorphism Descontextualizado** | `backdrop-blur-md bg-white/10` sem fonte de luz | Camadas tonais sólidas com bordas semitransparentes finas (`border-white/10`) e sombras direcionais sutis. |
| 9 | **Animações Decorativas com `scale(0)`** | Elementos "explodindo" do vácuo | Animações físicas: entrada com `scale(0.95) -> 1` e `opacity: 0 -> 1` usando curvas exponenciais. |
| 10 | **Ícones Genéricos sem Contexto** | Emojis soltos ou ícones Lucide soltos sem base | SVGs inline monocromáticos integrados a badges semânticos ou ilustrações vetorizadas exclusivas. |

---

## 2. Tipografia Intencional & Pareamentos Recomendados

Nunca utilize apenas uma fonte sem contraste hierárquico. Combine **Display/Título** expressivo com **Body/Corpo** ultra-legível:

```tsx
// Exemplo de pareamento no Tailwind (tailwind.config.js / globals.css)
// Editorial / Editorial Serif + Neutral Sans
fontFamily: {
  serif: ['"Instrument Serif"', 'Georgia', 'serif'],
  sans: ['"General Sans"', 'Inter', 'sans-serif'],
  mono: ['"JetBrains Mono"', 'monospace'],
}
```

### Pareamentos Canônicos por Nicho:
- **DevTools / Infraestrutura / IA**: `JetBrains Mono` ou `Geist Mono` (Títulos/Badges) + `Sora` ou `Geist Sans` (Corpo).
- **FinTech / Finanças / B2B**: `Space Grotesk` (Títulos) + `Inter Tight` ou `Plus Jakarta Sans` (Corpo numérico com `tabular-nums`).
- **Editorial / Cultura / Luxo**: `Instrument Serif` ou `Fraunces` (Títulos display 72-120px) + `General Sans` (Corpo 15px).
- **SaaS Moderno / Criatividade**: `Syne` ou `Clash Display` (Display dramático) + `Archivo` ou `Cabinet Grotesk`.

---

## 3. Paletas Tonais e Elevação (Dark OLED vs Off-White)

Evite cinzas puros `#808080` ou gradientes sem sentido. Use paletas tonais com profundidade:

### Paleta Dark OLED Premium
- **Canvas Base**: `bg-zinc-950` (`#09090b`)
- **Superfície 1 (Painéis)**: `bg-zinc-900` (`#18181b`) + `border border-zinc-800/80`
- **Superfície 2 (Cards Elevados)**: `bg-zinc-900/60 backdrop-blur-md` + `border border-white/10`
- **Texto Principal**: `text-zinc-100` (contraste 12:1)
- **Texto Secundário / Labels**: `text-zinc-400`
- **Acento Afiado**: Emerald (`#10b981`), Amber (`#f59e0b`), Cyan (`#06b6d4`) ou Azul Elétrico (`#3b82f6`) — **escolha apenas 1 por produto**.

---

## 4. Regras de Ouro de Execução

1. **Hierarchy Shock (Hierarquia Agressiva)**:
   - Título hero deve contrastar brutalmente com o corpo: `text-6xl md:text-8xl font-medium tracking-tight` contra `text-base text-zinc-400 max-w-xl`.
2. **Tabular Nums em Métricas**:
   - Todo número, preço, estatística ou dado tabular DEVE conter a classe `tabular-nums font-mono`.
3. **Botões com Física Real**:
   - Todo controle clicável deve ter hover suave e active com micro-pressão:
   ```tsx
   <button className="px-5 py-2.5 rounded-lg bg-zinc-100 text-zinc-900 font-medium text-sm transition-all duration-150 hover:bg-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-emerald-500/50">
     Começar Agora
   </button>
   ```
4. **Motion com Justificativa Espacial**:
   - Easing padrão: `cubic-bezier(0.22, 1, 0.36, 1)`.
   - NUNCA use `scale(0)` em reveals — use `scale(0.96)` para preservar ancoragem visual.

---

## 5. Checklist Anti-Slop (Auditoria Pré-Entrega)

- [ ] **Tipografia**: A fonte não é Inter default isolada; existe pareamento intencional e hierarquia de escala.
- [ ] **Cores**: Nenhum gradiente roxo/rosa sem justificativa; apenas 1 acento afiado em destaque.
- [ ] **Grid**: A página não se resume a hero centralizado + 3 cards iguais; há quebra de ritmo e assimetria.
- [ ] **Bordas**: Os raios (`rounded-*`) variam de acordo com a função e não são uniformemente `rounded-2xl`.
- [ ] **Copywriting**: Não há jargões vazios ("All-in-one", "Seamless", "Next-gen"); a proposta é numérica e concreta.
- [ ] **Interação**: Estados `:hover`, `:active`, `:focus-visible` e `:disabled` implementados com transições suaves (150-250ms).
