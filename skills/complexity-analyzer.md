# Skill: Complexity Analyzer

> Version 1.0.0 | Priority: High
> Dependencies: Clean Code Validator
> Compatibility: ">=1.0.0"

---

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
