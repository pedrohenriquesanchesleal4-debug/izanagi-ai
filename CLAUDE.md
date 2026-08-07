# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 12 agentes pré-definidos.

## Fonte da verdade

> **Leia `AGENTS.md` antes de qualquer tarefa.** Ele é a referência completa do framework (agentes, comandos, estrutura, release flow). Este arquivo é apenas um resumo operacional.

- `AGENTS.md` — referência canônica do framework
- `SYSTEM.md` — fundação do sistema (engines, quality gates, memória)
- `RULES.md` — regras operacionais

## Agentes (comandos slash)

Ative com `/` no Claude Code — os 12 comandos estão em `.claude/commands/`:

- `/animation` — Diretor de Experiência Cinematográfica Web — scrollytelling, scroll-driven, 3D WebGL, motion design de alto craft. Nunca entrega site estático ou animação genérica.
- `/architect` — Arquiteta sistemas com trade-offs explícitos, ADRs, planos de implementação e JIT de complexidade
- `/bug-hunter` — Caça bugs sistêmicos — reproduz, isola, causa raiz, corrige com teste de regressão
- `/database` — Modelagem rigorosa, SQL otimizado a partir do plano real, migrações seguras e reversíveis
- `/devops` — Infraestrutura como código, deploy seguro e rápido, CI/CD, observabilidade e runbooks
- `/discovery` — Investigador de Pré-Produção — entrevista em 3 fases (~15 perguntas, uma por vez), pesquisa referências REAIS em 2 trilhas (visual + técnica), arquiteta a solução (blueprint + ADR-lite) e entrega um prompt rico de implementação. Nunca escreve código: o HARD-GATE só cai por dispensa explícita do usuário.
- `/docs` — Documentação técnica que as pessoas usam — README, APIs, arquitetura, guias e diagramas
- `/pm` — Entrega de projetos — escopo, tarefas atômicas, riscos, milestones, comunicação enxuta
- `/professor` — Ensino adaptativo e mentoria — conceito → porquê → exemplo → prática, sem deixar dúvida
- `/security` — Audita, previne e corrige vulnerabilidades (OWASP Top 10, auth, secrets, LGPD) — com fix acionável
- `/senior-engineer` — Full-stack de alto craft — código limpo, seguro, testado e entregue rápido (sem redundância)
- `/techlead` — Liderança técnica — decisões de arquitetura, code review que ensina, desbloqueio e dívida técnica

## Skills curadas

13 skills disponíveis em `.claude/skills/<nome>/SKILL.md` (carregadas automaticamente quando relevantes):

- `brainstorming` — Transforma uma ideia bruta em design/spec completo por entrevista dirigida em 3 fases (~15 perguntas, uma por vez) + 2…
- `deep-research` — Pesquisa profunda em múltiplas fontes na web: gera plano de busca, executa múltiplas queries, coleta, sintetiza e entre…
- `ui-ux-pro-max` — Design intelligence profissional para UI/UX: gera design system completo (padrão, estilo, paleta, tipografia, efeitos,…
- `motion-design` — Skill de Motion Design para Web — escolha e uso correto de bibliotecas de animação: GSAP (ScrollTrigger, SplitText), An…
- `animation-web` — Skill de Web Animation Cinematográfica — scrollytelling, scroll-driven animations, scroll image sequences (estilo Apple…
- `webgl-3d` — Skill de 3D na Web — Three.js, React Three Fiber, WebGL, shaders (GLSL), scroll-driven 3D, partículas, modelos GLTF e p…
- `frontend` — Skill de frontend para o Izanagi. Contém todos os design tokens do Tailwind CSS, padrões de design identificados nas pá…
- `tdd` — Test-Driven Development com Iron Law: escreva o teste antes, veja falhar, código mínimo para passar, refatore. Use em q…
- `security-privacy` — Skill de Seguranca e Privacidade para o Izanagi. Aborda OWASP Top 10, LGPD/GDPR, seguranca de APIs, authentication, aut…
- `qa` — Skill de Quality Assurance para o IzanagiAI. Contém checklist completo de qualidade de código, validações de acessibili…
- `memoria-projeto` — Mantém memória persistente do projeto entre sessões, guardando decisões, padrões de código e erros já resolvidos, para…
- `economia-tokens` — Reduz o consumo de tokens em QUALQUER tarefa de código ou análise de arquivos. Use sempre, em toda tarefa — não é preci…
- `handoff-sessao` — Grava um resumo curto do estado da tarefa em andamento para retomar na próxima sessão sem perder contexto e sem precisa…

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (`bg-zinc-950`, glassmorphism, bento grids, micro-interações).
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

## Sempre (consolidado dos 12 agentes)

- Storyboard por cenas com intenção narrativa — nunca animar por animar
- Definir e manter a Assinatura de Movimento (easing/timing/tempo) consistente em todo o site
- Tratar scroll como timeline scrub (ease: 'none' proporcional), não só gatilho one-shot
- Só animar transform + opacity; 60fps é requisito de entrega
- Respeitar prefers-reduced-motion e prover fallback sem JS/WebGL
- Performance é orçamento: LCP < 2.5s, INP < 200ms, CLS < 0.1 (validar com Lighthouse)
- Mobile: repensar pinning pesado e câmeras longas (matchMedia), nunca simplesmente encolher
- Consultar referências antes: Apple, Red Bull storytelling, uiprompts, Trionn, Obys, Codrops case studies
- Se a tarefa é visual: 1 tela fiel + 1 alternativa ousada (trade-off explícito)
- Eficiência de execução: uma entrega por arquivo, sem re-gravurar arquivos, sem repetição no chat
- Trade-offs explícitos em formato ADR (contexto → opção → trade → decisão)
- Perguntar o que falta em requisitos (hipotecagens em vez de supor)

## Nunca (consolidado dos 12 agentes)

- Entregar site estático quando o pedido pedir animação
- Usar WebGL para efeito que CSS 3D resolve (ou Scroll-Driven Animations CSS)
- Animar sem propósito (mover porque pode)
- Ignorar mobile, DPR cap, LCP, reduced motion
- Copiar código de biblioteca sem checar a versão (ex: Anime.js v3 vs v4, GSAP 3.x APIs)
- Entregar template genérico 'cara de IA' (gradiente + fade padrão sem design system)
- Reler arquivos já lidos ou repetir conteúdo no chat (economia de tokens)
- Codificar sem plano nem ADR
- Arquitetura de moda (microserviço para tudo)
- Otimizar prematuramente o que não é gargalo
- Assumir requisitos completos
- Fixar sem reproduzir

---
Gerado pelo Izanagi AI em `C:\Users\pedro.leal\Documents\NexusAI` — `izanagi export --cli claude`
