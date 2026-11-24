---
name: design-md
description: "Design system do projeto num DESIGN.md que o agente lê antes de qualquer tela… Use ao iniciar um projeto visual, ao padronizar telas que divergiram ou quando o…"
---

# DESIGN.md: o design system que o agente consegue ler

Agente sem design system escolhe cor e fonte a cada tela, e cada tela sai de um jeito. Um `DESIGN.md` na raiz resolve: é curto, versionado e lido antes de codar. Coleções públicas (como `awesome-design-md`) reúnem DESIGN.md extraídos de marcas reais e servem de ponto de partida.

## Quando usar

- Projeto visual novo, logo depois de escolher a direção (`design-directions`).
- Usuário cita uma marca de referência ("quero algo com a cara do Linear").
- Telas existentes divergiram entre si.

## Estrutura (máximo ~120 linhas)

```markdown
# DESIGN.md · <Projeto>

## Princípios (3 frases)
## Cor        tokens semânticos em OKLCH ou hex: bg, surface, text, muted, accent, danger; modo escuro se houver
## Tipografia display e texto (família, pesos), escala (ex.: 12/14/16/20/28/40/56), entrelinha
## Espaço     escala fixa (4, 8, 12, 16, 24, 32, 48, 64) e largura máxima de conteúdo
## Forma      raios, bordas, sombras (no máximo 2 níveis)
## Movimento  durações (120/180/300ms), curvas, o que anima e o que não anima
## Componentes botão, input, card, navegação: estados default/hover/focus/active/disabled
## Voz        como os textos soam; 3 exemplos bons, 3 proibidos
## Não fazer  lista curta do que quebra a identidade
```

## Como criar

1. **De uma referência:** pegue o DESIGN.md da marca citada (ou extraia: cores e fontes do CSS público, espaçamentos medidos em print). Não copie a marca; adapte os princípios ao nicho do projeto e troque cor de acento e tipografia display.
2. **Do código existente:** `rg -o "#[0-9a-fA-F]{6}|oklch\([^)]*\)" src | sort | uniq -c | sort -rn | head -30` e o mesmo para `font-family`, `rounded-`, `gap-`. Consolide os valores mais usados; o resto vira dívida listada.
3. Gere os tokens no formato do projeto (`tailwind.config`/`@theme`, CSS variables) a partir do DESIGN.md, não o contrário.

## Como aplicar

- Antes de criar ou editar UI: leia `DESIGN.md`. Valor fora do sistema exige justificativa no PR.
- Ao terminar: confira se surgiram cores, tamanhos ou raios novos (`rg` acima) e ou atualize o DESIGN.md ou troque pelo token.

> Gerado pelo Izanagi AI: cópia fiel de `skills/design-md/SKILL.md` (fonte da verdade).
