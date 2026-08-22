---
name: "automation-planning"
description: "Planeja automações antes de codar: escopo, entradas/saídas, critérios de sucesso mensuráveis e riscos em 1 página. Use no início de qualquer tarefa de automação, antes de escrever código. Gatilhos de ativação: automation planning; quando usar; template de plano (1 página — preencha antes de codar); automação: <nome>."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Automation Planning

> Migrado deterministicamente de `skills/automation-planning/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Planeja automações antes de codar: escopo, entradas/saídas, critérios de sucesso mensuráveis e riscos em 1 página.
- **Ativar quando:** Use no início de qualquer tarefa de automação, antes de escrever código.
- **Escopo canônico:** Automation Planning
- **Seções do corpo original:** Quando usar · Template de plano (1 página — preencha antes de codar) · Automação: <nome> · Regras de planejamento · Checklist de qualidade (antes de implementar)
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — ❌ Codar direto sem plano ("é só uma planilha")

❌ Codar direto sem plano ("é só uma planilha")

### Passo 2 — ❌ Critério de sucesso vago ("funciona", "dá certo")

❌ Critério de sucesso vago ("funciona", "dá certo")

### Passo 3 — ❌ Ignorar volume ("deve ser pouca coisa" — e eram 2 milhões de linhas)

❌ Ignorar volume ("deve ser pouca coisa" — e eram 2 milhões de linhas)

### Passo 4 — ❌ Não decidir duplicados (descobre na 3ª execução)

❌ Não decidir duplicados (descobre na 3ª execução)

### Passo 5 — ❌ Escopo implícito ("faça o que achar melhor")

❌ Escopo implícito ("faça o que achar melhor")

### Passo 6 — ❌ Plano de 10 páginas ninguém lê — 1 página resolve

❌ Plano de 10 páginas ninguém lê — 1 página resolve

### Passo 7 — ❌ Sem fail-fast:

❌ Sem fail-fast: implementar a parte fácil primeiro e o risco no final

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] <ex.: 100% das 1.234 linhas válidas chegam ao destino>
- [ ] <ex.: execução < 10 min>
- [ ] <ex.: zero erro silencioso (todo erro gera registro)>
- [ ] Objetivo em 1 frase (negócio, não tecnologia)
- [ ] Entrada e saída definidas com formato e volume
- [ ] Etapas decompostas com entregável verificável cada
- [ ] Critérios de sucesso mensuráveis (números, não adjetivos)
- [ ] Riscos com mitigação (dados, rate limit, mudança de layout)
- [ ] Fora de escopo declarado
- [ ] Decisão de idempotência/re-execução tomada

## Common Rationalizations

- **"É só um protótipo, refatoro depois."**
  - Verdade: Protótipo sem testes vira produção por acidente. O 'depois' não existe: quem paga a dívida é o próximo commit. Regra do framework: código esparso ou stub (`TODO`, `implement later`) é entrega proibida.
- **"Compila (ou rodou uma vez), então funciona."**
  - Verdade: Compilar valida sintaxe, não comportamento. Anti-falhas é lei: Executar → Esperar → Verificar resultado esperado → Registrar. Sem verificação, sucesso é suposição.
- **"Caso extremo nunca vai acontecer."**
  - Verdade: Vazio, duplicado, timeout e dado inválido acontecem no primeiro lote real. Validação antes de ação irreversível não é opcional — é pré-condição de execução.
- **"Abstraio agora que depois fica fácil trocar."**
  - Verdade: Abstração especulativa é complexidade desnecessária com custo imediato e benefício imaginário. Simples que resolve > flexível que ninguém entende.
- **"Copiei de um projeto que funcionava, deve servir."**
  - Verdade: Contexto diferente invalida solução copiada. Pesquisa é referência técnica, nunca cópia cega — adaptar exige entender o porquê de cada linha.
- **"Sem tempo para tratar erro, lanço exceção genérica."**
  - Verdade: `except: pass` e erro engolido são proibidos. Falha silenciosa transforma bug de 5 minutos em incidente de 5 horas. Registrar motivo é mais barato que depurar às cegas.

## Red Flags

- Arquivo único gigante misturando I/O, regra de negócio e apresentação.
- Bloco catch vazio, `except: pass` ou erro logado sem motivo/actionável.
- Stub, `TODO` ou função que retorna valor fixo em caminho de produção.
- Credencial, token ou path sensível hardcoded no fonte.
- Sucesso assumido sem verificar o resultado esperado da operação.
- Reexecução unsafe: roda duas vezes e duplica efeito (sem idempotência/checkpoint).

## Legacy Reference (v1)

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
