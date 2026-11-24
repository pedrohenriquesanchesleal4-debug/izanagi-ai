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
  gsap.to(c,{scale:.94,filter:'brightness(.6)',scrollTrigger:{trigger:all[i+1],start:'top bottom',end:'top 12vh',scrub:true}}); });
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

> Gerado pelo Izanagi AI: cópia fiel de `skills/signature-experience/references.md` (fonte da verdade).
