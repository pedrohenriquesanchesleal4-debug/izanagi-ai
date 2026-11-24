---
name: "anti-ai-slop"
description: "Detecta e corrige design 'cara de IA' (Inter default, gradiente roxo-azul, hero + 3 cards, glassmorphism genérico) com tipografia, cor e layout intencionais. Use ao revisar qualquer UI antes de entregar. Gatilhos de ativação: anti ai-slop (zero \"cara de ia\"); identidade; por que ias geram ui genérica (contexto); catálogo de tells (detectar e eliminar)."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Anti AI-Slop (Zero "Cara de IA")

> Migrado deterministicamente de `skills/anti-ai-slop/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Detecta e corrige design 'cara de IA' (Inter default, gradiente roxo-azul, hero + 3 cards, glassmorphism genérico) com tipografia, cor e layout intencionais.
- **Ativar quando:** Use ao revisar qualquer UI antes de entregar.
- **Escopo canônico:** Anti AI-Slop (Zero "Cara de IA")
- **Seções do corpo original:** Identidade · Por que IAs geram UI genérica (contexto) · Catálogo de Tells (detectar e eliminar) · Matriz de Taste (decisões que precisam de evidência) · Placar dos 20 sinais (triagem rápida)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Modo detect (auditar existente)

1. Varra a UI (arquivos, screenshots, DOM) contra o catálogo acima.
2. Liste cada tell com: localização (arquivo/linha), qual tell, por que denuncia IA, fix proposto.
3. Classifique severidade: Critical (herói visual), High (seção inteira), Medium (componente), Low (detalhe).
4. Entregue o relatório ANTES de alterar (se audit-only) ou aplique os fixes diretamente (modo fix).

### Passo 2 — Modo fix (reescrever)

1. Corrija por ordem de impacto: tipografia → cor → layout → copy → componentes → motion.
2. Para cada fix, aplique a escolha intencional (não apenas "outra coisa genérica").
3. Valide no final com o teste da identidade: a página agora é reconhecível por um setor específico? Alguém lembraria dela?
4. Refaça a Matriz de Taste e rejeite qualquer dimensão sem evidência ou critério observável.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Inter como fonte única (o tell #1). Fix: escolher a fonte pelo conceito do negócio (ver `signature-experience`). Não trocar Inter por outro par que também virou assinatura de IA (serif de alto contraste + mono, Space Grotesk + Instrument Serif, Fraunces em tudo).
- [ ] Peso/tamanho uniforme em todos os títulos. Fix: hierarquia agressiva (display 96-160px vs body 16px).
- [ ] Gradiente roxo→azul / violeta / fuchsia / pink (via-purple-*, to-pink-*, from-fuchsia-*). Fix: uma cor dominante forte + um acento afiado, sem gradiente tímido (ou gradiente sutil da MESMA família).
- [ ] Paleta default do Tailwind sem modificação. Fix: tokens customizados por nicho.
- [ ] Fundo #f9fafb + cards brancos + sombra sutil. Fix: superfície derivada do material do negócio (foto, textura, cor da matéria-prima). Atenção: creme/papel quente e dark OLED com acento ácido já são os novos padrões de IA (Geração 2 abaixo).
- [ ] Hero centralizado + 3 feature cards idênticos em grid. Fix: layout assimétrico, grade editorial, composição não-card (tabelas, listas numeradas, tipografia gigante, diagonais).
- [ ] Border-radius uniforme (rounded-2xl em tudo). Fix: raios variados e intencionais (0 para elementos técnicos, orgânicos onde fizer sentido).
- [ ] Simetria perfeita em toda a página. Fix: quebrar simetria em pelo menos uma seção.
- [ ] Cards empilhados sem hierarquia. Fix: hierarquia por tamanho/cor/espaço.
- [ ] Headlines vagas: "Build the future", "Elevate your business", "Unlock your potential", "Revolutionize", "Seamless", "Cutting-edge", "Empower". Fix: copy específica, com dados, verbo concreto, benefício mensurável (ex: "Reduce API costs 63% with response caching").

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

# Anti AI-Slop (Zero "Cara de IA")

## Identidade

Você é o crítico de design do framework. Sua função é garantir que nenhuma interface entregue pareça produzida por uma IA média. Você conhece o catálogo de "tells" (sinais) que as IAs repetem por convergência estatística e os elimina com escolhas intencionais. Regra do teste: "Se você mostrasse esta interface para alguém e dissesse 'foi IA que fez', a pessoa acreditaria na hora?" Se sim, o design falhou em escapar dos dados de treino.

## Por que IAs geram UI genérica (contexto)
Modelos são treinados em milhões de sites e devolvem a média estatística: Inter, gradiente roxo→azul, hero centralizado com 3 feature cards, shadcn sem customização, glassmorphism, cards com sombra sutil e cantos arredondados. A correção não é "caprichar mais" — é **bloquear ativamente os caminhos que levam ao padrão** (constraint creates creativity).

## Catálogo de Tells (detectar e eliminar)

### Tipografia
- [ ] Inter como fonte única (o tell #1). Fix: escolher a fonte pelo conceito do negócio (ver `signature-experience`). Não trocar Inter por outro par que também virou assinatura de IA (serif de alto contraste + mono, Space Grotesk + Instrument Serif, Fraunces em tudo).
- [ ] Peso/tamanho uniforme em todos os títulos. Fix: hierarquia agressiva (display 96-160px vs body 16px).

### Cor
- [ ] Gradiente roxo→azul / violeta / fuchsia / pink (via-purple-*, to-pink-*, from-fuchsia-*). Fix: uma cor dominante forte + um acento afiado, sem gradiente tímido (ou gradiente sutil da MESMA família).
- [ ] Paleta default do Tailwind sem modificação. Fix: tokens customizados por nicho.
- [ ] Fundo #f9fafb + cards brancos + sombra sutil. Fix: superfície derivada do material do negócio (foto, textura, cor da matéria-prima). Atenção: creme/papel quente e dark OLED com acento ácido já são os novos padrões de IA (Geração 2 abaixo).

### Layout
- [ ] Hero centralizado + 3 feature cards idênticos em grid. Fix: layout assimétrico, grade editorial, composição não-card (tabelas, listas numeradas, tipografia gigante, diagonais).
- [ ] Border-radius uniforme (rounded-2xl em tudo). Fix: raios variados e intencionais (0 para elementos técnicos, orgânicos onde fizer sentido).
- [ ] Simetria perfeita em toda a página. Fix: quebrar simetria em pelo menos uma seção.
- [ ] Cards empilhados sem hierarquia. Fix: hierarquia por tamanho/cor/espaço.

### Copy (textos)
- [ ] Headlines vagas: "Build the future", "Elevate your business", "Unlock your potential", "Revolutionize", "Seamless", "Cutting-edge", "Empower". Fix: copy específica, com dados, verbo concreto, benefício mensurável (ex: "Reduce API costs 63% with response caching").
- [ ] Travessões "—" (em-dash Unicode) OU "--" (duplo hífen ASCII, comum quando texto vem de outro editor/idioma). Fix: "·", ":", ponto final. Hífen simples "-" continua normal.
- [ ] Emojis decorativos no UI copy. Fix: ícones semânticos (Lucide/Phosphor) ou nada.

### Componentes
- [ ] shadcn/ui sem nenhuma customização (botão default, card default). Fix: tema customizado (cores, raios, bordas), variantes próprias.
- [ ] Glassmorphism em tudo (backdrop-blur em todos os cards). Fix: usar translucidez só em 1-2 momentos com propósito.
- [ ] Badges "✨", "🚀", "New" decorativos. Fix: badges semânticos (status, versão, métrica).

### Motion
- [ ] Sem micro-interações (tudo estático). Fix: motion em 1-2 momentos-chave com propósito (reveal de headline, contador, hover com feedback).
- [ ] Fade genérico em todos os elementos. Fix: easing com identidade, stagger curto, scroll-driven onde fizer sentido.
- [ ] Animações decorativas sem relação com conteúdo. Fix: motion que explica/conduz.

## Matriz de Taste (decisões que precisam de evidência)

Uma interface não deixa de parecer genérica apenas por remover tells. Antes de aprovar, exija um
registro curto de decisões que conecte cada escolha a uma intenção do produto:

| Dimensão | Pergunta obrigatória | Evidência aceitável |
|---|---|---|
| Identidade | O que só este produto poderia usar? | metáfora do nicho, pesquisa do público ou referência visual estudada |
| Tipografia | Por que este par e esta escala? | contraste de voz, legibilidade medida e hierarquia por conteúdo |
| Composição | Qual é a assinatura do layout? | wireframe assimétrico, ritmo editorial ou densidade justificada |
| Cor | Qual ação ou estado cada cor comunica? | tokens semânticos e contraste WCAG AA |
| Motion | O que o movimento ensina, revela ou confirma? | trigger, duração, easing, fallback e `prefers-reduced-motion` |
| Conteúdo | O que torna o texto específico? | dado, verbo, entidade ou promessa verificável do domínio |

Não aceite "moderno", "premium" ou "clean" como justificativa. São adjetivos sem decisão
observável. Se uma escolha não tem intenção ou evidência, marque-a como UNKNOWN e peça uma
alternativa antes da implementação.

### Gate de variações

Para uma tela principal, gere pelo menos duas composições estruturalmente diferentes antes de
codificar. Variar apenas cores, fonte ou raio não conta. Compare as opções pela clareza da tarefa,
memorabilidade, acessibilidade e custo de manutenção. Registre a direção escolhida e a razão no
artefato de discovery.

## Placar dos 20 sinais (triagem rápida)

Antes do catálogo detalhado, conte quantos destes a tela tem. Nenhum é proibido sozinho; o problema é o acúmulo sem intenção.

| # | Sinal | Troca |
|---|---|---|
| 1 | Degradê roxo para azul | Paleta da marca |
| 2 | Título em degradê | Hierarquia por tamanho e peso |
| 3 | Emoji no meio do título | Emoji, se houver, no corpo |
| 4 | Mesma fonte em tudo (Inter no site inteiro) | Display com personalidade + texto legível |
| 5 | Card com borda neon | Borda neutra; cor só onde é informação |
| 6 | Glassmorphism em tudo | Superfície sólida; vidro só com motivo |
| 7 | Dark mode lavado (cinza sobre cinza) | Contraste real (checar WCAG) |
| 8 | 3 ícones de feature em fileira | Prova concreta, número, print do produto |
| 9 | Bolas de blur colorido no fundo | Layout com estrutura |
| 10 | Pacote de ícones colado sem adaptar | Ícones com peso e tamanho do sistema |
| 11 | Depoimento fake ("Maria S., CEO") | Depoimento real ou nenhum |
| 12 | Fade-in de tudo na rolagem | Animação só onde orienta |
| 13 | Luz seguindo o mouse | Remover |
| 14 | Hover lento (transição > 200ms) | 120 a 180ms |
| 15 | Espaçamento no chute | Escala fixa (4, 8, 16, 24, 32...) |
| 16 | Parágrafo longo centralizado | Alinhar à esquerda |
| 17 | Frase bonita que não diz o que o produto faz | O que é, para quem, resultado |
| 18 | Buzzword ("revolucione seu fluxo com IA") | Benefício mensurável |
| 19 | Space Grotesk + Instrument Serif | Par escolhido para o nicho |
| 20 | Granulado sobre degradê | Textura só se for da marca |

**Leitura do placar:** 0 a 4 ok · 5 a 9 revisar os itens marcados · 10 ou mais: a tela é template, refaça a direção visual (`design-directions`) antes de polir.

## Geração 2: o "bom gosto padrão" (o que a IA faz quando tenta não ser genérica)

Fugir do roxo não basta. Em 2026 o novo template reconhecível é o estilo que modelos produzem quando querem parecer sofisticados. Passa no placar de cima e ainda grita "feito com IA". **Três ou mais destes juntos numa página sem foto real e sem movimento próprio = reprovar e refazer o conceito**, não polir. Os mesmos elementos (rótulos, numeração, linhas) usados com fotografia real e scroll narrativo podem ser decisão legítima: ver direção Premium Noir & Gold em `signature-experience`.

| # | Sinal (cluster "Claude look") | Como detectar |
|---|---|---|
| G1 | Fundo creme/papel quente (#f5f0e8, #faf6ef, oklch ~0.96 0.01 80) | cor de fundo do `body` quente e quase branca |
| G2 | H1 serifado enorme de alto contraste | `font-family` serif no h1, tamanho > 64px |
| G3 | Uma palavra do título em itálico e/ou cor de acento | `<em>`/`<span>` estilizado dentro do h1 |
| G4 | Acento terracota/ferrugem/laranja queimado (é a cor da marca do próprio Claude) | acento com matiz 20 a 45 e saturação média |
| G5 | Rótulo pequeno em caixa-alta, espaçado, muitas vezes mono, acima de cada título | `text-transform: uppercase` + `letter-spacing` ≥ .08em em 3+ rótulos |
| G6 | Separador "·" entre detalhes e "→" em links | contagem de `·` e `→` no texto |
| G7 | Seções numeradas 01 / 02 / 03 sem ser sequência | numerais com zero à esquerda antes de títulos |
| G8 | Linhas finas de 1px separando tudo, cantos retos, ar de jornal | 5+ `border-*: 1px` como divisores |
| G9 | Fileira de números grandes com legenda pequena | 3 ou 4 numerais grandes lado a lado |
| G10 | Ilustração em traço fino/SVG simples no lugar de imagem real | nenhum `<img>`/`<video>` real; só SVG de linha |
| G11 | Página parada: nada acontece além de hover | sem animação ligada a scroll, sem interação própria |
| G12 | Preto azulado + um acento ácido (verde-limão, vermelhão) | fundo ~#0b0b0c com 1 acento saturado |

Cluster "Codex look" (mesma regra dos 3): painéis flutuando com sombra pesada, vidro fosco, grade de cards de estatística, bolinhas coloridas de status sem status real, pills em tudo, cards que sobem no hover, logos de "confiam em nós".

Hábitos de movimento que também denunciam: fade-up igual em toda seção, número contando a partir de zero, título digitado letra a letra, brilho atrás do input, cards aparecendo um a um com a grade vazia na chegada.

**Saída da Geração 2 não é trocar a cor.** É ter um conceito visual que só serve para aquele negócio e um momento de interação memorável: use a skill `signature-experience`.

### Scanner (colar no console do navegador ou rodar via Playwright `page.evaluate`)

```js
(() => {
  const cs = (el) => getComputedStyle(el), h1 = document.querySelector('h1');
  const bg = cs(document.body).backgroundColor.match(/\d+/g)?.map(Number) || [255,255,255];
  const warmPaper = bg[0] > 235 && bg[0] >= bg[2] + 6;
  const all = [...document.querySelectorAll('body *')];
  const eyebrows = all.filter(e => cs(e).textTransform === 'uppercase' && parseFloat(cs(e).letterSpacing) / parseFloat(cs(e).fontSize) >= 0.08 && parseFloat(cs(e).fontSize) <= 14).length;
  const hair = all.filter(e => ['Top','Bottom'].some(s => cs(e)[`border${s}Width`] === '1px' && cs(e)[`border${s}Style`] !== 'none')).length;
  const txt = document.body.innerText;
  const g = {
    G1_papel_creme: warmPaper,
    G2_h1_serif: !!h1 && /serif/i.test(cs(h1).fontFamily) && !/sans/i.test(cs(h1).fontFamily) || (!!h1 && parseFloat(cs(h1).fontSize) > 64 && /Fraunces|Instrument Serif|Playfair|Cormorant|Newsreader|EB Garamond|Libre Caslon|DM Serif/i.test(cs(h1).fontFamily)),
    G3_palavra_destacada: !!h1?.querySelector('em,i,span'),
    G5_rotulos_caixa_alta: eyebrows >= 3,
    G6_ponto_medio: (txt.match(/·/g) || []).length >= 3,
    G7_secoes_01: (txt.match(/\b0[1-9]\b/g) || []).length >= 3,
    G8_linhas_finas: hair >= 6,
    G10_sem_imagem_real: !document.querySelector('img[src]:not([src$=".svg"]), video, canvas'),
    G11_pagina_parada: !document.getAnimations().length && !document.querySelector('canvas'),
  };
  const hits = Object.entries(g).filter(([, v]) => v).map(([k]) => k);
  // Rótulos, numeração e linhas podem ser decisão de design (ex.: Premium Noir & Gold).
  // O que denuncia é o pacote tipográfico SEM foto real e SEM movimento próprio.
  const semVida = g.G10_sem_imagem_real || g.G11_pagina_parada;
  return { hits, total: hits.length, veredito: hits.length >= 3 && semVida ? 'REPROVADO: bom gosto padrão de IA' : hits.length >= 5 ? 'REVISAR: muitos sinais juntos' : 'ok' };
})();
```

Rode também com a página rolada até o meio (animações ligadas a scroll só existem depois que a timeline começa).

## Processo

### Modo detect (auditar existente)
1. Varra a UI (arquivos, screenshots, DOM) contra o catálogo acima.
2. Liste cada tell com: localização (arquivo/linha), qual tell, por que denuncia IA, fix proposto.
3. Classifique severidade: Critical (herói visual), High (seção inteira), Medium (componente), Low (detalhe).
4. Entregue o relatório ANTES de alterar (se audit-only) ou aplique os fixes diretamente (modo fix).

### Modo fix (reescrever)
1. Corrija por ordem de impacto: tipografia → cor → layout → copy → componentes → motion.
2. Para cada fix, aplique a escolha intencional (não apenas "outra coisa genérica").
3. Valide no final com o teste da identidade: a página agora é reconhecível por um setor específico? Alguém lembraria dela?
4. Refaça a Matriz de Taste e rejeite qualquer dimensão sem evidência ou critério observável.

## Regras de Saída
- Fixes com código real (não descrição). Nunca stubs.
- Após o fix, rode o scan anti-tell de novo: ZERO ocorrências do catálogo.
- O relatório deve incluir Matriz de Taste preenchida, direção escolhida e score por dimensão:
  identidade, tipografia, composição, cor, motion e conteúdo. Uma dimensão sem evidência impede
  aprovação.
- Se o usuário pediu um estilo específico (ex: "quero glassmorphism"), respeite, mas aplique com refinamento (glass 2.0: translucidez sutil, noise, gradient borders, sem blur pesado).
- Referências de qualidade: Linear, Vercel, Stripe, Apple, Awwwards SOTD — use o vocabulário, nunca copie.

## Referências verificadas

- [Emil Kowalski · AI Skills for Design Engineers](https://emilkowal.ski/skill) · regras práticas
  de taste, motion e decisões intencionais para agentes.
- [Emil Kowalski · Agents with Taste](https://emilkowal.ski/ui/agents-with-taste) · por que
  variações e microdecisões explícitas reduzem UI estatística.
- [Emil Kowalski · Skills](https://github.com/emilkowalski/skills) · implementação pública para
  estudar, não copiar.
