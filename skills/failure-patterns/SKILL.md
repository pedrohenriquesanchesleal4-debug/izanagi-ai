---
name: failure-patterns
description: "Memória de falhas reutilizáveis: converter erros recorrentes em padrões estruturados (pattern, symptoms, rootCause, solution, confidence, occurrences) para o runtime procurar antes de executar e aplicar correção guiada. Use ao encontrar um erro novo, resolver um bug difícil ou detectar recorrência."
version: 1.0.0
triggers:
  - padrão de falha
  - falha recorrente
  - erro já visto
  - memory de falhas
  - registrar erro
  - failure pattern
capabilities:
  - registro de padrões de falha
  - classificação de tipo de falha
  - correção guiada por padrão conhecido
  - detecção de recorrência
dependencies:
  - memoria-projeto
token_budget: 500
compatibility: ">=3.0.0"
risk: low
---

# Failure Patterns — Transforme Falhas em Aprendizado Reutilizável

> **Antes de executar uma tarefa, procure padrões de falha relevantes.**

## Classificação de falha

| Tipo | Exemplo | Recuperável? |
|---|---|---|
| `recoverable` | timeout, 429, 5xx | Sim — retry com backoff |
| `validation` | artefato fora do contrato | Sim — repair + re-evaluate |
| `tool` | comando falhou, MCP indisponível | Sim — retry seletivo |
| `planning` | grafo cíclico, dependência impossível | Replan |
| `agent` | agente retornou lixo | Handoff / troca de agente |
| `dependency` | módulo ausente | Fix + retry |
| `non-recoverable` | falha estrutural | Abort com relatório |

## Formato do padrão

```json
{
  "pattern": "NEXT-HYDRATION-017",
  "symptoms": ["Cannot read properties of null", "SSR", "map undefined"],
  "rootCause": "acesso a window/document durante render do servidor",
  "solution": "guard de typeof window !== 'undefined' ou lazy load do componente",
  "confidence": 0.94,
  "occurrences": 3,
  "kind": "recoverable"
}
```

## Regras

1. **Registre na primeira resolução** de um erro não-trivial — nunca espere a terceira ocorrência.
2. **Symptoms devem ser pesquisáveis**: use o texto literal do erro, não paráfrase.
3. **Solution deve ser acionável**: passos concretos, não conceitos.
4. **Confidence** sobe com ocorrências (3+ = alta confiança).
5. **Antes de qualquer tarefa**: procure padrões com symptoms similares e aplique a solução conhecida imediatamente.

## Fluxo

```text
Erro → Classificação → Padrão existente? → SIM: aplicar solução guiada
                              → NÃO: diagnosticar → registrar padrão → fix → teste de regressão
```
