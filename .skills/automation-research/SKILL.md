---
name: "automation-research"
description: "Pesquisa documentação oficial, bibliotecas e projetos similares antes de implementar uma automação com padrão conhecido. Use antes de codar integrações, ETL, scraping ou automação de browser. Gatilhos de ativação: automation research — pesquisar antes de reinventar; quando usar; o que pesquisar (checklist dirigido); fontes prioritárias (nesta ordem)."
version: 2.0.0
category: docs
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
---

# Automation Research — Pesquisar Antes de Reinventar

> Migrado deterministicamente de `skills/automation-research/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Documentação & Comunicação (`docs`)
- **Resumo:** Pesquisa documentação oficial, bibliotecas e projetos similares antes de implementar uma automação com padrão conhecido.
- **Ativar quando:** Use antes de codar integrações, ETL, scraping ou automação de browser.
- **Escopo canônico:** Automation Research — Pesquisar Antes de Reinventar
- **Seções do corpo original:** Quando usar · O que pesquisar (checklist dirigido) · Fontes prioritárias (nesta ordem) · Workflow (5 passos) · Regras
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Defina o alvo:

**Defina o alvo**: o que a automação toca (serviço X, formato Y) e o que precisa saber (auth? rate limit? schema?).

### Passo 2 — Pesquise a fonte oficial primeiro:

**Pesquise a fonte oficial primeiro**: docs → exemplos → changelog (mudanças recentes que quebram integração).

### Passo 3 — Cace a biblioteca certa:

**Cace a biblioteca certa**: PyPI/GitHub, estrelas, última release (se >2 anos sem release, desconfie), manutenção ativa.

### Passo 4 — Colete limitações:

**Colete limitações**: issues abertas sobre o caso de uso específico, rate limits documentados, formatos problemáticos (encoding, datas).

### Passo 5 — Registre a decisão com fonte:

**Registre a decisão com fonte**: "Playwright escolhido porque X — fonte: docs oficiais" / "API suporta batch de 50 — fonte: docs v3".

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Fonte oficial consultada (docs/endpoints/auth/rate limits)
- [ ] Biblioteca escolhida justificada + atualizada
- [ ] Limitações conhecidas coletadas (issues, changelog)
- [ ] Decisão registrada com fonte citada
- [ ] Stack alinhada ao ano atual (2026)

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
