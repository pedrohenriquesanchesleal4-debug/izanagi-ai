---
name: automation-research
description: "Pesquisa de solucoes existentes para automacoes: bibliotecas, APIs, projetos open-source, exemplos, padroes e limitacoes conhecidas. Use antes de implementar qualquer automacao com padrao conhecido."
---

# Automation Research — Pesquisar Antes de Reinventar

## O que pesquisar

1. **Documentação oficial** do serviço/ferramenta alvo (API, endpoints, auth, rate limits).
2. **Bibliotecas existentes**: quem já resolveu 80% do problema (pandas, openpyxl, Playwright, httpx...).
3. **Projetos open-source** similares: como estruturam, quais pitfalls encontraram.
4. **Padrões de arquitetura**: ETL, idempotência, retry, batching.
5. **Limitações conhecidas**: bugs, rate limits, mudanças de API, layout dinâmico.

## Fontes prioritárias

- Documentação oficial e exemplos verificados (nunca invente URLs).
- Referências curadas do framework (`references/`).
- Issues/PRs de repositórios relevantes para problemas reais.

## Regras

- A pesquisa é **referência técnica**, nunca cópia cega: entenda, adapte, melhore.
- Cite a fonte da decisão (ex: "Playwright escolhido porque X — fonte: docs oficiais").
- Se o problema for trivial e conhecido, pesquisa rápida basta — não burocratize.
- Nunca entregue solução sem verificar que ela existe e é atual (stack de 2026, não de 2019).

## References

- Ver `references.md` do skill `automation-engineer` (documentação canônica por domínio).
- Skill `deep-research` para pesquisas profundas multi-fonte.
