---
name: web-design-guidelines
description: "Diretrizes essenciais de web design e interface de usuário moderna: grid de 4px/8px, densidade por tipo de aplicação, áreas mínimas de clique e regras de tipografia."
triggers:
  - "padronizar métricas de espaçamento, padding e dimensões de componentes"
  - "alinhar interfaces com as diretrizes do Vercel Web Design Guidelines"
  - "auditar consistência de grids espaciais e densidade de informação"
stack: [ui-guidelines, web-standards, css, tailwind]
---

# Web Design Guidelines — Interfaces Modernas & Alta Precisão

Esta skill condensa as melhores práticas de design de produto e engenharia de interface (baseadas no Vercel Web Design Guidelines e no princípio de boa forma de Dieter Rams), fornecendo regras matemáticas para espaçamento e layout.

---

## 1. O Grid Espacial Rigoroso (Múltiplos de 4px e 8px)

> **Regra Absoluta**: Todo `margin`, `padding`, `gap`, `width` e `height` de componentes estruturais deve ser estritamente derivado da escala de **4px ou 8px**. Nunca use valores arbitrários como `p-[13px]` ou `gap-[19px]`.

### Escala de Espaçamento Canônica:
- `4px` (`gap-1` / `p-1`): Micro-espaçamentos internos (entre ícone e badge, tags de status).
- `8px` (`gap-2` / `p-2`): Espaçamento entre ícone e texto de botão, elementos compactos.
- `12px` (`gap-3` / `p-3`): Espaçamento padrão de controles de formulário e dropdowns.
- `16px` (`gap-4` / `p-4`): Padding interno de cards compactos e grids densos.
- `24px` (`gap-6` / `p-6`): Padding de cards principais, modais e seções de dashboard.
- `32px` (`gap-8` / `p-8`): Separação entre blocos de conteúdo e grupos de formulário.
- `48px a 96px` (`py-12` a `py-24`): Respiro vertical entre seções em landing pages.

---

## 2. Densidade por Tipo de Aplicação

A densidade de uma interface deve corresponder à sua função primária:

| Contexto de Aplicação | Padding de Card | Tamanho de Fonte Base | Line-Height | Alvo de Toque |
|---|---|---|---|---|
| **Dashboards / DevTools / FinTech** | `p-3` a `p-4` | 13px – 14px | 1.35 – 1.45 | Mín. 32px (Desktop) / 44px (Mobile) |
| **SaaS Geral / Webapps** | `p-5` a `p-6` | 14px – 16px | 1.45 – 1.55 | Mín. 40px (Desktop) / 44px (Mobile) |
| **Landing Pages / Editorial** | `p-8` a `p-12` | 16px – 18px | 1.55 – 1.65 | Mín. 48px |

---

## 3. Hierarquia de Contêineres Pais e Filhos

> **A regra do aninhamento harmônico**: O padding interno de um contêiner pai DEVE ser maior que a distância (`gap`) entre os elementos filhos que ele abriga.

```tsx
// ✅ BOM: Pai com p-6 (24px) abriga filhos com gap-3 (12px)
<div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800">
  <div className="flex flex-col gap-3">
    <ComponenteA />
    <ComponenteB />
  </div>
</div>

// ❌ RUIM: Pai comprimido p-2 abriga filhos com gap-6 (cria sensação de claustrofobia)
<div className="p-2">
  <div className="flex flex-col gap-6">...</div>
</div>
```

---

## 4. Alvos Interativos & Acessibilidade de Toque

1. **Tamanho Mínimo de Alvo de Clique**:
   - Todo elemento clicável em telas touch deve possuir no mínimo **44×44px** de área ativa, mesmo que o ícone visual interno tenha apenas 16px ou 20px.
   - Utilize classes como `p-3` ou use contêineres transparentes com `min-w-[44px] min-h-[44px] flex items-center justify-center`.
2. **Focus Rings com Proteção de Contraste**:
   - Nunca remova o contorno de foco sem fornecer anel visível.
   - Padrão recomendado: `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-light focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950`.

---

## 5. Checklist das Diretrizes

- [ ] Todos os paddings e gaps são múltiplos estritos de 4px ou 8px.
- [ ] A densidade do layout é compatível com o propósito da tela (alta densidade para dashboards, generosa para marketing).
- [ ] O padding de contêineres pais é superior ao gap de seus filhos internos.
- [ ] Elementos de clique possuem área ativa de no mínimo 44×44px em ambientes responsivos.
