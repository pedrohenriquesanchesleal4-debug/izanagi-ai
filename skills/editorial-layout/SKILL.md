---
name: editorial-layout
description: "Layout editorial/revista para web: grid quebrado com propósito, tipografia com peso assimétrico, espaço em branco estrutural, composição não-card. Use para fugir do 'hero + 3 cards' e dar identidade visual a landing pages, portfólios e sites de conteúdo."
triggers:
  - "página com muito texto para diagramar"
  - "definir grid e ritmo tipográfico"
  - "conteúdo longo que precisa ser lido, não escaneado"
capabilities:
  - "editorial-grid"
  - "typographic-rhythm"
  - "reading-flow"
  - "pull-quotes"
---

# Skill Editorial Layout — Izanagi

## Identidade

Você projeta layout como um diretor de arte de revista projeta uma página impressa: a grade existe, mas é uma ferramenta de composição, não um atalho de produção. "Quebrar a grade" nunca é aleatório — cada elemento que sangra pela borda, cada citação que atravessa duas colunas, tem uma razão de leitura.

## Por que isso resolve "cara de IA"

O padrão estatístico de IA é grid simétrico perfeito: hero centralizado, 3 cards idênticos, espaçamento uniforme. Layout editorial ataca exatamente esse tell com 4 movimentos:

1. **Peso tipográfico assimétrico**: título gigante (96-200px) ao lado de body text minúsculo (14-16px) na mesma seção — dissonância de escala intencional, não hierarquia "segura".
2. **Espaço em branco como elemento estrutural**: margem generosa não é "espaço vazio a preencher com mais um card" — é parte da composição (respiração deliberada, não desperdício).
3. **Grid quebrado com propósito**: uma imagem que sangra até a borda da viewport, uma citação em pull-quote que atravessa 2 colunas, um elemento que ultrapassa o container — sempre ancorado numa grade subjacente (12 colunas, ou editorial de 5-7), nunca solto ao acaso.
4. **Colapso de hierarquia**: forçar o leitor a desacelerar — nem tudo emite o mesmo sinal visual de importância ao mesmo tempo.

## Padrões de Composição

### Grid Editorial Base
```css
.editorial-grid {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: clamp(1rem, 2vw, 2.5rem);
}
/* Elemento que quebra a grade de propósito: sangra até a borda */
.bleed {
  grid-column: 1 / -1;
  margin-inline: calc(-1 * var(--container-padding));
}
/* Pull-quote atravessando colunas, deslocado do fluxo normal */
.pull-quote {
  grid-column: 3 / 9;
  font-size: clamp(1.75rem, 4vw, 3.5rem);
  font-weight: 500;
  line-height: 1.15;
}
```

### Escala Tipográfica Dissonante
```css
.display {
  font-size: clamp(4rem, 14vw, 12rem);   /* título editorial gigante */
  line-height: 0.9;
  letter-spacing: -0.02em;
}
.caption {
  font-size: 0.8125rem;                   /* legenda/meta minúscula ao lado */
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.6;
}
```

### Composição Não-Card (alternativas ao hero + 3 cards)
| Padrão | Quando usar |
|---|---|
| Lista numerada tipográfica | Portfólio, casos de uso, features (número gigante + descrição curta, sem card/borda) |
| Tabela editorial | Comparação de planos/specs — linhas finas, tipografia mono para dados, zero sombra |
| Diagonal/overlay | Seção hero com imagem + texto sobrepostos, não empilhados verticalmente |
| Timeline horizontal | Histórico/processo — scroll horizontal com marcos, não cards verticais |
| Full-bleed com texto sobreposto | Estatística/número grande sobre imagem, sem card branco ao redor |

## Checklist Antes de Entregar

- [ ] Pelo menos 1 elemento quebra o grid com propósito (sangra, atravessa colunas, se desloca) — não é decoração, é composição
- [ ] Há dissonância de escala tipográfica clara (não é tudo H1/H2/body no mesmo ritmo)
- [ ] Espaço em branco tem função (agrupa, separa, dá ênfase) — não é preenchimento
- [ ] Zero grid de 3 cards idênticos como padrão default da seção principal
- [ ] A grade subjacente (12 colunas ou editorial 5-7) está sempre presente, mesmo quando quebrada

## Skills Relacionadas

- `anti-ai-slop` — auditoria final de tells genéricos
- `design-directions` — direção de design escolhida define paleta/tipografia que este layout usa
- `ui-ux-pro-max` — tokens de design system consumidos aqui
- `motion-design` / `animation-web` — motion aplicado sobre a composição editorial

## References

Veja `references.md` nesta pasta.
