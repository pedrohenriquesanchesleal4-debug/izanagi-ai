---
name: impeccable
description: "Direção de arte e vocabulário de design de alta precisão (inspirado no Impeccable de Paul Bakaus). Use ao projetar, estilizar ou refinar qualquer interface web."
---

# Impeccable — Design Engineering & Vocabulário de Direção de Arte

Skill fundamentada no framework **Impeccable** (Paul Bakaus / `impeccable.style`): transforma intenções de produto em decisões matemáticas de tipografia, cor perceptual (OKLCH), arquitetura espacial e polimento visual, eliminando o regressão estatística para templates genéricos de IA.

## Quando usar

Use ao **criar qualquer interface nova, refatorar componentes visuais ou elevar o acabamento estético de páginas existentes** (landing pages, dashboards SaaS, editores, documentação ou portfólios). Combine obrigatoriamente com `emil-kowalski` (para física de motion e micro-interações) e `anti-ai-slop` (auditoria final).

**Pule** para tarefas exclusivamente de backend, banco de dados ou CLI sem interface gráfica.

---

## 1. Os 4 Modos Intencionais de Design (Intentional Design Modes)

Antes de escolher qualquer classe Tailwind ou componente, classifique o que o usuário visitante precisa fazer na tela:

| Modo | Objetivo do Usuário | Densidade & Espaço | Tipografia & Hierarquia | Superfície & Cor |
|---|---|---|---|---|
| **1. Persuade** *(Landing, Pricing, Checkout)* | Decidir e agir com confiança | Generosa (`py-24` a `py-36`), foco em 1 narrativa por dobra | Contraste dramático: Display (`clamp(2.75rem, 6vw, 5.5rem)`, `leading-[0.98]`, `tracking-tighter`) vs Body `16-18px` | Paleta expressiva com 1 acento de alta conversão; zero ruído lateral |
| **2. Operate** *(Dashboards, DevTools, Editores)* | Executar tarefas complexas rapidamente | Alta densidade (`p-3` a `p-5`, `gap-2` a `gap-4`), aproveitamento total da viewport | Escala contida (`12px-14px` base), `tabular-nums` obrigatório em dados, labels `font-mono uppercase` | Neutros escuros ou claros tonalizados em OKLCH; bordas de 1px sutis; atalhos `<kbd>` visíveis |
| **3. Read** *(Docs, Artigos, Relatórios)* | Absorver conteúdo longo sem fadiga | Medida de linha estrita (`60ch-75ch` / `max-w-prose`), margens amplas | Ritmo vertical cadenciado (`leading-[1.65]` a `1.75`), subtítulos com ancoragem clara | Contraste confortável (não use `#fff` puro sobre `#000` puro; prefira papel quente ou ardósia suave) |
| **4. Experience** *(Portfólios, Showcases, WebGL)* | Sentir imersão e memorabilidade | Assimetria editorial, sangria (*bleed*) até a borda da tela | Tipografia como elemento gráfico estrutural | Iluminação direcional, profundidade em camadas e coreografia de scroll |

---

## 2. Sistema de Cores Perceptual em OKLCH & Neutros Tonalizados

IAs geram interfaces "mortas" porque usam cinzas puros sem matiz (`#808080`, `gray-500`) combinados com gradientes saturados demais. O padrão **Impeccable** exige **neutros tonalizados (Tinted Neutrals)** no espaço **OKLCH**, onde a luminosidade (`L`) é perceptualmente uniforme:

```css
/* globals.css — Tokens Perceptuais OKLCH (Matiz 260 = Azul/Indigo Frio; Matiz 80 = Papel Quente) */
:root {
  --hue-brand: 255;

  /* Light Mode com Neutros Tonalizados Quentes */
  --surface-canvas: oklch(0.985 0.004 85);
  --surface-card: oklch(1 0 0);
  --surface-subtle: oklch(0.955 0.006 85);
  --border-hairline: oklch(0.20 0.01 255 / 0.08);
  --text-primary: oklch(0.18 0.015 255);
  --text-secondary: oklch(0.45 0.015 255);
  --accent-primary: oklch(0.55 0.19 var(--hue-brand));
}

.dark {
  /* Dark Mode com Neutros Tonalizados na Matiz da Marca (Nunca cinza chapado) */
  --surface-canvas: oklch(0.13 0.012 var(--hue-brand));
  --surface-card: oklch(0.17 0.014 var(--hue-brand));
  --surface-elevated: oklch(0.21 0.016 var(--hue-brand));
  --border-hairline: oklch(0.98 0.005 var(--hue-brand) / 0.09);
  --text-primary: oklch(0.96 0.005 var(--hue-brand));
  --text-secondary: oklch(0.68 0.012 var(--hue-brand));
  --accent-primary: oklch(0.68 0.17 var(--hue-brand));
}
```

---

## 3. Geometria Espacial, Raios Concêntricos & Anti "Card-in-Card"

### 3.1 Fórmula dos Raios Concêntricos (Concentric Border Radius)
Quando um elemento arredondado está dentro de um contêiner com `padding`, os raios **nunca** podem ser iguais (isso cria um calombo visual nos cantos). Aplique a fórmula matemática:

$$R_{\text{externo}} = R_{\text{interno}} + \text{Padding}$$

