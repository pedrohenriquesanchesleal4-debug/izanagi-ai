---
name: "anti-ai-slop"
description: "Detecta e corrige design 'cara de IA' (Inter default, gradiente roxo-azul, hero + 3 cards, glassmorphism genérico) com tipografia, cor e layout intencionais. Use ao revisar qualquer UI antes de entregar. Gatilhos de ativação: anti ai-slop (zero \"cara de ia\"); identidade; por que ias geram ui genérica (contexto); catálogo de tells (detectar e eliminar)."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Anti AI-Slop (Zero "Cara de IA")

> Migrado deterministicamente de `skills/anti-ai-slop/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Detecta e corrige design 'cara de IA' (Inter default, gradiente roxo-azul, hero + 3 cards, glassmorphism genérico) com tipografia, cor e layout intencionais.
- **Ativar quando:** Use ao revisar qualquer UI antes de entregar.
- **Escopo canônico:** Anti AI-Slop (Zero "Cara de IA")
- **Seções do corpo original:** Identidade · Por que IAs geram UI genérica (contexto) · Catálogo de Tells (detectar e eliminar) · Processo · Regras de Saída
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

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Inter como fonte única (o tell #1). Fix: trocar por pairing com personalidade (ex: Space Grotesk + Inter Tight, Fraunces + Archivo, JetBrains Mono + Sora, Instrument Serif + General Sans).
- [ ] Peso/tamanho uniforme em todos os títulos. Fix: hierarquia agressiva (display 96-160px vs body 16px).
- [ ] Gradiente roxo→azul / violeta / fuchsia / pink (via-purple-*, to-pink-*, from-fuchsia-*). Fix: uma cor dominante forte + um acento afiado, sem gradiente tímido (ou gradiente sutil da MESMA família).
- [ ] Paleta default do Tailwind sem modificação. Fix: tokens customizados por nicho.
- [ ] Fundo #f9fafb + cards brancos + sombra sutil. Fix: superfícies com mais caráter (off-white quente, dark OLED, tons terrosos, papel).
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

## Regras de Saída
- Fixes com código real (não descrição). Nunca stubs.
- Após o fix, rode o scan anti-tell de novo: ZERO ocorrências do catálogo.
- Se o usuário pediu um estilo específico (ex: "quero glassmorphism"), respeite, mas aplique com refinamento (glass 2.0: translucidez sutil, noise, gradient borders, sem blur pesado).
- Referências de qualidade: Linear, Vercel, Stripe, Apple, Awwwards SOTD — use o vocabulário, nunca copie.
