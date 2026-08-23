---
name: "tradeoff-analyzer"
description: "Compara abordagens técnicas por critérios ponderados (complexidade, manutenibilidade, performance, custo, risco) e gera recomendação estruturada. Use ao decidir entre arquiteturas, libs ou padrões concorrentes. Gatilhos de ativação: skill: trade-off analyzer; identity; comparison criteria; example comparison."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
references:
  - "references.md"
---

# Skill: Trade-off Analyzer

> Migrado deterministicamente de `skills/tradeoff-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Compara abordagens técnicas por critérios ponderados (complexidade, manutenibilidade, performance, custo, risco) e gera recomendação estruturada.
- **Ativar quando:** Use ao decidir entre arquiteturas, libs ou padrões concorrentes.
- **Escopo canônico:** Skill: Trade-off Analyzer
- **Seções do corpo original:** Identity · Comparison Criteria · Example Comparison · Changelog · References
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Trade-off Analyzer evaluates multiple approaches against defined criteria.

Trade-off Analyzer evaluates multiple approaches against defined criteria. Produces a structured comparison to help make informed decisions.

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

# Skill: Trade-off Analyzer

## Identity

Trade-off Analyzer evaluates multiple approaches against defined criteria. Produces a structured comparison to help make informed decisions.

---

## Comparison Criteria

```yaml
criteria:
  complexity:
    description: "How complex is the implementation?"
    weight: 3
    
  maintainability:
    description: "How easy to maintain over time?"
    weight: 4
    
  performance:
    description: "How fast is it?"
    weight: 3
    
  scalability:
    description: "How well does it scale?"
    weight: 2
    
  cost:
    description: "Development + operational cost"
    weight: 2
    
  risk:
    description: "Probability of issues"
    weight: 4
```

---

## Example Comparison

```yaml
decision: "Should we use REST or GraphQL for the API?"

options:
  - name: "REST"
    scores:
      complexity: 5 (simple, well-known pattern)
      maintainability: 4 (clear endpoints)
      performance: 4 (caching, pagination)
      scalability: 3 (multiple requests)
      cost: 5 (no new tools)
      risk: 5 (proven, well-understood)
    weighted_total: 4.4
  
  - name: "GraphQL"
    scores:
      complexity: 2 (new patterns, resolvers, N+1 risk)
      maintainability: 3 (flexible but complex)
      performance: 3 (batching, dataloader needed)
      scalability: 4 (single endpoint, precise queries)
      cost: 3 (new tools: Apollo/graphql-php)
      risk: 3 (N+1, no HTTP caching)
    weighted_total: 3.1

recommendation: "Use REST for the public API. Consider GraphQL for internal admin dashboard."
```

---

## Changelog

### 1.0.0 — Initial release. Criteria, scoring, example.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
