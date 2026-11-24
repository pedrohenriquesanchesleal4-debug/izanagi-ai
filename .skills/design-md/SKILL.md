---
name: "design-md"
description: "Design system do projeto num DESIGN.md que o agente lê antes de qualquer tela (cores, tipografia, espaçamento, raio, componentes, tom). Cria a partir de referências reais (coleções como awesome-design-md de marcas conhecidas) ou do código existente, e faz toda UI nova obedecer a ele. Use ao iniciar um projeto visual, ao padronizar telas que divergiram ou quando o usuário mostrar uma marca de referência. Gatilhos de ativação: design.md: o design system que o agente consegue ler; quando usar; estrutura (máximo ~120 linhas); princípios (3 frases)."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# DESIGN.md: o design system que o agente consegue ler

> Migrado deterministicamente de `skills/design-md/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Design system do projeto num DESIGN.md que o agente lê antes de qualquer tela (cores, tipografia, espaçamento, raio, componentes, tom). Cria a partir de referências reais (coleções como awesome-design-md de marcas conhecidas) ou do código existente, e faz toda UI nova obedecer a ele.
- **Ativar quando:** Use ao iniciar um projeto visual, ao padronizar telas que divergiram ou quando o usuário mostrar uma marca de referência.
- **Escopo canônico:** DESIGN.md: o design system que o agente consegue ler
- **Seções do corpo original:** Quando usar · Estrutura (máximo ~120 linhas) · Princípios (3 frases) · Cor        tokens semânticos em OKLCH ou hex: bg, surface, text, muted, accent, danger; modo escuro se houver · Tipografia display e texto (família, pesos), escala (ex.: 12/14/16/20/28/40/56), entrelinha
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — De uma referência:

**De uma referência:** pegue o DESIGN.md da marca citada (ou extraia: cores e fontes do CSS público, espaçamentos medidos em print). Não copie a marca; adapte os princípios ao nicho do projeto e troque cor de acento e tipografia display.

### Passo 2 — Do código existente:

**Do código existente:** `rg -o "#[0-9a-fA-F]{6}|oklch\([^)]*\)" src | sort | uniq -c | sort -rn | head -30` e o mesmo para `font-family`, `rounded-`, `gap-`. Consolide os valores mais usados; o resto vira dívida listada.

### Passo 3 — Gere os tokens no formato do projeto (tailwind.config/@theme, CSS variables) a partir d...

Gere os tokens no formato do projeto (`tailwind.config`/`@theme`, CSS variables) a partir do DESIGN.md, não o contrário.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:design -->

- Comparar o artefato com a direção de design acordada (paleta, tipografia, layout, motion) item a item.
- Executar auditoria anti-AI-slop: zero tells da lista de Red Flags presentes.
- Verificar estados interativos (hover/focus/error/loading) e contraste WCAG AA nos componentes tocados.
- Registrar screenshots/evidência do estado final para revisão.

## Common Rationalizations

- **"Design system a gente monta depois do launch."**
  - Verdade: Sem tokens decididos antes, cada componente nasce com escala própria e o 'depois' vira reescrita total. Direção de design primeiro é HARD-GATE do framework, não preferência.
- **"Inter serve, é neutra."**
  - Verdade: Inter default é o tell nº 1 de 'cara de IA'. Tipografia é decisão de identidade; neutra aqui significa sem intenção — e sem intenção é proibido.
- **"Responsivo eu ajusto no final, primeiro o desktop."**
  - Verdade: Layout pensado só em desktop quebra estruturalmente no mobile: grid, hierarquia e touch targets não se 'ajustam', se redesenham. Mobile-first é mais barato desde a primeira linha.
- **"Acessibilidade a gente adiciona quando tiver demanda."**
  - Verdade: Contraste, foco visível e ARIA são requisitos WCAG, não feature request. Retrofitar acessibilidade custa ordens de magnitude mais que nascer com ela.
- **"O cliente pediu hero com 3 cards, é isso que ele conhece."**
  - Verdade: O cliente pediu resultado, não template estatístico. Cabe ao craft traduzir o pedido em composição com identidade — hero+3cards+gradiente roxo é anti-padrão explícito do framework.
- **"Animação entra no fim, se sobrar tempo."**
  - Verdade: Motion signature decide-se no design, não decorase no deploy. Animação adicionada tarde é ornamento; planejada cedo é comunicação de hierarquia e estado.

## Red Flags

- Hero centralizado + fileira de 3 cards idênticos (composição estatística de IA).
- Gradiente roxo-azul como identidade visual principal.
- border-radius uniforme em todos os elementos, sem hierarquia formal.
- Contraste abaixo de WCAG AA em texto primário.
- Sem estados hover/focus/loading/error definidos nos componentes interativos.
- Tipografia default sem escolha declarada (peso, escala, par de fontes).
- Motion decorativo aleatório em vez de 1–2 momentos-chave com assinatura.

## Legacy Reference (v1)

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
