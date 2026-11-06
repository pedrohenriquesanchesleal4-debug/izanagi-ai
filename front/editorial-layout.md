---
name: editorial-layout
description: "Layout editorial e revista para web: quebra intencional de grid, tipografia assimétrica, elementos em sangria (bleed), pull-quotes e composições não baseadas em cards."
triggers:
  - "estruturar landing page, portfólio ou página de conteúdo com estética editorial"
  - "fugir do layout clichê de hero centralizado com 3 cards"
  - "diagramar páginas com textos longos que exigem ritmo visual dinâmico"
stack: [react, nextjs, tailwind-css, css-grid]
---

# Editorial Layout — Grids Assimétricos & Composição de Revista

Esta skill ensina a projetar interfaces como um diretor de arte de revista impressa: a grade existe como fundação estrutural, mas é deliberadamente rompida para criar ritmo narrativo, contraste e dinamismo visual.

---

## 1. Os 4 Pilares da Composição Editorial

1. **Peso Tipográfico Assimétrico**:
   - Um título monumental (80px a 160px) posicionado ao lado de um bloco de texto compacto e elegante (14px). A dissonância de escala força o olho a focar na mensagem-chave.
2. **Espaço em Branco como Objeto Concreto**:
   - O vazio não é espaço desperdiçado — é uma pausa dramática que valoriza a imagem ou citação adjacente.
3. **Quebra de Grade com Propósito (Bleed Elements)**:
   - Uma imagem que sangra além da margem do contêiner e toca o limite físico da tela (`w-screen -mx-[calc((100vw-100%)/2)]`), enquanto o texto permanece perfeitamente alinhado à grade.
4. **Composição Não-Card**:
   - Substitua cards retangulares repetitivos por:
     - Linhas divisórias editoriais (`border-t border-zinc-800 py-8`) com números ordinais (`01`, `02`, `03`).
     - Tabelas tipográficas limpas.
     - Citações em destaque cruzando colunas (*Pull-Quotes*).

---

## 2. Padrões de Código para Grid Editorial

### 2.1 Grade Base de 12 Colunas com Bleed
```tsx
export function EditorialSection() {
  return (
    <section className="max-w-7xl mx-auto px-6 py-24">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Título Assimétrico em 7 Colunas */}
        <div className="lg:col-span-7">
          <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
            01 / Manifesto
          </span>
          <h2 className="mt-4 font-serif text-5xl md:text-7xl font-normal leading-tight tracking-tight text-zinc-100">
            A forma segue a <span className="italic">intenção</span>, não o atalho do algoritmo.
          </h2>
        </div>

        {/* Bloco de Texto Compacto em 5 Colunas com Respiro */}
        <div className="lg:col-span-5 lg:pt-16 space-y-6 text-zinc-400 text-base leading-relaxed">
          <p>
            Interfaces que convertem não são montagens pré-fabricadas de componentes idênticos.
            Cada ponto de contato exige um peso ótico singular.
          </p>
          <div className="pt-4 border-t border-zinc-800 flex justify-between items-center text-sm font-mono">
            <span>TEMPO DE LEITURA</span>
            <span className="text-zinc-200">3 MIN</span>
          </div>
        </div>

      </div>
    </section>
  );
}
```

### 2.2 Pull-Quote Editorial (Citação que Cruza a Página)
```tsx
export function PullQuote({ quote, author }: { quote: string; author: string }) {
  return (
    <figure className="my-20 py-12 border-y border-zinc-800 text-center max-w-4xl mx-auto">
      <blockquote className="font-serif italic text-3xl md:text-5xl text-zinc-200 leading-snug">
        “{quote}”
      </blockquote>
      <figcaption className="mt-6 font-mono text-xs uppercase tracking-widest text-zinc-500">
        — {author}
      </figcaption>
    </figure>
  );
}
```

### 2.3 Lista Editorial Numerada (Substituindo Cards de Features)
```tsx
export function FeatureList({ items }: { items: { number: string; title: string; desc: string }[] }) {
  return (
    <div className="divide-y divide-zinc-800 border-y border-zinc-800">
      {items.map((item) => (
        <div key={item.number} className="py-10 grid grid-cols-1 md:grid-cols-12 gap-6 items-baseline group hover:bg-zinc-900/40 transition-colors">
          <span className="md:col-span-2 font-mono text-sm text-zinc-500 group-hover:text-zinc-200 transition-colors">
            {item.number}
          </span>
          <h3 className="md:col-span-4 text-2xl font-medium text-zinc-100 tracking-tight">
            {item.title}
          </h3>
          <p className="md:col-span-6 text-zinc-400 text-sm leading-relaxed">
            {item.desc}
          </p>
        </div>
      ))}
    </div>
  );
}
```

---

## 3. Checklist de Composição Editorial

- [ ] A página apresenta pelo menos uma quebra de simetria intencional (ex: split 7/5 ou elemento sangrado).
- [ ] Features são apresentadas com variedade visual (listas tipográficas, tabelas ou pull-quotes) em vez de apenas cards 3x3.
- [ ] A hierarquia tipográfica possui contraste dramático entre títulos e corpo.
- [ ] O espaço em branco é utilizado para conferir dignidade e foco ao conteúdo central.
