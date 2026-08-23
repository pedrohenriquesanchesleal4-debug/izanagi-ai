---
name: "design-pattern-advisor"
description: "Recomenda o padrão de projeto certo para um problema (Factory, Strategy, Decorator, Repository...) com trade-offs e alerta contra over-engineering. Use ao decidir como estruturar uma solução de código. Gatilhos de ativação: skill: design pattern advisor; identity; pattern decision tree; pattern suggestions."
version: 2.0.0
category: design
tools:
  mcp:
    - mcp:fs_read
    - mcp:fs_write
references:
  - "references.md"
---

# Skill: Design Pattern Advisor

> Migrado deterministicamente de `skills/design-pattern-advisor/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Design & UI (`design`)
- **Resumo:** Recomenda o padrão de projeto certo para um problema (Factory, Strategy, Decorator, Repository...) com trade-offs e alerta contra over-engineering.
- **Ativar quando:** Use ao decidir como estruturar uma solução de código.
- **Escopo canônico:** Skill: Design Pattern Advisor
- **Seções do corpo original:** Identity · Pattern Decision Tree · Pattern Suggestions · Anti-Patterns to Avoid · Changelog
- **Ferramentas MCP esperadas:** mcp:fs_read, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Design Pattern Advisor recommends the right design pattern for a given problem.

Design Pattern Advisor recommends the right design pattern for a given problem. Explains trade-offs, provides implementation sketches, and warns against over-engineering.

### Passo 2 — Veja references.md nesta pasta — curadoria dos melhores sites/referências (2026) para e...

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:design -->

- Comparar o artefato com a direção de design acordada (paleta, tipografia, layout, motion) item a item.
- Executar auditoria anti-AI-slop: zero tells da lista de Red Flags presentes.
- Verificar estados interativos (hover/focus/error/loading) e contraste WCAG AA nos componentes tocados.
- Registrar screenshots/evidência do estado final para revisão.

## Common Rationalizations

- **"Design system a gente monta depois do launch."**
  - Verdade: Sem tokens decididos antes, cada componente nasce com escala própria e o 'depois' vira reescrita total. Direção de design primeiro é HARD-GATE do framework, não preferência.
- **"Inter serve, é neutra."**
  - Verdade: Inter default é o tell nº 1 de 'cara de IA'. Tipografia é decisão de identidade; neutra aqui significa sem intenção — e sem intenção é proibido.
- **"Responsivo eu ajusto no final, primeiro o desktop."**
  - Verdade: Layout pensado só em desktop quebra estruturalmente no mobile: grid, hierarquia e touch targets não se 'ajustam', se redesenham. Mobile-first é mais barato desde a primeira linha.
- **"Acessibilidade a gente adiciona quando tiver demanda."**
  - Verdade: Contraste, foco visível e ARIA são requisitos WCAG, não feature request. Retrofitar acessibilidade custa ordens de magnitude mais que nascer com ela.
- **"O cliente pediu hero com 3 cards, é isso que ele conhece."**
  - Verdade: O cliente pediu resultado, não template estatístico. Cabe ao craft traduzir o pedido em composição com identidade — hero+3cards+gradiente roxo é anti-padrão explícito do framework.
- **"Animação entra no fim, se sobrar tempo."**
  - Verdade: Motion signature decide-se no design, não decorase no deploy. Animação adicionada tarde é ornamento; planejada cedo é comunicação de hierarquia e estado.

## Red Flags

- Hero centralizado + fileira de 3 cards idênticos (composição estatística de IA).
- Gradiente roxo-azul como identidade visual principal.
- border-radius uniforme em todos os elementos, sem hierarquia formal.
- Contraste abaixo de WCAG AA em texto primário.
- Sem estados hover/focus/loading/error definidos nos componentes interativos.
- Tipografia default sem escolha declarada (peso, escala, par de fontes).
- Motion decorativo aleatório em vez de 1–2 momentos-chave com assinatura.

## Legacy Reference (v1)

# Skill: Design Pattern Advisor

## Identity

Design Pattern Advisor recommends the right design pattern for a given problem. Explains trade-offs, provides implementation sketches, and warns against over-engineering.

---

## Pattern Decision Tree

```
if you need to create objects:
  → Factory Method (simple)
  → Abstract Factory (families of objects)
  → Builder (complex objects with many configs)

if you need to structure objects:
  → Adapter (incompatible interfaces)
  → Decorator (add behavior without subclassing)
  → Facade (simplify complex subsystem)
  → Composite (tree structure)

if you need to manage behavior:
  → Strategy (swappable algorithms)
  → Observer (event notification)
  → Command (parameterize operations)
  → Chain of Responsibility (request pipeline)
  → State (state-dependent behavior)

if you're dealing with data:
  → Repository (data access abstraction)
  → Unit of Work (transactional consistency)
  → Active Record (simple CRUD, Laravel Eloquent)
  → Data Mapper (complex domain, Doctrine)
```

---

## Pattern Suggestions

```
Problem: "Need different shipping cost calculations"
Pattern: Strategy
// Strategy interface + implementation per carrier (FedEx, UPS, Correios)

Problem: "Need to log, cache, and time every API call"
Pattern: Decorator (with middleware)
// Middleware pipeline: LogMiddleware → CacheMiddleware → TimingMiddleware

Problem: "Complex object construction with many optional parts"
Pattern: Builder
// new QueryBuilder()->select(...)->from(...)->where(...)->get()
```

---

## Anti-Patterns to Avoid

```
- Singleton overuse (hidden global state)
- God class (one class does everything)
- Spaghetti code (no structure)
- Golden hammer (using your favorite pattern for everything)
- Copy-paste programming (DRY violation)
- Premature abstraction (YAGNI violation)
```

---

## Changelog

### 1.0.0 — Initial release. Decision tree, suggestions, anti-patterns.

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
