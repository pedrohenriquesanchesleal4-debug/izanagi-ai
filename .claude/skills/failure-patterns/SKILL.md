---
name: failure-patterns
description: "Registra padrões de falhas recorrentes (sintoma, causa raiz, solução, confiança) para aplicar correção guiada. Use ao encontrar um erro novo, resolver um bug difícil ou detectar recorrência."
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

> Gerado pelo Izanagi AI: cópia fiel de `skills/failure-patterns/SKILL.md` (fonte da verdade).
