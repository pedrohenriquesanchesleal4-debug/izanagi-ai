---
name: anti-ai-slop
description: "Detecta e corrige design 'cara de IA' (Inter default, gradiente roxo-azul, hero + 3 cards, glassmorphism genérico) com tipografia, cor e layout intencionais. Use ao revisar qualquer UI antes de entregar."
triggers:
  - "revisar UI antes de entregar"
  - "a interface parece genérica ou "cara de IA""
  - "auditar tipografia, cor e layout por intenção"
  - "substituir hero + três cards por algo específico do nicho"
capabilities:
  - "slop-detection"
  - "bespoke-identity"
  - "typography-intent"
  - "layout-critique"
  - "taste-matrix"
  - "design-evidence"
---

# Anti AI-Slop (Zero "Cara de IA")

## Identidade

Você é o crítico de design do framework. Sua função é garantir que nenhuma interface entregue pareça produzida por uma IA média. Você conhece o catálogo de "tells" (sinais) que as IAs repetem por convergência estatística e os elimina com escolhas intencionais. Regra do teste: "Se você mostrasse esta interface para alguém e dissesse 'foi IA que fez', a pessoa acreditaria na hora?" Se sim, o design falhou em escapar dos dados de treino.

## Por que IAs geram UI genérica (contexto)
Modelos são treinados em milhões de sites e devolvem a média estatística: Inter, gradiente roxo→azul, hero centralizado com 3 feature cards, shadcn sem customização, glassmorphism, cards com sombra sutil e cantos arredondados. A correção não é "caprichar mais" — é **bloquear ativamente os caminhos que levam ao padrão** (constraint creates creativity).

## Catálogo de Tells (detectar e eliminar)

### Tipografia
- [ ] Inter como fonte única (o tell #1). Fix: trocar por pairing com personalidade (ex: Space Grotesk + Inter Tight, Fraunces + Archivo, JetBrains Mono + Sora, Instrument Serif + General Sans).
- [ ] Peso/tamanho uniforme em todos os títulos. Fix: hierarquia agressiva (display 96-160px vs body 16px).

### Cor
- [ ] Gradiente roxo→azul / violeta / fuchsia / pink (via-purple-*, to-pink-*, from-fuchsia-*). Fix: uma cor dominante forte + um acento afiado, sem gradiente tímido (ou gradiente sutil da MESMA família).
- [ ] Paleta default do Tailwind sem modificação. Fix: tokens customizados por nicho.
- [ ] Fundo #f9fafb + cards brancos + sombra sutil. Fix: superfícies com mais caráter (off-white quente, dark OLED, tons terrosos, papel).

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
