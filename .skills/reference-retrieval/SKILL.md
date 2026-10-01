---
name: reference-retrieval
description: "Recupera exemplos, contratos e documentação verificáveis antes de implementar integrações. Prioriza MCP, repositório local e fontes oficiais, com fallback honesto quando browser ou MCP não estiver disponível."
version: 1.0.0
category: research
tools:
  mcp:
    - mcp:fs_read
    - mcp:execute_command
references:
  - "references.md"
---

# Reference Retrieval · Agent-first grounding

## Triggering Criteria

- **Domínio:** Research e integração
- **Ativar quando:** uma tarefa envolver API, SDK, MCP, browser, biblioteca de UI ou
  exemplo técnico antes da implementação
- **Objetivo:** reduzir APIs inventadas com evidência verificável e fallback honesto

## Step-by-Step Workflow

1. Detecte MCP, browser portal, Playwright e fontes locais. Use `available`,
   `unavailable` ou `unknown`, nunca uma afirmação implícita.
2. Consulte exemplos do repositório e resources/tools MCP antes de buscar na web.
3. Priorize documentação oficial e registre caminho/URL, versão, contrato e limitações.
4. Compare imports, parâmetros, retornos e erros com a fonte primária.
5. Entregue um artefato curto de evidência para o agente implementador.
6. Se não houver fonte verificável, marque `UNKNOWN` e não invente o contrato.

## Verification Steps

- [ ] capability matrix registrada
- [ ] fonte primária ou caminho local citado
- [ ] versão ou data registrada quando disponível
- [ ] entrada, saída e erros observados
- [ ] fallback explícito
- [ ] handoff do artefato para implementação

## Common Rationalizations

- **"A API é conhecida, não preciso consultar."** Contexto, versão e provider mudam
  contratos. Conhecimento sem evidência deve ser tratado como hipótese.
- **"O browser existe porque Playwright está na skill."** Uma skill descreve um caminho,
  não prova que o executável, portal ou MCP está instalado.
- **"Completo o exemplo depois."** Uma lacuna de contrato antes de codar vira API
  inventada e custo de retrabalho depois.
