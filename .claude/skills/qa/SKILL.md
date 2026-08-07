---
name: qa
description: "Skill de Quality Assurance para o IzanagiAI. Contém checklist completo de qualidade de código, validações de acessibilidade, performance, segurança e responsividade. Use esta skill para auditar código existente ou validar alterações antes de merge/deploy."
---

# Qa

## ✅ Checklist de Qualidade de Código - [ ] **Zero `any`** — todos os tipos explícitos - [ ] **Zero `as unknown as`** — indica problema de design, refatorar - [ ] **Props tipadas** — toda interface de componente com `interface NomeProps` - [ ] **Retorno tipado** — funções… - [ ] **Enums ou union types** — para valores fixos (status, tipos) - [ ] **Single Responsibility** — componente faz uma coisa só - [ ] **Props mínimas** — sem "god components" com 15+ props - [ ] **Sem lógica inline pesada** — extrair para hooks ou funções - [ ] **Keys únicas** — em listas, usar IDs do… - [ ] **Sem estado desnecessário** — derivar valores quando possível - [ ] Hooks no topo do componente (antes de qualquer condicional) - [ ] Sem hooks dentro de loops ou condicionais - [ ] Custom hooks com prefixo `use` - [ ] Dependencies array do `useEffect` completo e correto - [ ] **Sem re-renders desnecessários** — `React.memo` quando componente recebe props estáveis - [ ] **Callbacks memoizados** — `useCallback` para funções passadas como props - [ ] **Valores memoizados** — `useMemo` para cálculos pesados… - [ ] **Sem fetches em loop** — batching de queries quando possível --- ## ♿ Checklist de Acessibilidade (a11y) - [ ] Toda `<img>` tem `alt` descritivo - [ ] Imagens decorativas têm `alt=""` - [ ] Vídeos embeds têm `title` no iframe - [ ] Todo input tem `<label>` associado (via `htmlFor`/`id`) -

… (resumo gerado automaticamente)

> Gerado pelo Izanagi AI — resumo da skill original `skills/qa/SKILL.md`.
