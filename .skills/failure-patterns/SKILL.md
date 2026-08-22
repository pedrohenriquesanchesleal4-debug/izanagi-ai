---
name: "failure-patterns"
description: "Registra padrões de falhas recorrentes (sintoma, causa raiz, solução, confiança) para aplicar correção guiada. Use ao encontrar um erro novo, resolver um bug difícil ou detectar recorrência. Gatilhos de ativação: failure patterns — transforme falhas em aprendizado reutilizável; classificação de falha; formato do padrão; regras."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Failure Patterns — Transforme Falhas em Aprendizado Reutilizável

> Migrado deterministicamente de `skills/failure-patterns/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Registra padrões de falhas recorrentes (sintoma, causa raiz, solução, confiança) para aplicar correção guiada.
- **Ativar quando:** Use ao encontrar um erro novo, resolver um bug difícil ou detectar recorrência.
- **Escopo canônico:** Failure Patterns — Transforme Falhas em Aprendizado Reutilizável
- **Seções do corpo original:** Classificação de falha · Formato do padrão · Regras · Fluxo
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — Registre na primeira resolução de um erro não-trivial — nunca espere a terceira ocorrên...

**Registre na primeira resolução** de um erro não-trivial — nunca espere a terceira ocorrência.

### Passo 2 — Symptoms devem ser pesquisáveis:

**Symptoms devem ser pesquisáveis**: use o texto literal do erro, não paráfrase.

### Passo 3 — Solution deve ser acionável:

**Solution deve ser acionável**: passos concretos, não conceitos.

### Passo 4 — Confidence sobe com ocorrências (3+ = alta confiança).

**Confidence** sobe com ocorrências (3+ = alta confiança).

### Passo 5 — Antes de qualquer tarefa:

**Antes de qualquer tarefa**: procure padrões com symptoms similares e aplique a solução conhecida imediatamente.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:engineering -->

- Executar a skill conforme o escopo de Triggering Criteria no caso real (não hipotético).
- Percorrer cada passo do Step-by-Step Workflow e confirmar evidência verificável de conclusão (não apenas ausência de erro).
- Confirmar que nenhum Red Flag listado está presente no artefato produzido.
- Registrar resultado (sucesso/falha + motivo) antes de considerar a skill cumprida.

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
