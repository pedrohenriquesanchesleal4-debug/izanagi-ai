---
name: "emil-kowalski"
description: "Design Engineering e física de interfaces ('Agents with Taste' de Emil Kowalski — Vercel/Linear/Sonner/Vaul): micro-interações rápidas (140-220ms), curvas ease-out físicas, proibição de scale(0), transform-origin contextual, bordas semitransparentes hairline, quando NÃO animar e escolha de primitivos acessíveis. Use em toda implementação ou revisão de UI e animações. Gatilhos de ativação: emil kowalski — agents with taste & design engineering; quando usar; 1. as 7 leis da física de ui (`animate` & `review-animations`); 2. acabamento de superfície: bordas semitransparentes & sombras (`emil-design-eng`)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Emil Kowalski — Agents with Taste & Design Engineering

> Migrado deterministicamente de `skills/emil-kowalski/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Design Engineering e física de interfaces ('Agents with Taste' de Emil Kowalski — Vercel/Linear/Sonner/Vaul): micro-interações rápidas (140-220ms), curvas ease-out físicas, proibição de scale(0), transform-origin contextual, bordas semitransparentes hairline, quando NÃO animar e escolha de primitivos acessíveis.
- **Ativar quando:** Use em toda implementação ou revisão de UI e animações.
- **Escopo canônico:** Emil Kowalski — Agents with Taste & Design Engineering
- **Seções do corpo original:** Quando usar · 1. As 7 Leis da Física de UI (`animate` & `review-animations`) · 2. Acabamento de Superfície: Bordas Semitransparentes & Sombras (`emil-design-eng`) · Regras de Ouro · Checklist (`review-animations` & `emil-design-eng`)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Nunca anime entradas a partir de scale(0); use sempre scale(0.95)–scale(0.97).

**Nunca** anime entradas a partir de `scale(0)`; use sempre `scale(0.95)`–`scale(0.97)`.

### Passo 2 — Sempre use curvas ease-out ([0.16, 1, 0.3, 1]) para elementos que entram na tela.

**Sempre** use curvas `ease-out` (`[0.16, 1, 0.3, 1]`) para elementos que entram na tela.

### Passo 3 — Sempre mantenha micro-interações de UI abaixo de 220ms (saídas ainda mais rápidas:

**Sempre** mantenha micro-interações de UI abaixo de `220ms` (saídas ainda mais rápidas: `130-150ms`).

### Passo 4 — Nunca anime ações repetitivas de teclado (navegação ↑/↓ em listas ou command palettes).

**Nunca** anime ações repetitivas de teclado (navegação `↑/↓` em listas ou command palettes).

### Passo 5 — Sempre defina transform-origin apontando para o gatilho que abriu o popover/menu.

**Sempre** defina `transform-origin` apontando para o gatilho que abriu o popover/menu.

### Passo 6 — Sempre prefira bordas translúcidas (white/[0.08] ou black/[0.06]) e tabular-nums em con...

**Sempre** prefira bordas translúcidas (`white/[0.08]` ou `black/[0.06]`) e `tabular-nums` em contadores.

### Passo 7 — Sempre respeite @media (prefers-reduced-motion:

**Sempre** respeite `@media (prefers-reduced-motion: reduce)` desativando deslocamentos espaciais.

---

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Nenhum elemento inicia animação em `scale(0)`.
- [ ] Entradas usam `ease-out` rápido (`140-220ms`), sem `ease-in` nem `linear`.
- [ ] Popovers, dropdowns e tooltips possuem `transform-origin` contextualizado no botão de origem.
- [ ] Botões possuem feedback tátil `:active` (`active:scale-[0.97]`) sem causar layout shift.
- [ ] Bordas usam transparência perceptual (`border-white/[0.08]` / `border-black/[0.06]`) em vez de hex cinza chapado.
- [ ] Navegação por teclado de alta frequência responde instantaneamente sem lag de animação.
- [ ] Fallback `prefers-reduced-motion` implementado.

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

# Emil Kowalski — Agents with Taste & Design Engineering

Skill que codifica as heurísticas práticas de **Emil Kowalski** (`emilkowalski/skills` · autor de *Sonner* e *Vaul*, Design Engineer na Vercel/Linear). O objetivo é impedir os erros clássicos de baixo craft cometidos por LLMs (como animar entradas com `ease-in`, escalar a partir de `scale(0)`, usar durações lentas de `500ms` em controles de UI ou desenhar bordas opacas duras).

## Quando usar

Use ao **construir, animar ou revisar qualquer componente de interface** (botões, dropdowns, popovers, modais, drawers, toasts, command palettes, tabs e formulários) em React, Next.js, Tailwind ou React Native/Expo.

**Pule** para lógica puramente algorítmica de servidor sem impacto visual ou interativo.

---

## 1. As 7 Leis da Física de UI (`animate` & `review-animations`)

### Lei 1: Nunca inicie entradas em `scale(0)`
Nada no mundo físico surge do zero absoluto. Iniciar um modal, popover ou ícone em `scale(0)` cria um efeito artificial de "explosão".
- **Regra**: Sempre inicie entradas com **`scale(0.95)` a `scale(0.97)`** combinado com `opacity: 0`.

```tsx
// ✅ CORRETO (Emil Kowalski Standard)
<motion.div
  initial={{ opacity: 0, scale: 0.96, y: 4 }}
  animate={{ opacity: 1, scale: 1, y: 0 }}
  exit={{ opacity: 0, scale: 0.97, y: 2 }}
  transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
