---
name: "signature-experience"
description: "Direção para sites extraordinários, não só corretos: um conceito visual que só serve para aquele negócio, um momento de assinatura (a interação que a pessoa comenta depois), técnicas de movimento escolhidas pelo conceito (WebGL, scroll scrubbing, tipografia cinética, sequência de imagens, SVG que se desenha, cursor reativo) e prova por screenshot e quadros. Use em toda landing, site institucional, portfólio ou lançamento, antes de escrever o HTML. Gatilhos de ativação: signature experience: do correto ao memorável; quando usar; passo 1: conceito em uma frase (antes de qualquer cor); passo 2: o momento de assinatura."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Signature Experience: do correto ao memorável

> Migrado deterministicamente de `skills/signature-experience/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Direção para sites extraordinários, não só corretos: um conceito visual que só serve para aquele negócio, um momento de assinatura (a interação que a pessoa comenta depois), técnicas de movimento escolhidas pelo conceito (WebGL, scroll scrubbing, tipografia cinética, sequência de imagens, SVG que se desenha, cursor reativo) e prova por screenshot e quadros.
- **Ativar quando:** Use em toda landing, site institucional, portfólio ou lançamento, antes de escrever o HTML.
- **Escopo canônico:** Signature Experience: do correto ao memorável
- **Seções do corpo original:** Quando usar · Passo 1: conceito em uma frase (antes de qualquer cor) · Passo 2: o momento de assinatura · Direção pronta para landing de conversão: Premium Noir & Gold · Passo 3: direção visual que serve ao conceito
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Screenshot da primeira dobra e de 3 pontos do scroll; olhe as imagens antes de reportar.

Screenshot da primeira dobra e de 3 pontos do scroll; **olhe as imagens** antes de reportar.

### Passo 2 — Quadros do momento de assinatura em 4 instantes (comprova que ele existe e se move).

Quadros do momento de assinatura em 4 instantes (comprova que ele existe e se move).

### Passo 3 — Rodar o scanner do anti-ai-slop (Geração 1 e 2) com a página rolada até o meio:

Rodar o scanner do `anti-ai-slop` (Geração 1 e 2) com a página rolada até o meio: **0 a 2 sinais**.

### Passo 4 — Teste da lembrança:

Teste da lembrança: descreva o site em uma frase sem citar cor ou fonte. Se a frase for "uma landing limpa e elegante", volte ao passo 1.

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

# Signature Experience: do correto ao memorável

Site correto não é lembrado. Fugir dos sinais de IA (`anti-ai-slop`) só tira o que denuncia; esta skill coloca o que marca. O que separa um site premiado de um site "bonito de IA" não é paleta: é **um conceito** e **um momento**.

## Quando usar

Toda landing, site de marca, portfólio, lançamento de produto. **Pule** em dashboard e ferramenta interna (lá o critério é velocidade de uso: `impeccable` modo Operate).

## Passo 1: conceito em uma frase (antes de qualquer cor)

Encontre a metáfora que vem do próprio negócio, não do mundo dos sites:

| Negócio | Conceito ruim (genérico) | Conceito com assinatura |
|---|---|---|
| Tatuagem fine-line | "estúdio elegante e minimalista" | "a página é pele: a agulha desenha cada seção enquanto você rola" |
| Padaria de fermentação | "artesanal e acolhedor" | "a massa cresce: o layout respira e fermenta em tempo real, o forno mostra a próxima fornada" |
| Escritório de advocacia | "sério e confiável" | "o documento: a página se monta como um processo sendo protocolado, carimbos e assinaturas" |
| App de finanças | "moderno e seguro" | "o dinheiro tem peso: valores caem e se acomodam com física" |

Regra: se o conceito serviria para outro negócio do mesmo setor, ele ainda é genérico.

## Passo 2: o momento de assinatura

Uma interação, de preferência na primeira dobra, que realiza o conceito. Para pedir ou executar um efeito sem improvisar, use a **biblioteca de receitas E1 a E6** no fim de `references.md` (objeto 3D de produto, matéria com granulado, tipografia cinética, ladrilhos diagonais, orbe de elementos, retrato com mapa técnico). Exatamente **uma** principal e no máximo **duas** de apoio na página. Exemplos por técnica:

| Técnica | Quando serve | Implementação |
|---|---|---|
| Desenho por scroll (SVG que se traça) | traço, caligrafia, mapas, rotas | `stroke-dasharray/dashoffset` ligado ao scroll (`animation-timeline: scroll()` ou GSAP `scrub`) |
| Sequência de imagens no canvas (estilo Apple) | produto físico girando, processo | 60 a 150 quadros WebP, `drawImage` pelo progresso do scroll |
| Shader / WebGL | matéria (líquido, massa, fumaça, tecido, luz) | OGL ou Three.js, um plano com fragment shader; fallback estático |
| Tipografia cinética | marcas fortes de voz, manifestos | fonte variável animando eixo (`font-variation-settings`), split por letra com stagger |
| Seção pinada com narrativa | processo em etapas, antes/depois | GSAP `ScrollTrigger` `pin` + timeline; horizontal scroll se a história for linear |
| Máscara / clip-path reveal | fotografia forte | `clip-path` animado do recorte ao enquadramento total |
| Cursor como ferramenta | portfólio, criativos | cursor vira pincel/lupa/agulha com `pointermove` + `requestAnimationFrame` |
| Física leve | produto lúdico, finanças | Matter.js ou mola simples; objetos caem e se acomodam |
| View Transitions | navegação entre páginas/estados | `document.startViewTransition` com nomes compartilhados |

Bibliotecas: GSAP (ScrollTrigger, SplitText; gratuito), Lenis (scroll suave), OGL/Three.js (WebGL), Motion One. Componentes de partida: 21st.dev, React Bits (sempre adaptados ao conceito).

## Direção pronta para landing de conversão: Premium Noir & Gold

Para landing de serviço premium, saúde estética, consultoria, infoproduto ou evento ao vivo, comece pela direção **Premium Noir & Gold** em `references.md` (nesta pasta): fundo preto quente, ouro metálico com brilho, luz dourada, foto real recortada com sobreposição técnica, ícones 3D dourados e peças de scroll que contam a história (caminho que se desenha, linha do tempo que acende, contador ligado ao scroll, cards empilháveis, antes/depois, contagem regressiva, faixa diagonal). Tem receitas de código prontas. Adapte o conceito ao negócio; a gramática visual vem pronta.

## Passo 3: direção visual que serve ao conceito

- **Tipografia**: escolha pelo conceito, não pelo "elegante". Evite os pares que já viraram assinatura de IA (Inter sozinho; serif de alto contraste + mono em caixa-alta; Space Grotesk + Instrument Serif). Considere fontes variáveis, grotescas condensadas, display experimentais, escrita à mão real.
- **Cor**: derive do material do negócio (a cor da tinta, do forno, do papel timbrado). Evite creme + terracota (é a cor da própria marca do Claude) e preto + verde-ácido.
- **Layout**: quebre a coluna central com uma decisão (texto que invade imagem, grid que se desloca no scroll, escala exagerada de um elemento só). Sem rótulo mono acima de todo título, sem 01/02/03 decorativo, sem linha fina separando tudo.
- **Imagem**: real ou gerada com direção de arte coerente (mesma luz, mesma lente). Ilustração em traço fino genérica não conta como imagem.

## Passo 4: orçamento e acessibilidade

- LCP < 2,5s em 4G: o momento de assinatura carrega depois do conteúdo principal; shader e sequência com poster estático.
- `prefers-reduced-motion: reduce` desliga scrub, pin e partículas e mostra o estado final.
- Texto nunca escondido atrás de animação de entrada: conteúdo visível sem JS.
- 60fps: animar só `transform`, `opacity`, `clip-path`, uniforms de shader.

## Passo 5: provar antes de entregar

**Entrega sem screenshot não está pronta.** Sem navegador disponível, use Playwright pela linha de comando:

```bash
npx -y playwright install chromium >/dev/null 2>&1
npx -y playwright screenshot --full-page --wait-for-timeout=2500 index.html shot-full.png
```
Para quadros do scroll: um script `page.evaluate(() => scrollTo(0, Y))` + `page.screenshot()` em 4 alturas, e o scanner do `anti-ai-slop` via `page.evaluate`.

1. Screenshot da primeira dobra e de 3 pontos do scroll; **olhe as imagens** antes de reportar.
2. Quadros do momento de assinatura em 4 instantes (comprova que ele existe e se move).
3. Rodar o scanner do `anti-ai-slop` (Geração 1 e 2) com a página rolada até o meio: **0 a 2 sinais**.
4. Teste da lembrança: descreva o site em uma frase sem citar cor ou fonte. Se a frase for "uma landing limpa e elegante", volte ao passo 1.

## Saída

No topo da entrega: `Conceito: ...` · `Momento de assinatura: ...` · `Técnicas: ...` · `Scanner: N sinais` · caminhos dos screenshots.
