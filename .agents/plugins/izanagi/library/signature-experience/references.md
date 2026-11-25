# Direção de referência: Premium Noir & Gold (landing de conversão)

Estudada quadro a quadro em duas landings brasileiras de alto valor (masterclass de harmonização corporal "Black Full Body" e consultoria tributária para transportadoras "Vexter"). É o padrão a usar quando o usuário pedir landing "premium", "de alto ticket", "que pareça cara", para serviços, saúde estética, consultoria, infoproduto ou evento.

## A gramática visual

| Camada | Como é | Por que não parece IA |
|---|---|---|
| Fundo | preto/grafite quente (#0B0A08 a #15120E), nunca preto azulado | profundidade vem de luz e foto, não de cor chapada |
| Ouro | metálico com 4 a 5 paradas (#7A5A1E → #E9C77B → #FFF1C9 → #C9973F → #6B4C17), em texto de destaque, botões, selos e linhas de luz | degradê com brilho especular imita metal; degradê de 2 cores imita template |
| Luz | arcos e traços de luz dourada com glow (SVG stroke + blur), barras verticais de luz atrás do herói, reflexo passando no logo | a página parece iluminada, não pintada |
| Foto | real, grande, recortada (pessoa, mão, produto), com sobreposição gráfica técnica (círculos, medidas, cruzes de mira) | prova humana; IA genérica usa ilustração ou nenhuma imagem |
| Ícones | 3D dourados renderizados (caminhão, moedas, caixa, escudo) | substitui o pacote Lucide de linha fina |
| Tipografia | sans geométrica forte (Poppins/Montserrat/Satoshi/General Sans semibold-bold), título curto, palavra-chave em ouro metálico; logo pode misturar caixa-alta sans + script | contraste por peso e luz, não serif + itálico |
| Botão | pílula com ouro metálico, texto escuro em caixa-alta pequena, círculo escuro com seta dentro; brilho no hover | reconhecível e desenhado, não o botão padrão |

## As peças que contam a história com o scroll

1. **Herói com foto + sobreposição técnica + arco de luz**. Foto recortada à direita, círculos dourados finos com marcações (o "método" desenhado sobre a pessoa), arco de luz que entra pelo canto. Selos de métrica em ouro no rodapé do herói (`R$ 486 mil / por ano`) que trocam de valor em loop.
2. **Faixa diagonal (marquee) inclinada 3 a 5 graus** com a informação do evento repetida: `MASTERCLASS AO VIVO · FULL BODY · 26/11 ÀS 20H`.
3. **Barra de contagem regressiva** fixa no topo (dias, horas, min, seg) quando há data.
4. **Linha do tempo que acende**: trilho vertical com nós; o card da etapa no centro da tela ganha borda dourada e glow; à esquerda, um roteiro pegajoso (sticky) marca as etapas concluídas (`3/5`).
5. **Contador ligado ao scroll**: `+03 → +11 → +16 módulos` sobe conforme a seção avança, ao lado de colunas de capas em parallax (cada coluna numa velocidade).
6. **Caminho dourado que se desenha**: estrada em S (SVG path) ligando etapas do processo (Diagnóstico → Planejamento → Implantação → Operação → Indicadores → Evolução) com ícone 3D em cada nó; à esquerda, numeral gigante em odômetro (`02/06` rolando os dígitos) e título trocando com blur.
7. **Cards empilháveis (stacking)**: cada serviço é um painel escuro com foto real; ao rolar, o próximo sobe e cobre o anterior, que encolhe levemente.
8. **Antes/depois arrastável**: 3 colunas, alça redonda dourada, rótulos `ANTES` / `DEPOIS`.
9. **Transição de marca**: logo 3D dourado surgindo com reflexo de luz, letras entrando uma a uma, como virada de capítulo.
10. **Oferta final**: caixa com contagem regressiva + cartão da oferta com checklist dourado; WhatsApp flutuante com anel dourado.

Use 4 a 6 dessas peças por página, não todas. Uma delas é o **momento de assinatura** (normalmente 1, 4 ou 6).

## Receitas

### Ouro metálico (texto e botão)

```css
:root{
  --gold: linear-gradient(100deg,#6B4C17 0%,#C9973F 22%,#FFF1C9 45%,#E9C77B 58%,#A87A2C 80%,#6B4C17 100%);
  --ink:#0B0A08; --ink-2:#15120E; --text:#F3EEE6; --muted:#A39C90;
}
.gold-text{background:var(--gold);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;
  animation:sheen 6s ease-in-out infinite}
@keyframes sheen{0%,100%{background-position:0% 0}50%{background-position:100% 0}}
.btn-gold{display:inline-flex;align-items:center;gap:.75rem;padding:.5rem .5rem .5rem 1.4rem;border-radius:999px;
  background:var(--gold);background-size:200% 100%;color:var(--ink);font:600 .78rem/1 var(--sans);text-transform:uppercase;letter-spacing:.06em;
  box-shadow:0 0 0 1px #E9C77B55,0 10px 40px -10px #C9973F99;transition:background-position .6s,transform .15s}
.btn-gold:hover{background-position:100% 0}.btn-gold:active{transform:scale(.98)}
.btn-gold .arrow{width:2.2rem;height:2.2rem;border-radius:50%;background:var(--ink);color:#E9C77B;display:grid;place-items:center}
@media (prefers-reduced-motion:reduce){.gold-text{animation:none}}
```

### Arco de luz e barras de luz

```html
<svg class="light-arc" viewBox="0 0 800 400" aria-hidden="true">
  <defs><linearGradient id="g" x1="0" x2="1"><stop offset="0" stop-color="#C9973F" stop-opacity="0"/><stop offset=".5" stop-color="#FFF1C9"/><stop offset="1" stop-color="#C9973F" stop-opacity="0"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
  <path d="M-20 300 C 200 40, 520 20, 820 120" fill="none" stroke="url(#g)" stroke-width="3" filter="url(#glow)"/>
</svg>
```
Barras verticais: `repeating-linear-gradient(90deg, transparent 0 46px, #C9973F22 46px 48px)` com máscara radial no centro.

### Caminho que se desenha com o scroll (GSAP)

```js
gsap.registerPlugin(ScrollTrigger);
const path = document.querySelector('#rota');
const len = path.getTotalLength();
gsap.set(path,{strokeDasharray:len,strokeDashoffset:len});
gsap.to(path,{strokeDashoffset:0,ease:'none',scrollTrigger:{trigger:'#processo',start:'top top',end:'+=2400',scrub:true,pin:true,
  onUpdate:s=>setEtapa(Math.min(5,Math.floor(s.progress*6)))}});
```
`setEtapa(i)` troca o numeral (odômetro: cada dígito é uma coluna 0-9 com `translateY(-i*1em)`), o título (blur 8px → 0) e acende o nó `i`.

### Contador ligado ao scroll

```js
document.querySelectorAll('[data-count-to]').forEach(el=>{
  const to=+el.dataset.countTo, from=+(el.dataset.countFrom||0);
  ScrollTrigger.create({trigger:el.closest('section'),start:'top 70%',end:'bottom 30%',scrub:true,
    onUpdate:s=>el.textContent='+'+String(Math.round(from+(to-from)*s.progress)).padStart(2,'0')});
});
```

### Cards empilháveis

```css
.stack{position:relative}.stack .card{position:sticky;top:12vh;transform-origin:top center}
```
```js
gsap.utils.toArray('.stack .card').forEach((c,i,all)=>{ if(i===all.length-1) return;
  // fromTo obrigatório: com gsap.to, o filtro parte de "none" e o GSAP interpola como brightness(0): o card fica PRETO (visto em render real).
  gsap.fromTo(c,{scale:1,filter:'brightness(1)'},{scale:.94,filter:'brightness(.75)',ease:'none',scrollTrigger:{trigger:all[i+1],start:'top bottom',end:'top 12vh',scrub:true}}); });
```

### Antes/depois

```html
<figure class="ba" style="--pos:50%"><img src="antes.jpg" alt="Antes do tratamento"><img src="depois.jpg" alt="Depois do tratamento" style="clip-path:inset(0 0 0 var(--pos))">
<input type="range" min="0" max="100" value="50" aria-label="Comparar antes e depois" oninput="this.parentElement.style.setProperty('--pos',this.value+'%')"></figure>
```

### Faixa diagonal

```css
.ribbon{transform:rotate(-4deg);background:var(--gold);color:var(--ink);overflow:hidden;white-space:nowrap}
.ribbon span{display:inline-block;animation:marquee 30s linear infinite}
@keyframes marquee{to{transform:translateX(-50%)}}
```

## Imagens

Esta direção depende de foto real. Ordem de preferência: fotos do cliente; banco com licença livre (Unsplash, Pexels) buscado pelo tema e citado no código; imagem gerada com direção de arte única (mesma luz dourada lateral, fundo escuro). Ícones 3D dourados: gerar ou usar pacote 3D licenciado; nunca trocar por ícone de linha. Sem foto disponível, avise o usuário em vez de entregar a página sem imagem.

Regras de escolha (falhas vistas em teste real):
- Cada foto precisa servir ao conceito da seção. Foto bonita sem relação (piscina de spa numa página de harmonização) é enchimento e denuncia template.
- Nada de marca de terceiros visível (embalagem, logo, rótulo de produto de outra empresa).
- Não invente ID de foto "de memória": busque no banco pelo tema, confira que a URL responde 200 e descreva em 1 linha o que a foto mostra antes de usar.
- Mesma luz e paleta entre as fotos (quente, lateral, fundo escuro); se uma destoar, aplique o mesmo tratamento (duotone dourado, escurecer, recorte) ou troque.

## Stack

GSAP + ScrollTrigger (CDN), Lenis para scroll suave, nada de framework obrigatório. `prefers-reduced-motion` desliga pin/scrub e mostra o estado final de cada peça.

## Camada de acabamento (o "falta alguma coisa")

Uma página pode ter todas as peças acima e ainda parecer plana: correta, mas parada como um template. Isso foi visto em teste real (landing de harmonização com paleta, fotos e scroll certos, e o usuário disse "está legal, mas falta algo"). O que faltava não era mais uma seção, eram estas 7 camadas. Aplique **todas** antes de entregar; cada uma custa poucas linhas.

| # | Camada | Sem ela | Receita |
|---|---|---|---|
| A1 | **Entrada coreografada** | tudo aparece junto ou com o mesmo fade | uma timeline só, ~1,6s: foto abre por máscara, título sobe linha a linha, o resto acompanha, selos por último |
| A2 | **Herói em 3 planos** | texto à esquerda, foto à direita, nada atrás e nada na frente | plano de fundo (número/palavra gigante em contorno dourado), plano médio (foto), plano da frente (chips); cada um com `data-depth` diferente no mouse e no scroll |
| A3 | **Matéria** | preto chapado de tela | grão animado em `overlay` (opacidade .06 a .08) + vinheta radial; luz dourada que segue o cursor no herói |
| A4 | **Palavra-chave em metal** | ouro só no botão | a frase que é a tese do título em `.gold-text`, uma por página no herói e uma na oferta |
| A5 | **Microinteração no que se clica** | botão só muda de cor | brilho que atravessa o botão no hover, botão magnético (ponteiro fino), luz que segue o cursor dentro dos cards |
| A6 | **Costura entre seções** | cortes secos de uma seção para outra | fio de luz dourado que se desenha sob cada título; herói que recua e escurece ao sair |
| A7 | **Toda imagem serve ao conceito** | foto de banco "bonita" sem relação (piscina, consultório odontológico, produto de marca) | troque por painel tipográfico ou SVG do próprio método (lista numerada em ouro, diagrama, papel de anotação inclinado); painel desenhado vence foto genérica |

```css
/* A3 grão + vinheta */
.grain{position:fixed;inset:-50%;z-index:90;pointer-events:none;opacity:.07;mix-blend-mode:overlay;animation:grain 1.2s steps(4) infinite;
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")}
@keyframes grain{25%{transform:translate(-3%,2%)}50%{transform:translate(2%,-3%)}75%{transform:translate(-1%,-2%)}}
.vignette{position:fixed;inset:0;z-index:89;pointer-events:none;background:radial-gradient(120% 90% at 50% 40%,transparent 60%,#000a)}
.hero .spot{position:absolute;inset:0;z-index:-1;pointer-events:none;background:radial-gradient(520px circle at var(--mx,70%) var(--my,40%),#E9C77B1f,transparent 60%)}
/* A2 plano de fundo: some no mobile, onde cobriria o texto */
.ghost{position:absolute;right:-3%;top:52%;translate:0 -50%;z-index:-1;font:800 clamp(6rem,24vw,24rem)/.8 var(--display);color:transparent;-webkit-text-stroke:1.5px #C9973F70;pointer-events:none}
@media(max-width:959px){.ghost{display:none}}
/* A1 título por linhas: o h1 leva aria-label com a frase inteira, as linhas ficam aria-hidden */
.line{display:block;overflow:hidden;padding-bottom:.1em;margin-bottom:-.1em}.line>span{display:inline-block}
/* A5 brilho no botão */
.btn{position:relative;overflow:hidden;isolation:isolate}
.btn::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(105deg,transparent 35%,#FFFBEA 50%,transparent 65%);translate:-120% 0;transition:translate .9s cubic-bezier(.22,1,.36,1)}
.btn:hover::before{translate:120% 0}
/* A6 fio de luz sob o título */
.h-rule{display:block;height:1px;width:min(240px,40%);margin-top:20px;background:linear-gradient(90deg,#FFF1C9,#C9973F 40%,transparent);transform-origin:left;box-shadow:0 0 12px #E9C77B88}
.js .h-rule{transform:scaleX(0)}.js .h-rule.in{transform:scaleX(1);transition:transform 1.2s cubic-bezier(.22,1,.36,1) .2s}
@media(prefers-reduced-motion:reduce){.grain{display:none}.js .h-rule{transform:none}}
```

```js
// A1 entrada coreografada (pule tudo se prefers-reduced-motion)
gsap.timeline({defaults:{ease:'expo.out'}})
  .fromTo('.hero .portrait',{clipPath:'inset(100% 0 0 0 round 24px)'},{clipPath:'inset(0% 0 0 0 round 24px)',duration:1.4,ease:'expo.inOut'},0)
  .from('.hero .portrait img',{scale:1.25,duration:1.8},.2)
  .from('.hero h1 .line>span',{yPercent:110,duration:1.1,stagger:.09},.25)
  .from('.hero .lead,.hero .cta-row',{y:20,opacity:0,duration:.9,stagger:.08},.7)
  .from('.hero .chip',{scale:.6,opacity:0,duration:.9,ease:'back.out(1.8)',stagger:.12},1.1);
// A2 + A3 profundidade e luz no mouse (só ponteiro fino)
const hero=document.querySelector('.hero');
if(matchMedia('(pointer:fine)').matches){
  const L=[...hero.querySelectorAll('[data-depth]')].map(l=>({d:+l.dataset.depth,x:gsap.quickTo(l,'x',{duration:.9}),y:gsap.quickTo(l,'y',{duration:.9})}));
  hero.addEventListener('pointermove',e=>{const r=hero.getBoundingClientRect(),nx=(e.clientX-r.left)/r.width-.5,ny=(e.clientY-r.top)/r.height-.5;
    hero.style.setProperty('--mx',(nx+.5)*100+'%');hero.style.setProperty('--my',(ny+.5)*100+'%');L.forEach(s=>{s.x(nx*28*s.d);s.y(ny*20*s.d)})});
}
gsap.to('.ghost',{yPercent:-30,ease:'none',scrollTrigger:{trigger:hero,start:'top top',end:'bottom top',scrub:true}});
gsap.to('.hero-grid',{yPercent:8,opacity:.35,ease:'none',scrollTrigger:{trigger:hero,start:'center top',end:'bottom top',scrub:true}});
// A5 botão magnético
document.querySelectorAll('[data-mag]').forEach(b=>{const x=gsap.quickTo(b,'x',{duration:.4}),y=gsap.quickTo(b,'y',{duration:.4});
  b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();x((e.clientX-r.left-r.width/2)*.25);y((e.clientY-r.top-r.height/2)*.35)});
  b.addEventListener('pointerleave',()=>{x(0);y(0)})});
```

Armadilhas vistas no render: o número gigante do plano de fundo cruzando o parágrafo (posicione atrás da foto, nunca atrás do texto, e esconda no mobile); `filter` animado com `gsap.to` partindo de `none` (vira preto, use `fromTo`); `::before` de check (`.card li::before`) vazando para listas numeradas dentro do card (zere `position`, `border` e `transform` na lista nova).

**Prova da camada:** screenshot do herói em repouso, um quadro no meio da entrada (~0,6s) e um quadro com o mouse sobre a foto. Se os 3 quadros forem iguais, a camada não existe.

---

# Biblioteca de efeitos em formato de receita-prompt

Bibliotecas comerciais (ex.: integrasites, com 600+ componentes e páginas vendidos por créditos, cada um com um prompt "copiar e integrar" para Claude Code, Codex ou Cursor) mostram o formato que funciona: **cada efeito é uma especificação completa**, não um adjetivo. O agente não inventa; executa a receita e adapta ao conceito. Abaixo, receitas próprias do Izanagi no mesmo formato. Use uma como momento de assinatura e no máximo duas de apoio.

Formato de cada receita: **Efeito** · **Quando usar** · **Técnica** · **Parâmetros** · **Fallback** (sem WebGL / `prefers-reduced-motion`) · **Prova** (o que o screenshot/quadro precisa mostrar).

## E1 · Objeto 3D de produto que reage ao scroll
- Quando: produto físico de alto valor (relógio, tênis, garrafa, joia, eletrônico).
- Técnica: Three.js + GLTF (ou geometria procedural se não houver modelo), `MeshPhysicalMaterial` (metal: `metalness 1, roughness .15`; vidro: `transmission 1, thickness .6, ior 1.45`), HDRI de estúdio escuro, rotação Y ligada ao progresso do scroll da seção pinada, zoom de câmera em 2 a 3 detalhes com legenda.
- Parâmetros: `pin` 200 a 300vh; 3 paradas de câmera; DPR máx. 1.75; carregar após o LCP.
- Fallback: sequência de 3 imagens WebP do mesmo ângulo com crossfade.
- Prova: 3 quadros com o objeto em ângulos diferentes e a legenda de cada detalhe.

## E2 · Matéria orgânica com granulado (shader)
- Quando: marcas de bem-estar, arte, tecnologia "tátil"; fundo vivo atrás do herói.
- Técnica: plano fullscreen com fragment shader de ruído (simplex/FBM) deslocando cor entre 2 tons da marca + grão (`fract(sin(dot(uv, vec2(12.9898,78.233)))*43758.5453)` a 6% de opacidade), reagindo levemente ao ponteiro.
- Parâmetros: velocidade 0.05 a 0.12; resolução do canvas a 0.5x e escalada por CSS.
- Fallback: gradiente estático com textura de ruído em PNG.
- Prova: 2 quadros com 2s de diferença mostrando a forma mudando.

## E3 · Tipografia cinética gigante (palavra que se forma)
- Quando: manifesto, marca com nome forte, lançamento.
- Técnica: título em fonte variável condensada ocupando 90vw; letras entram por máscara (`clip-path: inset(100% 0 0 0)` → `inset(0)`) com stagger 40ms; eixo `wght`/`wdth` ligado ao scroll; troca de palavra por blur 12px → 0.
- Parâmetros: no máximo 2 palavras por tela; 1 palavra em outro alfabeto/ideograma só se tiver sentido para a marca.
- Fallback: título estático no estado final.
- Prova: 3 quadros com a palavra em formação, formada e trocando.

## E4 · Ladrilhos diagonais na rolagem
- Quando: portfólio, catálogo, galeria de casos.
- Técnica: grade rotacionada -12° com 3 a 4 colunas; cada coluna com `translateY` em velocidade diferente pelo scroll (0.6x, 1x, 1.4x); hover amplia o card e revela título.
- Parâmetros: imagens reais 4:5, `object-fit: cover`; máscara de fade nas bordas.
- Fallback: grade reta estática.
- Prova: 2 quadros com as colunas visivelmente deslocadas entre si.

## E5 · Orbe de elementos (teclas, ícones, produtos)
- Quando: tecnologia, ferramentas, catálogo com muitos itens.
- Técnica: N elementos distribuídos numa esfera (Fibonacci sphere) em Three.js ou CSS 3D (`transform-style: preserve-3d`), rotação por arraste com inércia; clique foca o item.
- Parâmetros: 24 a 60 itens; profundidade com escala e opacidade.
- Fallback: grade de ícones.
- Prova: 2 quadros com a esfera em rotações diferentes.

## E6 · Retrato com mapa técnico que se desenha
- Quando: saúde estética, estética, fitness, consultoria sobre o corpo/rosto (provado na landing de masterclass).
- Técnica: foto real recortada; SVG por cima com pontos e um path que liga os pontos, `strokeDashoffset` pelo scroll da seção pinada; numeral em odômetro; etapa ativa acende na lista ao lado.
- Parâmetros: 4 a 6 pontos; path em ouro com glow.
- Fallback: mapa completo estático com todos os pontos acesos.
- Prova: quadros no ponto 1, 3 e final.

## E7 · Figura de partículas que segue o mouse e se desfaz em poeira
- Quando: portfólio, estúdio, tecnologia, IA; herói com presença humana sem foto de banco.
- Técnica: malha (busto/objeto) amostrada em pontos (`MeshSurfaceSampler`, 20 a 60 mil pontos) renderizada como `Points` com shader; a cabeça gira suavemente para o ponteiro; perto do cursor (ou ao rolar) os pontos se deslocam por ruído e "viram poeira", voltando com mola.
- Parâmetros: tamanho do ponto 1 a 2px; cor única da marca sobre fundo claro ou escuro; dissipação 0 a 1 ligada ao scroll do herói.
- Fallback: imagem do busto pontilhado (pontilhismo exportado em PNG/SVG).
- Prova: 2 quadros, figura inteira e dissolvendo.

## E8 · Cursor com rastro de caracteres
- Quando: estúdio criativo, tecnologia, marca com voz forte (o rastro pode usar o nome da marca).
- Técnica: `pointermove` + `requestAnimationFrame`; a cada N px emite um caractere (do nome da marca ou glifos) que desvanece em 600 a 900ms; pool de 40 nós DOM reaproveitados.
- Parâmetros: só em ponteiro fino (`@media (pointer: fine)`); nunca sobre campos de formulário.
- Fallback: cursor nativo.
- Prova: 1 quadro com o rastro visível atrás do cursor.

## E9 · Botão principal com shader próprio
- Quando: o CTA é o momento mais importante da página.
- Técnica: `<canvas>` atrás do texto do botão com fragment shader (líquido, metal, ruído) reagindo ao hover (velocidade, distorção) e ao clique (onda); texto continua sendo `<button>` real, acessível.
- Parâmetros: 1 botão só com shader; contraste do texto conferido.
- Fallback: degradê da marca animado por CSS.
- Prova: 2 quadros, repouso e hover.

# Briefing de página em 1 parágrafo (o formato que gera sites extraordinários)

Antes de codar uma landing, escreva (e mostre ao usuário) um parágrafo neste molde. É o formato dos prompts das bibliotecas comerciais, e um parágrafo assim com 3 ou 4 interações nomeadas produz mais identidade do que 3 páginas de regras:

```
<Nome>: <tipo de página> de <quem> para <público>. Na abertura, <efeito de assinatura concreto, com o que acontece com o mouse/scroll>. <Interação 2>. <Interação 3>. <Interação 4 opcional>. Paleta <cores da marca>, tipografia <display + texto>, fotos <reais/tratamento>. Usa <bibliotecas>.
```

Exemplo do molde (analisado num vídeo de biblioteca de prompts): "Portfólio de uma designer de produto e marca para fintechs, jogos, IA e Web3. Na abertura, um manequim de malha pontilhada segue o mouse e se desfaz em poeira; o botão principal tem shader próprio; o cursor deixa um rastro de caracteres; um objeto 3D acompanha a rolagem. Usa GSAP e ScrollTrigger." Cada frase corresponde a uma receita (E7, E9, E8, E1).

## Como pedir (formato que o agente executa)
```
Seção: <hero|processo|galeria|oferta> · Efeito: E<n> · Conceito: <frase do negócio>
Conteúdo: <textos reais> · Mídia: <fotos/modelo 3D disponíveis>
Paleta e tipografia: <do DESIGN.md> · Restrições: <performance, mobile, acessibilidade>
Prova exigida: <quadros conforme a receita>
```
