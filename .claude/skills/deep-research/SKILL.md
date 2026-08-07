ok, ---
name: deep-research
description: "Pesquisa profunda em múltiplas fontes na web: gera plano de busca, executa múltiplas queries, coleta, sintetiza e entrega relatório estruturado com fontes citadas e nível de confiança. Use antes de decidir stacks, referências visuais, preços, concorrentes ou qualquer decisão baseada em informação externa. Inspirado nos agentes deep-research (OpenAI/Composio)."
---

# Deep Research

Método para transformar uma pergunta aberta em **relatório estruturado com fontes verificadas**, ideal antes de decisões de produto, stack, referências ou benchmarking.
## Quando usar
- Escolha de stack/biblioteca (comparação com dados atuais, não opinião). - Referências visuais reais de um nicho (sites campeões, tendências). - Análise de concorrentes / preço / posicionamento. - Verificação de fatos, APIs, versions, bre…
## Fluxo
Cubra ângulos: **termo principal** → **comparativo** → **alternativas** → **opinião/review** → **tendência recente (ano atual)** → **comunidade (GitHub/Reddit/forums)**. Grave o plano antes de executar.
- Execute as queries; para cada fonte relevante anote: URL, título, data, ponto-chave. - **Verifique a fonte**: priorize oficial/primária (docs, repos, stats) sobre blogs; desconfie de datas antigas em tópicos que mudam rápido (versões de…
- **Nunca invente fontes.** Se uma afirmação não tem fonte, marque como "não verificado".
Relatório final com:
- Apresente o relatório no chat (resumo + pontos-chave) e ofereça salvar em arquivo (`docs/research/<tema>.md`). - Sempre distinga **fato verificado** vs **opinião de fonte** vs **inferência minha**.
## Regras
- 1 query de cada vez em tópicos dependentes; paralelas em tópicos independentes. - No máximo 2 follow-ups por ângulo (evita espiral). - Cite a data de acesso para informação volátil. - Se a web falhar:

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/deep-research/SKILL.md`.
