---
name: "complexity-analyzer"
description: "Mede complexidade ciclomática (McCabe) e cognitiva do código, sinaliza funções acima do limite e recomenda extração/refatoração. Use ao revisar funções grandes ou muito aninhadas. Gatilhos de ativação: skill: complexity analyzer; identity; metrics; common complexity culprits."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill: Complexity Analyzer

> Migrado deterministicamente de `skills/complexity-analyzer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Mede complexidade ciclomática (McCabe) e cognitiva do código, sinaliza funções acima do limite e recomenda extração/refatoração.
- **Ativar quando:** Use ao revisar funções grandes ou muito aninhadas.
- **Escopo canônico:** Skill: Complexity Analyzer
- **Seções do corpo original:** Identity · Metrics · Common Complexity Culprits · Report · Changelog
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Complexity Analyzer measures cyclomatic complexity (McCabe), cognitive complexity, and...

Complexity Analyzer measures cyclomatic complexity (McCabe), cognitive complexity, and code maintainability. Flags functions that exceed thresholds and recommends refactoring.

### Passo 2 — Measures how hard code is to understand (nested conditionals, breaks in linear flow, re...

Measures how hard code is to understand (nested conditionals, breaks in linear flow, recursion).

### Passo 3 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

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

# Skill: Complexity Analyzer

## Identity

Complexity Analyzer measures cyclomatic complexity (McCabe), cognitive complexity, and code maintainability. Flags functions that exceed thresholds and recommends refactoring.

---

## Metrics

### Cyclomatic Complexity (McCabe)

```
M = E − N + 2P

E = number of edges (control flow)
N = number of nodes (code blocks)
P = number of connected components (1 for single function)
```

| Score | Rating | Action |
|-------|--------|--------|
| 1-5 | Low | ✅ OK |
| 6-10 | Moderate | ⚠️ Consider extracting |
| 11-20 | High | ❌ Extract into smaller functions |
| 21+ | Very High | 🚫 Must refactor |

### Cognitive Complexity

Measures how hard code is to understand (nested conditionals, breaks in linear flow, recursion).

| Score | Rating |
|-------|--------|
| 1-5 | Low |
| 6-10 | Moderate |
| 11-20 | High |
| 21+ | Very High |

---

## Common Complexity Culprits

```php
// Cyclomatic: 8 (High)
function calculateDiscount(Order $order): float
{
    if ($order->isPremium()) {           // +1
        if ($order->total > 100) {       // +2 (nested)
            if ($order->isFirstOrder()) {// +3 (nested)
                return $order->total * 0.2;
            }
            return $order->total * 0.15;
        }
        return $order->total * 0.1;
    }
    if ($order->total > 200) { return ... }  // +1
    return 0;
}

// Fixed: Cyclomatic 2
function calculateDiscount(Order $order): float
{
    $strategy = $this->strategyResolver->resolve($order);
    return $strategy->calculate($order);
}
```

---

## Report

```yaml
complexity_report:
  file: "app/Services/OrderService.php"
  
  worst_function:
    name: "calculateTotals"
    cyclomatic: 14 (high)
    cognitive: 11 (high)
    lines: 47
    recommendation: "Extract: applyDiscount(), calculateTax(), calculateShipping()"
  
  functions_over_threshold:
    - "calculateTotals (14)"
    - "applyDiscounts (11)"
  
  total_functions: 8
  average_cyclomatic: 4.2
  maintainability_index: 72 / 100 (moderate)
```

---

## Changelog

### 1.0.0 — Initial release. Cyclomatic, cognitive, thresholds, report.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
