---
name: "deep-research"
description: "Pesquisa multi-fonte na web: plano de busca, execução de queries, síntese e relatório com fontes citadas e nível de confiança. Use antes de decidir stack, referências visuais, preços ou concorrentes. Gatilhos de ativação: deep research — pesquisa multi-fonte com síntese; quando usar; fluxo; resumo executivo (3-5 linhas)."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Deep Research — Pesquisa Multi-Fonte com Síntese

> Migrado deterministicamente de `skills/deep-research/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Pesquisa multi-fonte na web: plano de busca, execução de queries, síntese e relatório com fontes citadas e nível de confiança.
- **Ativar quando:** Use antes de decidir stack, referências visuais, preços ou concorrentes.
- **Escopo canônico:** Deep Research — Pesquisa Multi-Fonte com Síntese
- **Seções do corpo original:** Quando usar · Fluxo · Resumo executivo (3-5 linhas) · Achados por pergunta (com fontes citadas: [1] https://...) · Comparativo (tabela quando houver múltiplas opções)
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-steps -->

### Passo 1 — Defina o objetivo e o escopo

```
PERGUNTA CENTRAL: <a pergunta que precisa responder>
USO: <qual decisão a resposta vai alimentar?>
NÍVEL: raso (3-5 fontes) | médio (6-12) | profundo (12-25)
RESTRIÇÕES: idioma, período, domínios permitidos
```

### Passo 2 — Plano de busca (5-8 queries)

Cubra ângulos: **termo principal** → **comparativo** → **alternativas** → **opinião/review** → **tendência recente (ano atual)** → **comunidade (GitHub/Reddit/forums)**. Grave o plano antes de executar.

### Passo 3 — Execução e coleta

- Execute as queries; para cada fonte relevante anote: URL, título, data, ponto-chave.
- **Verifique a fonte**: priorize oficial/primária (docs, repos, stats) sobre blogs; desconfie de datas antigas em tópicos que mudam rápido (versões de libs, preços, trends).
- Re-finete: se um ângulo ficou fraco, faça 1-2 queries de follow-up.
- **Nunca invente fontes.** Se uma afirmação não tem fonte, marque como "não verificado". Benchmarks 2026 de agentes de pesquisa (ex. DeepResearch Bench) mostram que quando 3-13% das URLs citadas são fabricadas, as métricas de "citação" ficam infladas e escondem o problema — por isso a checagem é sua, não do modelo: abra a fonte antes de citá-la, não confie em "parece plausível".
- **Nível profundo (12-25 fontes)**: decomponha em sub-perguntas independentes e trate cada uma como uma investigação isolada antes de sintetizar — o padrão *orchestrator-worker* usado por sistemas de pesquisa multi-agente (ex. Claude Research da Anthropic: um agente líder decompõe a pergunta e delega sub-investigações paralelas, cada uma com seu próprio conjunto de fontes) generaliza bem mesmo sem múltiplos agentes reais: você decompõe, pesquisa cada ramo a fundo, e só então sintetiza.

### Passo 4 — Síntese

Relatório final com:

```
# Relatório: <tema>

## Verification Steps

<!-- fonte da verificação: fallback-honesto:docs -->

- Executar literalmente cada comando documentado e confirmar que funciona como escrito (zero falsificação).
- Conferir que instalação, configuração (.env.example), execução e limitações estão presentes e corretas.
- Verificar que nenhuma referência foi citada sem verificação de URL/conteúdo.
- Pedir a uma pessoa externa (ou sessão fresca) que siga o documento e registre onde travou.

## Common Rationalizations

- **"Código limpo se auto-documenta, comentário é redundância."**
  - Verdade: Código mostra o COMO, nunca o PORQUÊ nem o contrato de uso. README com instalação/execução/configuração é parte da entrega, não cortesia.
- **"README eu escrevo antes do publish."**
  - Verdade: Antes do publish é depois do esquecimento. Documentação escrita junto à implementação captura decisões que em 3 dias já não estão mais na memória.
- **"Doc envelhece rápido, então melhor nem escrever."**
  - Verdade: Doc desatualizada é corrigível; doc ausente é institucionalizada ignorância. O framework exige limitações conhecidas documentadas — honestidade sobre o que falta é conteúdo, não fraqueza.
- **"Só eu uso esse projeto, documento é overhead."**
  - Verdade: 'Eu daqui a 6 meses' também é outro desenvolvedor. Handoff sem documentação transforma toda manutenção futura em arqueologia.
- **"Coloquei um exemplo genérico no README, serve."**
  - Verdade: Exemplo que não roda é pior que nenhum: ensina errado com autoridade. Todo comando documentado precisa ter sido executado de fato (zero falsificação).
- **"Referência eu completo depois, agora é só chute razoável."**
  - Verdade: URL inventada é alucinação documentada. Nunca entregue referência não verificada — pesquise ou declare explicitamente que não verificou.

## Red Flags

- README sem comando exato de instalação e execução testado.
- `.env.example` ausente num projeto que exige configuração.
- Documentação divergente do comportamento real do código.
- Seção 'Limitações' vazia ou omitida (finge completude).
- Link/referência citada sem verificação (risco de alucinação).
- Termo de domínio usado sem definição numa base nova.

## Legacy Reference (v1)

# Deep Research — Pesquisa Multi-Fonte com Síntese