/>

// ❌ PROIBIDO: Elemento nascendo do nada com scale(0) e duração lenta
<motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.5 }} />
```

### Lei 2: Curvas de Easing por Direção de Movimento
- **Entradas (Elementos aparecendo na tela)**: Devem desacelerar até parar (**`ease-out`**). Use curvas exponenciais customizadas:
  - `cubic-bezier(0.16, 1, 0.3, 1)` ou `cubic-bezier(0.22, 1, 0.36, 1)`
  - **NUNCA** use `ease-in` ou `linear` em um elemento que está entrando (faz a interface parecer atrasada e pesada no início do clique).
- **Saídas (Elementos fechando)**: Devem ser mais rápidas que a entrada (`120ms` a `150ms`) para não bloquear a visão do usuário.
- **Movimento de elemento já visível na tela (Morph / Layout)**: Use `ease-in-out` ou física de mola (`spring` com `bounce: 0.1` a `0.15`).

### Lei 3: Durações Rápidas para Controles de UI (140ms – 220ms)
Animações de interface devem parecer instantâneas e responsivas:
- **Hover / Active em botões e links**: `120ms – 150ms`
- **Dropdowns, Tooltips, Popovers**: `140ms – 180ms`
- **Modais, Drawers, Toasts**: `180ms – 240ms`
- **Regra**: Se uma interação padrão de UI demora mais de `300ms`, ela está lenta demais e prejudica a percepção de performance.

### Lei 4: `transform-origin` Contextual Obrigatório
Um menu ou popover deve crescer **a partir do botão que o abriu**, nunca do centro do nada:
```css
/* Radix UI / Base UI — Ancoragem automática à origem do trigger */
.popover-content {
  transform-origin: var(--radix-popover-content-transform-origin);
}
```

### Lei 5: Quando NÃO Animar (`find-animation-opportunities`)
A marca de um grande Design Engineer é saber onde **não** colocar animação:
- **Ações de alta frequência via teclado**: Navegar com setas `↑/↓` numa Command Palette (`Cmd+K`), alternar itens de menu ou digitar **NÃO deve ter transição de delay**. A mudança de seleção deve ser imediata (`0ms` ou `<50ms`).
- **Carregamento inicial da página de trabalho (Dashboards)**: Não force o usuário que abre o app 20 vezes por dia a assistir uma animação de entrada de 1 segundo nos dados principais.

### Lei 6: Feedback Tátil em Controles (`emil-design-eng`)
Todo botão ou card interativo precisa confirmar fisicamente o clique:
```tsx
<button className="transition-transform duration-150 ease-out active:scale-[0.97] will-change-transform">
  Salvar Alterações
</button>
```

### Lei 7: Apenas Propriedades Compostas da GPU
Anime estritamente `transform` (`translate3d`, `scale`, `rotate`), `opacity`, `filter` e `clip-path`. Jamais anime `height`, `width`, `top`, `left`, `padding` ou `margin` diretamente.

---

## 2. Acabamento de Superfície: Bordas Semitransparentes & Sombras (`emil-design-eng`)

### 2.1 Bordas Hairline com `background-clip: padding-box`
Bordas sólidas em hexadecimal (`border: 1px solid #e5e7eb`) falham quando sobrepostas a fundos variados ou imagens. Use bordas semitransparentes ou `box-shadow` de anel:

```css
/* Light Mode: sombra multicamada + borda hairline translúcida */
.card-light {
  background: #ffffff;
  background-clip: padding-box;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.06),
    0 2px 4px rgba(0, 0, 0, 0.04),
    0 8px 16px -4px rgba(0, 0, 0, 0.06);
}

/* Dark Mode: borda interna luminosa (inner highlight) + sombra profunda */
.card-dark {
  background: #141417;
  box-shadow:
    inset 0 1px 0 0 rgba(255, 255, 255, 0.08),
    0 0 0 1px rgba(255, 255, 255, 0.07),
    0 12px 24px -6px rgba(0, 0, 0, 0.5);
}
```

### 2.2 Seleção de Bibliotecas Confiáveis (`pick-ui-library`)
Nunca recrie do zero primitivos complexos de acessibilidade (modais sem focus trap, toasts sem empilhamento, drawers sem física de gesto):
- **Primitivos Acessíveis**: `@radix-ui/react-*` ou `@base-ui-components/react`
- **Toasts**: `sonner`
- **Drawers Mobile-like**: `vaul`
- **Command Palette**: `cmdk`
- **Animações React**: `motion/react` (Framer Motion v12+)

---

## Regras de Ouro

1. **Nunca** anime entradas a partir de `scale(0)`; use sempre `scale(0.95)`–`scale(0.97)`.
2. **Sempre** use curvas `ease-out` (`[0.16, 1, 0.3, 1]`) para elementos que entram na tela.
3. **Sempre** mantenha micro-interações de UI abaixo de `220ms` (saídas ainda mais rápidas: `130-150ms`).
4. **Nunca** anime ações repetitivas de teclado (navegação `↑/↓` em listas ou command palettes).
5. **Sempre** defina `transform-origin` apontando para o gatilho que abriu o popover/menu.
6. **Sempre** prefira bordas translúcidas (`white/[0.08]` ou `black/[0.06]`) e `tabular-nums` em contadores.
7. **Sempre** respeite `@media (prefers-reduced-motion: reduce)` desativando deslocamentos espaciais.

---

## Checklist (`review-animations` & `emil-design-eng`)

- [ ] Nenhum elemento inicia animação em `scale(0)`.
- [ ] Entradas usam `ease-out` rápido (`140-220ms`), sem `ease-in` nem `linear`.
- [ ] Popovers, dropdowns e tooltips possuem `transform-origin` contextualizado no botão de origem.
- [ ] Botões possuem feedback tátil `:active` (`active:scale-[0.97]`) sem causar layout shift.
- [ ] Bordas usam transparência perceptual (`border-white/[0.08]` / `border-black/[0.06]`) em vez de hex cinza chapado.
- [ ] Navegação por teclado de alta frequência responde instantaneamente sem lag de animação.
- [ ] Fallback `prefers-reduced-motion` implementado.

---

## Anti-padrões

- ❌ **Entrada com `ease-in`**: Começa devagar e termina seco, dando sensação de clique quebrado.
- ❌ **Duração de `500ms+` em Dropdown/Modal**: Faz o usuário esperar a UI terminar de animar para poder clicar.
- ❌ **`scale(0)` em Popovers**: Efeito "balão inflando" amador.
- ❌ **Animar `height: auto` via CSS puro sem FLIP/Motion**: Provoca recálculo de layout a cada frame.
- ❌ **Reinventar Modal/Toast sem A11y**: Criar `<div onClick>` sem gerenciamento de foco, tecla `ESC` ou portal.

## Composição com skills

- **Antes**: `impeccable` · `ui-ux-pro-max`
- **Junto**: `motion-design` · `design-taste` · `frontend`
- **Depois**: `anti-ai-slop` · `accessibility-reviewer` · `qa`

## References

- `https://emilkowal.ski/ui/agents-with-taste` — Artigo *Agents with Taste* (Emil Kowalski).
- `https://github.com/emilkowalski/skills` — Repositório oficial `emilkowalski/skills`.
- Veja `references.md` nesta pasta para tabela de curvas bezier e springs.
