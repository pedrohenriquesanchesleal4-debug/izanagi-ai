---
name: automation-planning
description: "Planeja automações antes de codar: escopo, entradas/saídas, critérios de sucesso mensuráveis e riscos em 1 página. Use no início de qualquer tarefa de automação, antes de escrever código."
---

# Automation Planning

Planejamento de automações antes de qualquer código: escopo, entradas/saídas, critérios de sucesso mensuráveis, riscos e cronograma — em **1 página**, o suficiente para implementar sem ambiguidade e validar no final.

## Quando usar

Use **sempre no início** de qualquer tarefa de automação (planilha, API, browser, ETL) e ao receber um pedido vago de "automatizar X". **Pule** para: ajuste pontual em automação existente (planeje só o delta); o pedido já traz escopo fechado com critérios de aceite (valide e siga).

## Template de plano (1 página — preencha antes de codar)

```
## Automação: <nome>
- Objetivo: <1 frase, o que o negócio ganha>
- Entrada: <arquivo/API/planilha + formato + volume estimado>
- Saída: <destino + formato + o que acontece com duplicados>
- Etapas (decompostas):
  1. <etapa com verbo e entregável>
  2. ...
- Critérios de sucesso (mensuráveis):
  - [ ] <ex.: 100% das 1.234 linhas válidas chegam ao destino>
  - [ ] <ex.: execução < 10 min>
  - [ ] <ex.: zero erro silencioso (todo erro gera registro)>
- Riscos e mitigações:
  - <risco> → <mitigação>
- Fora de escopo (explícito): <o que NÃO será feito>
```

## Regras de planejamento

- **Decomponha até o entregável ser verificável**: cada etapa termina com algo que dá para testar.
- **Critério de sucesso = mensurável**: "funciona" não é critério; "100% das linhas com nota válida importadas" é.
- **Volume real importa**: 10 linhas vs 1 milhão mudam a solução (streaming, batching, paralelismo).
- **Duplicados e re-execução decididos no plano**: idempotência é decisão de design, não acidente.
- **Riscos nomeados com mitigação**: dados sensíveis → LGPD/mascaramento; rate limit → retries; layout do site → seletores resilientes.
- **Fora de escopo explícito**: evita "já que está pronto, faz também..." no meio do caminho.
- **Estimativa de tempo por etapa** e qual etapa é a mais arriscada (faça essa primeiro — fail fast).

## Checklist de qualidade (antes de implementar)

- [ ] Objetivo em 1 frase (negócio, não tecnologia)
- [ ] Entrada e saída definidas com formato e volume
- [ ] Etapas decompostas com entregável verificável cada
- [ ] Critérios de sucesso mensuráveis (números, não adjetivos)
- [ ] Riscos com mitigação (dados, rate limit, mudança de layout)
- [ ] Fora de escopo declarado
- [ ] Decisão de idempotência/re-execução tomada
- [ ] Etapa mais arriscada identificada (para fazer primeiro)

## Anti-padrões (proibido)

1. ❌ Codar direto sem plano ("é só uma planilha")
2. ❌ Critério de sucesso vago ("funciona", "dá certo")
3. ❌ Ignorar volume ("deve ser pouca coisa" — e eram 2 milhões de linhas)
4. ❌ Não decidir duplicados (descobre na 3ª execução)
5. ❌ Escopo implícito ("faça o que achar melhor")
6. ❌ Plano de 10 páginas ninguém lê — 1 página resolve
7. ❌ Sem fail-fast: implementar a parte fácil primeiro e o risco no final

## Composição com outras skills

- **Antes**: (nada — é a primeira) → opcional `automation-research` (entender o sistema-alvo)
- **Depois**: `technology-selection` (stack) → `api-automation`/`spreadsheet-automation`/`browser-automation` (implementação) → `testing-automation` (validação) → `automation-documentation` (README)

## References

- 12-factor (config/processos): https://12factor.net · Definition of Done: https://www.agilealliance.org/glossary/definition-of-done/ · Risk management (PMI): https://www.pmi.org/learning/library/risk-analysis-project-management-7070
- Veja `references.md` nesta pasta — curadoria de fontes canônicas (2026).

> Gerado pelo Izanagi AI — cópia fiel de `skills/automation-planning/SKILL.md` (fonte da verdade).
