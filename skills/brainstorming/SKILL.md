---
name: brainstorming
description: "Transforma uma ideia bruta em design/spec completo por entrevista dirigida em 3 fases (~15 perguntas, uma por vez) + 2 trilhas de referências (visual e técnica) + arquitetura/blueprint, antes de qualquer código. Use antes de criar features, componentes, funcionalidades ou modificar comportamento. HARD-GATE: nenhuma implementação até o design ser apresentado e aprovado. Inspirado no método brainstorming do obra/superpowers (264k stars)."
---

# Brainstorming — Da Ideia ao Design Aprovado

Método colaborativo para transformar intenção vaga em **spec validada** antes de escrever código. Uma pergunta por vez; nada de implementação antes da aprovação.

## Hard Gate (innegociável)

> **NÃO invoque skill de implementação, não escreva código, não scaffolde, não modifique nada até apresentar o design e o usuário aprovar.** Vale para todo projeto, mesmo os "simples". Única exceção: usuário dispensa explicitamente ("só vai" / "pode codar direto") — registre a dispensa e prossiga para o prompt rico + plano de implementação.

Anti-padrão: *"isto é simples demais para precisar de design"* — é exatamente em projetos simples que premissas não-examinadas causam mais retrabalho. O design pode ser curto (2 frases), mas deve existir e ser aprovado.

## Método STAR

**Shape** (o que é) → **Time** (prazo) → **Audience** (pra quem) → **Resources** (o que tem) — só depois de mapear os 4 você sugere direções.

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

- Repo original: [obra/superpowers](https://github.com/obra/superpowers) — 264k stars, MIT, repositório ativo. Skill `skills/brainstorming/SKILL.md`.
- Método completo: https://github.com/obra/superpowers/blob/main/skills/brainstorming/SKILL.md
- Baseado em TDD-YAGNI-DRY workflow (ver também `tdd` no Izanagi).
- Curadoria de referências do framework: `references/` (webgl-3d, scrollytelling, ui-design-systems, stack-2026, performance-seo) e `references.md` desta skill.