Método para transformar uma pergunta aberta em **relatório estruturado com fontes verificadas**, ideal antes de decisões de produto, stack, referências ou benchmarking.

## Quando usar

- Escolha de stack/biblioteca (comparação com dados atuais, não opinião).
- Referências visuais reais de um nicho (sites campeões, tendências).
- Análise de concorrentes / preço / posicionamento.
- Verificação de fatos, APIs, versions, breaking changes.
- Qualquer decisão onde informação desatualizada custa caro.

## Fluxo

### 1. Defina o objetivo e o escopo

```
PERGUNTA CENTRAL: <a pergunta que precisa responder>
USO: <qual decisão a resposta vai alimentar?>
NÍVEL: raso (3-5 fontes) | médio (6-12) | profundo (12-25)
RESTRIÇÕES: idioma, período, domínios permitidos
```

### 2. Plano de busca (5-8 queries)

Cubra ângulos: **termo principal** → **comparativo** → **alternativas** → **opinião/review** → **tendência recente (ano atual)** → **comunidade (GitHub/Reddit/forums)**. Grave o plano antes de executar.

### 3. Execução e coleta

- Execute as queries; para cada fonte relevante anote: URL, título, data, ponto-chave.
- **Verifique a fonte**: priorize oficial/primária (docs, repos, stats) sobre blogs; desconfie de datas antigas em tópicos que mudam rápido (versões de libs, preços, trends).
- Re-finete: se um ângulo ficou fraco, faça 1-2 queries de follow-up.
- **Nunca invente fontes.** Se uma afirmação não tem fonte, marque como "não verificado". Benchmarks 2026 de agentes de pesquisa (ex. DeepResearch Bench) mostram que quando 3-13% das URLs citadas são fabricadas, as métricas de "citação" ficam infladas e escondem o problema — por isso a checagem é sua, não do modelo: abra a fonte antes de citá-la, não confie em "parece plausível".
- **Nível profundo (12-25 fontes)**: decomponha em sub-perguntas independentes e trate cada uma como uma investigação isolada antes de sintetizar — o padrão *orchestrator-worker* usado por sistemas de pesquisa multi-agente (ex. Claude Research da Anthropic: um agente líder decompõe a pergunta e delega sub-investigações paralelas, cada uma com seu próprio conjunto de fontes) generaliza bem mesmo sem múltiplos agentes reais: você decompõe, pesquisa cada ramo a fundo, e só então sintetiza.

### 4. Síntese

Relatório final com:

```
# Relatório: <tema>
## Resumo executivo (3-5 linhas)
## Achados por pergunta (com fontes citadas: [1] https://...)
## Comparativo (tabela quando houver múltiplas opções)
## Recomendação + porquê
## Riscos / pontos não verificados
## Fontes (lista completa numerada)
## Confiança: ALTA | MÉDIA | BAIXA + por quê
```

### 5. Entrega

- Apresente o relatório no chat (resumo + pontos-chave) e ofereça salvar em arquivo (`docs/research/<tema>.md`).
- Sempre distinga **fato verificado** vs **opinião de fonte** vs **inferência minha**.

## Regras

- 1 query de cada vez em tópicos dependentes; paralelas em tópicos independentes.
- No máximo 2 follow-ups por ângulo (evita espiral).
- Cite a data de acesso para informação volátil.
- Se a web falhar: diga o que não foi possível verificar, não preencha com suposição.

## Auto-checagem antes de entregar (rubrica de 3 eixos)

Benchmarks de avaliação de agentes de pesquisa (Deep-Research Eval, DeepResearch Bench II) julgam relatórios em 3 dimensões — use como checklist antes de entregar:

1. **Information Recall** — as fontes certas foram de fato consultadas? Falta algum ângulo óbvio do plano de busca?
2. **Analysis** — o relatório produz insight de nível mais alto (comparação, trade-off, recomendação) ou só empilha fatos soltos?
3. **Presentation** — a estrutura (resumo → achados → comparativo → recomendação → riscos → fontes) está clara e cada afirmação rastreável até uma fonte numerada?

Mesmo os melhores sistemas em 2026 erram em "citation quality" e "factual accuracy" (~65-68% nos benchmarks públicos) — trate isso como razão para marcar explicitamente o nível de confiança, não para relaxar a checagem.

## References

- Inspiração: OpenAI Deep Research (chatgpt.com/deep-research) e agentes open-source `deep-research` (ex.: [dzhng/deep-research](https://github.com/dzhng/deep-research), [langchain-ai/open_deep_research](https://github.com/langchain-ai/open_deep_research)).
- Arquitetura multi-agente de referência: [Anthropic — "How we built our multi-agent research system"](https://www.anthropic.com/engineering/multi-agent-research-system) (padrão orchestrator-worker: agente líder decompõe e delega sub-investigações paralelas com contexto próprio; ganho de >90% sobre agente único em avaliações internas, ao custo de ~15x mais tokens — use decomposição mesmo sem múltiplos agentes reais).
- Avaliação de qualidade: DeepResearch Bench II (2026) e Deep-Research Eval — citação e precisão factual seguem sendo os eixos mais fracos dos agentes de pesquisa atuais; nunca superestime a própria saída.
- Ferramentas de busca do agente: `websearch` + `webfetch` nativos do Opencode.
- Curadoria completa em `references.md`.
