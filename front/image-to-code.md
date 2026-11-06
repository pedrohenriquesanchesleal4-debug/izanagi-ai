---
name: image-to-code
description: "Protocolo determinístico de conversão de mockups, capturas de tela (screenshots) e referências visuais em código React/Tailwind limpo, semântico e pixel-perfect."
triggers:
  - "converter imagem, screenshot ou mockup do Figma em código de interface"
  - "clonar visual de referência a partir de captura visual"
  - "reconstruir telas existentes mantendo fidelidade de proporção e cores"
stack: [react, nextjs, tailwind-css, typescript]
---

# Image to Code — Engenharia Reversa Visual & Fidelidade de Design

Esta skill estabelece o processo analítico e determinístico para traduzir qualquer referência visual em código React moderno sem atalhos, sem stubs vazios e com alta fidelidade de proporção.

---

## 1. O Protocolo de Decomposição Visual em 4 Etapas

### Etapa 1: Análise Macro (Topologia & Grid)
- **Classifique a Estrutura da Página**:
  - *Navbar*: Fixa (`sticky top-0 z-50 backdrop-blur-md`) ou estática; seções de logo, links centrais e CTAs à direita.
  - *Zona Hero*: Split 50/50, centralizado com headline display, ou bento grid assimétrico.
  - *Container de Largura*:
    - Dashboard/SaaS: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`
    - Leitura/Artigo: `max-w-3xl mx-auto px-4`
    - Full-width imersivo: `w-full` com padding adaptativo.

### Etapa 2: Extração de Cores e Tokens
- Isole a cor de fundo dominante (evite cinza chapado): identifique se é Dark OLED (`#09090b`), off-white quente (`#fbfbfa`) ou slate neutro.
- Mapeie o acento primário (apenas 1 tom de destaque) e o nível de transparência das bordas (`border-white/10` em dark mode).

### Etapa 3: Inferência de Tipografia e Escala
- Observe o contraste entre títulos e corpo:
  - Se os títulos têm letras com cantos pontiagudos ou geométricos: identifique famílias como `Space Grotesk`, `Geist Sans` ou `Inter Tight`.
  - Se possuem serifas editoriais refinadas: identifique `Instrument Serif` ou `Fraunces`.
  - Estipule tracking negativo (`tracking-tight`) em títulos acima de 32px.

### Etapa 4: Decomposição em Componentes Reais
- **Proibição Absoluta de Stubs**: Nunca entregue `TODO: implement later` ou caixas vazias sem conteúdo. Reconstrua cada botão, tag, avatar e texto com dados simulados realistas.

---

## 2. Padrões de Reconstrução Comuns

### 2.1 Bento Grid Assimétrico (Padrão Apple & Vercel)
```tsx
export function BentoGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-6xl mx-auto">
      {/* Card Grande Ocupando 2 Colunas */}
      <div className="md:col-span-2 p-8 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between overflow-hidden relative group">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-emerald-400">
            Performance em Tempo Real
          </span>
          <h3 className="text-3xl font-bold tracking-tight text-white mt-2">
            Latência global inferior a 15ms.
          </h3>
          <p className="text-zinc-400 text-sm mt-3 max-w-md">
            Distribuído em 300+ edge locations ao redor do globo.
          </p>
        </div>
        <div className="mt-8 h-48 rounded-xl bg-zinc-950 border border-zinc-800/80 p-4 font-mono text-xs text-zinc-500">
          {/* Mockup visual de console ou gráfico */}
          <code>$ ping edge.network.global... 12ms [OK]</code>
        </div>
      </div>

      {/* Card Compacto em 1 Coluna */}
      <div className="p-8 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col justify-between">
        <div>
          <span className="text-xs font-mono uppercase tracking-wider text-cyan-400">
            Segurança Zero-Trust
          </span>
          <h3 className="text-2xl font-bold tracking-tight text-white mt-2">
            Isolamento de Tenant
          </h3>
          <p className="text-zinc-400 text-sm mt-3">
            Criptografia ponta a ponta com chaves KMS dedicadas.
          </p>
        </div>
        <div className="mt-6 flex items-center gap-2 text-sm text-zinc-300 font-medium">
          <span>Saiba mais</span>
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </div>
      </div>
    </div>
  );
}
```

---

## 3. Checklist de Fidelidade Image-to-Code

- [ ] A proporção geral de layout (larguras, alturas, alinhamentos) coincide com a imagem de referência.
- [ ] O contraste tonal e as cores extraídas são fieis à imagem original.
- [ ] O código é completamente funcional, componentizado e responsivo em smartphones e tablets.
- [ ] Não existem textos temporários genéricos ou placeholders inacabados.
