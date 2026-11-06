---
name: design-taste
description: "Microdecisões de design engineering de alto nível: tracking óptico, alinhamento visual, ritmo espacial de tensão e respiro, e eliminação de inconsistências perceptuais."
triggers:
  - "refinar acabamento visual de componentes e páginas"
  - "ajustar tracking, leading e hierarquia tipográfica"
  - "corrigir alinhamentos ópticos e estados táteis de botões"
stack: [design-taste, visual-refinement, typography, micro-interactions]
---

# Design Taste — Refinamento Visual & Microdecisões de Design

A diferença entre uma interface medíocre de IA e um produto premiado reside nas **microdecisões ópticas**. O olho humano percebe proporção, tensão e equilíbrio geométrico antes de processar qualquer conteúdo.

---

## 1. Regras Ópticas de Tipografia

### 1.1 Leading (Line-Height) Proporcional
- **Display & Títulos Gigantes (40px a 120px)**:
  - ❌ **Erro de IA**: Deixar o line-height padrão de 1.5 em títulos enormes, criando buracos gigantescos entre as linhas.
  - ✅ **Regra**: Títulos de grande porte exigem `leading-[0.95]` a `leading-[1.05]` (`leading-none` ou `leading-tight`).
- **Corpo de Texto (14px a 18px)**:
  - Exige `leading-relaxed` (1.5 a 1.6) para permitir que a vista deslize suavemente para a linha seguinte.

### 1.2 Tracking (Letter-Spacing) Dinâmico
- **Títulos Display**:
  - Aplique tracking negativo progressivo conforme o tamanho da fonte aumenta: `tracking-tight` (-0.02em) ou `tracking-tighter` (-0.04em). Fontes grandes sem tracking negativo parecem desconectadas e espalhadas.
- **Labels, Badges e Caixa-Alta (Uppercase)**:
  - Todo texto em `uppercase` com tamanho menor que 13px DEVE obrigatoriamente usar tracking positivo: `tracking-wider` ou `tracking-widest` (+0.05em a +0.1em). Sem isso, as letras em caixa alta colapsam e tornam-se ilegíveis.

---

## 2. Alinhamento Óptico vs Alinhamento Matemático

1. **O Efeito Ícone de Play**:
   - Um triângulo de "Play" centralizado matematicamente dentro de um círculo aparenta estar caído para a esquerda porque sua massa visual está à esquerda.
   - **Fix**: Adicione um deslocamento óptico sutil para a direita (`translate-x-0.5`).
2. **Campos de Texto com Ícones**:
   - O ícone à esquerda do input deve respeitar o peso óptico do texto. Use ícones com espessura de traço (`stroke-width`) coincidente com o peso da fonte (1.5px ou 2px).
3. **Badges e Pílulas Verticais**:
   - A altura de um badge deve ter padding vertical ligeiramente menor que o horizontal (ex: `px-2.5 py-0.5 text-xs`).

---

## 3. Ritmo Espacial: Tensão vs Respiro

- **Proximidade Semântica**:
  - Elementos relacionados devem estar próximos (`gap-1.5` a `gap-2`).
  - Um título e seu parágrafo descritivo formam um grupo:
    ```tsx
    <div className="space-y-2">
      <h3 className="text-xl font-semibold tracking-tight text-zinc-100">Armazenamento Criptografado</h3>
      <p className="text-sm text-zinc-400 leading-relaxed">Seus dados são protegidos com chaves AES-256 em repouso e em trânsito.</p>
    </div>
    ```
- **Respiro Entre Seções**:
  - Não tenha medo de espaços em branco vazios. Seções de marketing de alta qualidade respiram com `py-24` a `py-36`. Seções comprimidas parecem panfletos promocionais baratos.

---

## 4. Tonalidade de Cores e Bordas Vivas

- **Bordas em Dark Mode**:
  - Nunca use cinzas opacos grossos (`border-zinc-700`).
  - Use transparências de branco sobre a base escura: `border border-white/[0.08]` ou `border border-white/[0.12]`. Elas reagem dinamicamente à cor de fundo, criando um efeito de luz suave.
- **Hierarquia de Texto sem Preto Puro**:
  - No tema claro, substitua `#000000` por `#09090b` ou `#18181b` para eliminar o corte agressivo de contraste que cansa os olhos.

---

## 5. Checklist de Taste

- [ ] Títulos grandes utilizam tracking negativo (`tracking-tight`) e leading comprimido.
- [ ] Textos pequenos em caixa alta utilizam tracking expandido (`tracking-wider`).
- [ ] Ícones em botões e círculos possuem correção de alinhamento óptico.
- [ ] Bordas em tema escuro utilizam opacidades sutis de branco (`border-white/10`).
- [ ] O espaçamento interno dos componentes respeita agrupamento por afinidade semântica.
