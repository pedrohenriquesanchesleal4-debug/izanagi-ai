---
name: brainstorming
description: "Transforma uma ideia bruta em design aprovado por entrevista dirigida (~15 perguntas), referências e blueprint de arquitetura. Use antes de criar features ou componentes — hard-gate até o design ser aprovado."
---

# Brainstorming — Da Ideia ao Design Aprovado

Método colaborativo para transformar intenção vaga em **spec validada** antes de escrever código. Uma pergunta por vez; nada de implementação antes da aprovação.

## Hard Gate (innegociável)

> **NÃO invoque skill de implementação, não escreva código, não scaffolde, não modifique nada até apresentar o design e o usuário aprovar.** Vale para todo projeto, mesmo os "simples". Única exceção: usuário dispensa explicitamente ("só vai" / "pode codar direto") — registre a dispensa e prossiga para o prompt rico + plano de implementação.

Anti-padrão: *"isto é simples demais para precisar de design"* — é exatamente em projetos simples que premissas não-examinadas causam mais retrabalho. O design pode ser curto (2 frases), mas deve existir e ser aprovado.

## Método STAR

**Shape** (o que é) → **Time** (prazo) → **Audience** (pra quem) → **Resources** (o que tem) — só depois de mapear os 4 você sugere direções.

## Triagem por peso da tarefa (antes da entrevista completa)

O Superpowers original (`obra/superpowers`, skill `brainstorming`) classifica todo pedido em 3 trilhas antes de decidir o tamanho da entrevista — evita aplicar as ~15 perguntas a um ajuste trivial e evita subestimar algo que parece simples:

1. **Spike** — "pergunta de viabilidade cuja saída é uma resposta, não código que você mantém". Descreva a sonda em 2-3 frases, peça aprovação, investigue barato, reporte achados. Não vira feature.
2. **Bounded** — "mudança bem delimitada em código que já existe no repo". Entenda o fluxo existente; apresente um design curto **no próprio chat** (poucas frases a parágrafos curtos); aprove e implemente direto — sem doc de plano separado.
3. **Architectural** — projetos novos, subsistemas novos, mudanças que reestruturam como componentes se encaixam. Segue o processo completo: doc de spec escrito + múltiplos gates de aprovação (este é o fluxo detalhado abaixo).

Regra de desempate: **"quando em dúvida entre duas trilhas, escolha a mais pesada"**; e **complexidade oculta descoberta no meio da tarefa faz upgrade de trilha** (ex.: um Bounded que revela reestruturação vira Architectural). Só após o design Architectural aprovado é que se invoca a skill de planejamento (`writing-plans` no Superpowers / `task-planner` no Izanagi) — nenhuma outra skill de implementação antes disso.

## Entrevista em 3 Fases (~15 perguntas, UMA por vez — nunca dump)

### Fase 1 — Visão & Contexto (5 perguntas)
1. O que você quer construir? (1 linha)
2. Qual problema isso resolve?
3. Contexto atual: projeto existente? arquivos? stack? prazo? orçamento?
4. Para quem é? (público-alvo)
5. Sucesso = o quê? (métrica/CTA principal)

