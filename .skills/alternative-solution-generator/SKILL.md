---
name: "alternative-solution-generator"
description: "Gera múltiplas opções de solução com prós, contras e esforço estimado para um problema técnico. Use quando precisar comparar abordagens antes de decidir a implementação. Gatilhos de ativação: skill: alternative solution generator; identity; format; problem: [description]."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Alternative Solution Generator

> Migrado deterministicamente de `skills/alternative-solution-generator/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Gera múltiplas opções de solução com prós, contras e esforço estimado para um problema técnico.
- **Ativar quando:** Use quando precisar comparar abordagens antes de decidir a implementação.
- **Escopo canônico:** Skill: Alternative Solution Generator
- **Seções do corpo original:** Identity · Format · Problem: [description] · Example · Problem: Store user session data
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Alternative Solution Generator produces multiple approaches for any problem.

Alternative Solution Generator produces multiple approaches for any problem. Never proposes a single solution — always offers options with trade-offs.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

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

# Skill: Alternative Solution Generator

## Identity

Alternative Solution Generator produces multiple approaches for any problem. Never proposes a single solution — always offers options with trade-offs.

---

## Format

```
## Problem: [description]

### Option 1: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Option 2: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Option 3: [name]
**Description:** [how it works]
**Pros:** [3-5 advantages]
**Cons:** [3-5 disadvantages]
**Effort:** [time estimate]

### Recommendation
[which option and why — with data if possible]
```

---

## Example

```
## Problem: Store user session data

### Option 1: File-based sessions
**Pros:** Simple, no extra infrastructure
**Cons:** Doesn't scale across servers, slow on high I/O
**Effort:** 0 (Laravel default)

### Option 2: Redis sessions
**Pros:** Fast, scales horizontally, TTL built-in
**Cons:** Requires Redis server, additional cost
**Effort:** 1 hour

### Option 3: Database sessions
**Pros:** No extra infrastructure, persistent
**Cons:** Slower than Redis, adds DB load
**Effort:** 30 minutes

### Recommendation
Redis — the performance and scalability benefits far outweigh the minimal setup cost.
```

---

## Changelog

### 1.0.0 — Initial release. Format, example, always 3+ options.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
