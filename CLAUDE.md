# Izanagi AI — Claude Code Integration

Este projeto usa o **Izanagi AI Framework** — framework meta para engenharia de software autônoma orientada a agentes: arquitetura em camadas, biblioteca de skills especializadas e 21 agentes pré-definidos.

## Fonte da verdade

Este arquivo já cobre agentes, skills e regras essenciais do dia a dia — não precisa ler mais nada de saída. Consulte sob demanda só quando a tarefa exigir o tópico específico:

- `AGENTS.md` — só para: comandos avançados de dev, estrutura completa de pastas, release flow
- `SYSTEM.md` — só para: detalhes de engines internas, quality gates, arquitetura de memória
- `RULES.md` — só para: regras operacionais que não estejam listadas abaixo

## Agentes nativos (Agent tool)

Os 21 agentes em `.claude/agents/*.md` são **subagents nativos do Claude Code**: aparecem no Agent tool e o Claude delega sozinho quando a `description` de cada um bate com a tarefa (não precisa chamar por nome). Chame também por `/<slug>` em `.claude/commands/` quando quiser forçar um agente específico.

| Agente | Quando usar |
|---|---|
| `adversarial-critic` | Crítica adversarial de implementações: caçar bugs, falhas de… |
| `agent-architect` | Projeto de novos agentes especializados: Requirements → Capability… |
| `animation` | Motion Engineering & Experiências Cinematográficas Web… |
| `architect` | System Design de alta escala, Clean Architecture, DDD, CQRS,… |
| `automation-engineer` | Engenheiro de Automações Profissionais — decompõe o processo,… |
| `bug-hunter` | Debugging avançado em 6 fases (Reproduzir -> Isolar -> Hipótese ->… |
| `database` | Modelagem de dados relacional e NoSQL (PostgreSQL, Redis, MongoDB),… |
| `devops` | Infraestrutura como Código (Terraform/OpenTofu), Docker multi-stage… |
| `discovery` | Investigador de Pré-Produção — entrevista em 3 fases… |
| `docs` | Technical Writing High-Craft: READMEs profissionais executáveis,… |
| `evaluator` | Avaliação estruturada de resultados de agentes e workflows: score… |
| `form-engineer` | Engenharia de Formulários High-Craft: validação tipada Zod + React… |
| `pm` | Technical Product & Project Management: decomposição de épicos em… |
| `product-reasoner` | Raciocínio de produto e requisitos: converte intenção vaga em… |
| `professor` | Ensino Adaptativo & Mentoria Didática High-Craft: explicações… |
| `qa` | Quality Assurance & Test Automation Specialist: testes unitários… |
| `researcher` | Pesquisa estruturada baseada em evidência: coleta de fatos com… |
| `security` | Auditoria de segurança SAST/DAST, mitigação OWASP Top 10,… |
| `senior-engineer` | Full-Stack Software Engineer High-Craft — implementação profunda de… |
| `skill-architect` | Arquitetura de novas skills: Capability Gap → Research → Draft →… |
| `techlead` | Liderança técnica operacional, Code Review pedagógico em 5… |

**Execução paralela**: para tarefas com frentes independentes (ex.: Database + Security + QA num mesmo PR), dispare vários agentes de uma vez — cada um roda com contexto isolado e só o resultado final volta.

## Skills sempre carregadas

14 skills universais ficam nativas em `.claude/skills/<nome>/SKILL.md` (Claude Code carrega nome+descrição sempre; corpo completo só quando ativada):

- `caveman` — Ultra-compressed communication mode. Cuts output tokens…
- `brainstorming` — Transforma uma ideia bruta em design aprovado por…
- `deep-research` — Pesquisa multi-fonte na web: plano de busca, execução de…
- `ui-ux-pro-max` — Motor de busca local (BM25) com estilos, paletas,…
- `motion-design` — Escolha e uso de bibliotecas de animação web…
- `animation-web` — Scrollytelling, scroll-driven animations, sequências de…
- `webgl-3d` — Cenas 3D no navegador com Three.js/React Three Fiber,…
- `frontend` — Design tokens do Tailwind e padrões de UI de alto craft…
- `tdd` — Test-Driven Development com Iron Law: escreva o teste…
- `security-privacy` — Use ao implementar autenticação, autorização, validação…
- `qa` — Use para auditar código antes de merge/deploy: TypeScript…
- `memoria-projeto` — Mantém memória persistente do projeto entre sessões…
- `economia-tokens` — Engenharia de contexto para reduzir consumo de tokens sem…
- `handoff-sessao` — Grava um resumo curto do estado da tarefa em andamento…

## Skills especializadas (via agente)

As outras 89 skills da biblioteca (`skills/<nome>/SKILL.md`) não ficam pré-carregadas — cada agente nativo já referencia as suas na seção "Skills relevantes" do próprio `.claude/agents/<slug>.md` e as lê sob demanda quando é ativado. Isso evita pagar ~100 tokens fixos por skill em toda sessão só por ela existir na biblioteca.

## Regras essenciais

- **Arquitetura antes de código.** Toda decisão passa por engines de qualidade.
- **Anti-generic, alto craft.** Nunca entregue código/UI genérica "cara de IA" — estética Apple-like/Awwwards (`bg-zinc-950`, glassmorphism, bento grids, micro-interações).
- **Execução paralela.** Ative múltiplos agentes especializados para frentes distintas.
- **Baixo token, alto sinal.** Comprima respostas; nunca repita contexto.
- **Auto-correção e ensino.** Reflita após cada tarefa; ensine de forma adaptativa.
- **Segurança não é opcional.** Sem secrets no código, sem credenciais hardcoded.

## Sempre (consolidado de todos os agentes)

- Emitir veredicto claro (READY / READY_WITH_FIXES / NOT_READY) com lista priorizada de fixes
- Classificar cada finding por severidade com impacto técnico concreto
- Verificar cobertura de TODOS os requisitos do pedido original
- Rodar um pre-mortem (assumir que a entrega já falhou em produção e reconstruir a causa) antes de fechar a lista de findings
- Verificar na memória persistente quais agentes existem e o que já foi tentado antes de propor um agente novo
- Reaproveitar skills existentes na composição do agente — nova skill só com lacuna real comprovada
- Emitir o Agent Genome completo e normalizado (9 campos obrigatórios do runtime) antes de recomendar registro
- Declarar handoffs formais com motivo para todo agente projetado
- Aplicar least privilege nas permissions do agente projetado
- Projetar tool scoping deny-by-default: o agente nasce sem tools e cada uma é habilitada só com justificativa explícita de necessidade
- Animar exclusivamente propriedades aceleradas por GPU (`transform` e `opacity`) garantindo taxa de quadros constante de 60fps
- Implementar suporte completo a `prefers-reduced-motion: reduce` desativando parallax/motion intenso de forma graciosa

## Nunca (consolidado de todos os agentes)

- Implementar ou corrigir o código criticado
- Reportar problemas sem justificativa técnica
- Ignorar problemas de segurança por 'baixa probabilidade'
- Criar agente redundante quando um existente cobre a capacidade com ajuste de chain
- Registrar agente sem passar pela avaliação (métricas + minScore)
- Gerar prompts genéricos/inflados — o agente deve ser mais sistema do que prompt
- Projetar agente sem input/output contract definidos
- Animar propriedades que forçam repintura de layout (Layout Thrashing: `width`, `height`, `top`, `left`, `margin`)
- Usar animações genéricas sem propósito ou temporizações robóticas lineares sem curva de easing personalizada
- Deixar loops de renderização WebGL ou ScrollTriggers executando em segundo plano quando os elementos estão fora da viewport
- Compromover a acessibilidade ou legibilidade de texto em prol de efeitos visuais excessivos
- Propor arquiteturas de microsserviços hiper-fragmentados quando um Monólito Modular atende a todos os SLAs com menor custo operacional

---
Gerado pelo Izanagi AI em `/home/pedro/Documentos/VsCode/izanagi-ai/izanagi-ai` — `izanagi export --cli claude`