### Fase 2 — Produto & Conteúdo (5 perguntas)
6. Funcionalidades essenciais vs desejáveis? (MoSCoW: Must/Should/Could/Won't)
7. Quais seções/conteúdo o projeto precisa ter?
8. Integrações externas? (API, CMS, pagamento, analytics)
9. Quem é o usuário principal? (persona: nome, idade, dor)
10. Concorrentes ou inspirações que você conhece?

**Técnica de apoio (Continuous Discovery Habits, Teresa Torres)**: ao mapear dor/oportunidade, monte uma **Opportunity Solution Tree** mental — outcome desejado no topo, oportunidades (dores/necessidades observadas) como galhos, soluções candidatas como folhas. Ajuda a não pular direto pra "solução" (feature) sem validar a oportunidade por trás. Se o usuário tiver acesso a usuários reais, sugira o hábito de **1 entrevista por semana com o "trio"** (produto/design/engenharia) em vez de pesquisa pontual — reduz o risco de construir sobre suposição não testada.

### Fase 3 — Experiência & Técnica (5+ perguntas)
11. Nível de animação? (estático → micro → cinematográfico/scrollytelling → 3D/WebGL)
12. Preferências visuais? (dark/light, cores, marcas que admira)
13. Dispositivos prioritários? (mobile-first? desktop?)
14. Stack preferida ou aberto a sugestão?
15. Restrições? (acessibilidade, performance, LGPD, SEO, idiomas)
16. Se necessário: orçamento de tempo/recursos?

**Aceleração**: perguntas já respondidas no pedido inicial ficam marcadas — nunca repetir. Se o usuário dispensar, pule para o design/produto final.

## Referências — 2 Trilhas OBRIGATÓRIAS

1. **Trilha visual** (se o usuário não trouxer refs): Awwwards, Godly, Land-book, uiprompt, Lapa — extrair princípios reais (*por que* funciona) com URLs reais. Nunca inventar.
2. **Trilha técnica** (provar que referência vira código): threejs.org/examples, sketchfab.com, poly.pizza, market.pmnd.rs, R3F (pmndrs/react-three-fiber), shadertoy.com, GSAP/ScrollTrigger (gsap.com/docs), Lenis (darkroomengineering/lenis), codepen.io, fonts.google.com, coolors.co.

Consultar curadoria canônica em `references/` do framework (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo).

## Arquitetura & Blueprint (antes de finalizar o design)

Proponha: estrutura de diretórios; stack com justificativa; modelo de dados (entidades + relações); endpoints/rotas principais; componentes-chave; **ADR-lite** com 3-5 decisões de arquitetura e trade-offs. Usar aliases `architect`, `data-engineering`, `db` do resolver.

## Fluxo de execução

1. **Explore o contexto do projeto** — arquivos, docs, commits recentes, stack
2. **Perguntas de esclarecimento** — 3 fases, UMA por vez, múltipla escolha quando possível
3. **2 Trilhas de referências** — visual + técnica, com URLs reais e porquês
4. **Proponha 2–3 abordagens** — com trade-offs e sua recomendação primeiro
5. **Arquitetura & Blueprint** — diretórios, stack, dados, endpoints, ADR-lite
6. **Apresente o design em seções** — escale ao tamanho do problema; consiga aprovação após cada seção
7. **Confirme o norte** (1 pergunta) — HARD-GATE
8. **Escreva o design doc / prompt rico** — `docs/superpowers/specs/YYYY-MM-DD-<tema>-design.md` (ou prompt rico do Discovery) e commite
9. **Auto-revisão do spec** — placeholders? contradições? ambiguidade? escopo? Corrija inline
10. **Devolva ao usuário** — "Spec escrito em `<path>`. Revisa antes de planejarmos a implementação?"
11. **Transição** — aponte para a escrita do plano de implementação (no Izanagi: `task-planner` / agente relevante)

## Regras de entrevista

- Uma pergunta por mensagem (duas ou mais = questionário-descarga).
- Múltipla escolha quando der; aberta quando necessário.
- Foque em: propósito, restrição, critério de sucesso.
- Se o pedido descrever múltiplos subsistemas independentes, **decomponha primeiro** (o que é independente, como se relacionam, ordem) e faça o brainstorm do primeiro sub-projeto.
- YAGNI: corte agressivamente o que não serve ao objetivo.
- Em codebase existente: siga os padrões atuais; inclua melhorias direcionadas apenas se fizer sentido para o objetivo; não refatore sem relação.

## Design para isolamento

Cada unidade deve: ter um propósito, expor interface clara, ser testável de forma independente. Você deve conseguir responder "o que faz / como se usa / do que depende" sem ler internals. Se um arquivo cresceu demais, é sinal de que está fazendo demais.

## References

- Repo original: [obra/superpowers](https://github.com/obra/superpowers) — framework de skills + metodologia de desenvolvimento por Jesse Vincent (Prime Radiant), MIT, ativo em 2026. Skill `skills/brainstorming/SKILL.md`.
- Método completo (triagem Spike/Bounded/Architectural, handoff para `writing-plans`): https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md
- Discovery de produto orientado a evidência: Teresa Torres, *Continuous Discovery Habits* — Opportunity Solution Tree, hábito semanal de entrevista com o "trio" (produto/design/engenharia) antes de comprometer-se com uma solução.
- Baseado em TDD-YAGNI-DRY workflow (ver também `tdd` no Izanagi).
- Curadoria de referências do framework: `references/` (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo) e `references.md` desta skill.
