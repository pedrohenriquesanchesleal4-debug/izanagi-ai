---
name: automation-research
description: "Pesquisa estruturada antes de implementar automações: documentação oficial (endpoints, auth, rate limits), bibliotecas que já resolvem 80%, projetos open-source similares, padrões de arquitetura (ETL, idempotência, retry, batching), limitações conhecidas e fontes prioritárias curadas. Use antes de implementar qualquer automação com padrão conhecido — nunca reinvente a roda nem copie cegamente."
---

# Automation Research — Pesquisar Antes de Reinventar

Pesquisa técnica dirigida: descobre o que **já existe**, o que **funciona** e o que **quebra** antes de escrever a primeira linha. A pesquisa é referência, nunca cópia cega.

## Quando usar

Use no início de **toda** automação com padrão conhecido: integrar com serviço/API, processar planilhas, automatizar browser, ETL, scraping. **Pule** para problemas triviais e totalmente conhecidos (pesquisa rápida basta) ou quando o usuário já definiu a stack explicitamente (confirme apenas limitações).

## O que pesquisar (checklist dirigido)

| # | Tópico | Perguntas-chave |
|---|---|---|
| 1 | **Documentação oficial** do alvo | Endpoints, auth (tipo de token, escopo), rate limits, paginação, campos obrigatórios, sandbox? |
| 2 | **Bibliotecas existentes** | Quem resolve 80%? (pandas/openpyxl, Playwright/Selenium, httpx/requests, gspread...) — está atualizada? (2026, não 2019) |
| 3 | **Projetos open-source** similares | Como estruturam? Quais pitfalls documentaram? (issues/PRs = problemas reais) |
| 4 | **Padrões de arquitetura** | ETL, idempotência, retry com backoff, batching, checkpoint — qual padrão o caso exige? |
| 5 | **Limitações conhecidas** | Bugs, rate limits, mudanças de API (deprecations), layout dinâmico, encoding BR, caracteres especiais |

## Fontes prioritárias (nesta ordem)

1. **Documentação oficial** + exemplos verificados — **nunca invente URLs** (regra do framework: URLs canônicas curadas em `references/`).
2. **`references/` do framework**: `repos-ai-agents.md` (curadoria de repos top: obra/superpowers, addyosmani/agent-skills, ComposioHQ...), `stack-2026.md` (stack atual), e `references.md` do skill `automation-engineer` (docs canônicas por domínio).
3. **Issues/PRs** de repos relevantes (sintomas reais, workarounds, problemas de versão).
4. **Deep-research** (skill do framework) para pesquisas profundas multi-fonte com relatório estruturado e nível de confiança.

## Workflow (5 passos)

1. **Defina o alvo**: o que a automação toca (serviço X, formato Y) e o que precisa saber (auth? rate limit? schema?).
2. **Pesquise a fonte oficial primeiro**: docs → exemplos → changelog (mudanças recentes que quebram integração).
3. **Cace a biblioteca certa**: PyPI/GitHub, estrelas, última release (se >2 anos sem release, desconfie), manutenção ativa.
4. **Colete limitações**: issues abertas sobre o caso de uso específico, rate limits documentados, formatos problemáticos (encoding, datas).
5. **Registre a decisão com fonte**: "Playwright escolhido porque X — fonte: docs oficiais" / "API suporta batch de 50 — fonte: docs v3".

## Regras

- **Pesquisa é referência técnica, nunca cópia cega**: entenda, adapte, melhore para o caso.
- **Cite a fonte da decisão** no relatório/README — decisão sem fonte não é decisão, é achismo.
- **Problema trivial = pesquisa rápida**: não burocratize com relatório formal para o que é óbvio.
- **Nunca entregue solução baseada em stack desatualizada**: verifique que a biblioteca/API é a atual (2026, não 2019).
- **Se a pesquisa contradiz o plano inicial**, pare e ajuste o plano (pesquisa existe para isso).

## Anti-padrões (proibido)

1. ❌ Copiar código de blog/Stack Overflow sem entender e sem verificar versão
2. ❌ Usar biblioteca desatualizada "porque já conheço" (ex: Selenium quando Playwright resolve melhor)
3. ❌ Inventar URLs/endpoints que não foram verificados
4. ❌ Pular a pesquisa "porque é simples" e descobrir o rate limit depois do ban
5. ❌ Implementar solução proprietária quando existe padrão open-source consolidado
6. ❌ Ignorar changelog de breaking changes da API alvo

## Checklist de qualidade (antes de implementar)

- [ ] Fonte oficial consultada (docs/endpoints/auth/rate limits)
- [ ] Biblioteca escolhida justificada + atualizada
- [ ] Limitações conhecidas coletadas (issues, changelog)
- [ ] Decisão registrada com fonte citada
- [ ] Stack alinhada ao ano atual (2026)

## Composição com outras skills

- **Antes**: `automation-planning` (escopo → define o que pesquisar) → `deep-research` (se pesquisa profunda)
- **Depois**: `technology-selection` (escolha final justificada) → `automation-engineer` (implementação) → `automation-documentation` (registrar decisões com fonte no README)

## References

- Ver `references.md` do skill `automation-engineer` (documentação canônica por domínio) e `references/repos-ai-agents.md` do framework.
- Skill `deep-research` para pesquisas profundas multi-fonte com relatório estruturado.