```tsx
// ✅ CORRETO: Interno (rounded-lg = 8px) + Padding (p-2 = 8px) = Externo (rounded-2xl = 16px)
<div className="p-2 rounded-2xl bg-zinc-900 border border-white/[0.08]">
  <div className="p-4 rounded-lg bg-zinc-950">
    Conteúdo com curvatura concêntrica perfeita
  </div>
</div>

// ❌ ERRADO: Pai e filho ambos com rounded-xl (cantos desarmônicos)
<div className="p-4 rounded-xl">
  <div className="p-4 rounded-xl">...</div>
</div>
```

### 3.2 Erradicação do "Card-Within-Card" (Distill)
- **Problema**: IAs colocam uma seção com borda, dentro dela um grid de cards com borda, e dentro do card sub-caixas com borda e fundo cinza.
- **Solução Impeccable**: Use **espaçamento (`gap`, `py`) e divisores de 1px (`divide-y divide-white/[0.06]`)** para agrupar informações. Reserve caixas fechadas (cards) apenas para itens que são unidades clicáveis ou arrastáveis independentes.

---

## 4. Vocabulário de Direção de Arte (Design Steering Directives)

Quando o usuário pedir ajustes ou durante o passe de refinamento, execute estas transformações exatas:

1. **`"Make it quieter"` (Acalmar a interface)**:
   - Reduza a opacidade de bordas para `border-white/[0.06]` (dark) ou `border-black/[0.06]` (light).
   - Remova sombras pesadas e gradientes de fundo; aumente o respiro (`py` e `gap`) em 25%.
   - Rebaixe badges secundários de cores saturadas para tons neutros monospaçados.
2. **`"Make it bolder"` (Aumentar impacto e autoridade)**:
   - Dobre a diferença de escala entre o título principal (`text-6xl` → `text-8xl`) e o corpo (`text-base`).
   - Aperte o tracking do display (`tracking-tighter`) e aumente o contraste de superfície.
3. **`"Distill"` (Destilar / Remover gordura visual)**:
   - Elimine wrappers, ícones decorativos redundantes, subtítulos óbvios e cards aninhados. Deixe apenas tipografia, dados e espaço negativo trabalhando.
4. **`"Polish"` (Polimento de acabamento)**:
   - Verifique raios concêntricos, adicione `tabular-nums` em números, garanta `active:scale-[0.98]` em botões, adicione `ring-1 ring-inset ring-white/10` em superfícies elevadas.
5. **`"Push into overdrive"` (Elevar para experiência assinatura)**:
   - Adicione micro-interações coreografadas, revelação progressiva, iluminação sutil em hover (radial-gradient acompanhando foco ou superfície) e detalhes de alta precisão técnica.

---

## Regras de Ouro

1. **Sempre** defina qual dos 4 modos (*Persuade, Operate, Read, Experience*) governa a tela antes de estilizar.
2. **Sempre** tonalize os cinzas/neutros com uma leve saturação em OKLCH (`0.005` a `0.015` de chroma) na matiz da marca.
3. **Sempre** calcule raios concêntricos ($R_{\text{out}} = R_{\text{in}} + P$) em contêineres aninhados.
4. **Nunca** empilhe mais de 2 níveis de caixas com borda (*card dentro de card dentro de card*).
5. **Nunca** use espaçamentos fora da grade base de 4px/8px.
6. **Sempre** passe o pente fino dos comandos *Distill* e *Polish* antes de dar a tarefa como concluída.

---

## Checklist (Pre-Delivery Design Hook)

- [ ] Modo de design (*Persuade / Operate / Read / Experience*) respeitado na densidade da página.
- [ ] Neutros possuem matiz sutil (OKLCH / zinc / slate intencional) em vez de cinza puro sem vida.
- [ ] Raios de borda externos e internos seguem a regra de concentricidade ($R_{\text{out}} = R_{\text{in}} + P$).
- [ ] Zero aninhamento excessivo de cards (*card-within-card bloat* eliminado).
- [ ] Escala tipográfica possui ritmo vertical claro, com `max-w-prose` (60-75ch) em blocos de leitura.
- [ ] Todos os números e métricas usam `tabular-nums`.

---

## Anti-padrões

- ❌ **Card-in-Card-in-Card**: Caixas com borda dentro de outras caixas com borda gerando poluição visual.
- ❌ **Cinzas Mortos (`#808080` / `#cccccc`)**: Ausência de temperatura de cor nos tons neutros.
- ❌ **Raios Idênticos Aninhados**: `rounded-xl` com `p-4` contendo outro `rounded-xl` (gera espessura diagonal desigual).
- ❌ **Densidade Trocada**: Usar espaçamento de landing page (*Persuade*) dentro de uma tabela operacional (*Operate*), obrigando o usuário a rolar 5 telas para ver 10 linhas.
- ❌ **Decorativismo Sem Função**: Glows neon e gradientes em telas de operação diária que causam fadiga ocular.

## Composição com skills

- **Antes**: `design-directions` · `ui-ux-pro-max`
- **Junto**: `emil-kowalski` · `design-taste` · `editorial-layout` · `frontend`
- **Depois**: `anti-ai-slop` · `accessibility-reviewer` · `qa`

## References

- `impeccable.style` — Documentação oficial do framework Impeccable (Paul Bakaus).
- Veja `references.md` nesta pasta para tabela de conversão OKLCH e diretrizes completas de modos.

> Gerado pelo Izanagi AI: cópia fiel de `skills/impeccable/SKILL.md` (fonte da verdade).
