---
name: qa
description: "Quality Assurance completo para código de produção. 7 dimensões de auditoria: TypeScript Strict (zero `any`, props tipadas, null safety), Componentes React (SRP, hooks rules, cleanup de efeitos, derivação de estado), Performance (re-renders, memoização, lazy loading, code splitting, N+1), Acessibilidade WCAG 2.2 AA (contraste 4.5:1, labels, navegação por teclado, ARIA, focus trap, screen readers), Responsividade (mobile-first, breakpoints, touch targets 44px), Segurança (validação server-side, RLS, XSS/injection, secrets), SEO (title, meta, h1, alt, canonical, structured data). Inclui Pirâmide de Testes (unitários Vitest/Jest, integração, E2E Playwright com seletores por role/intent), checklist de code review e processo de revisão. Use ao auditar código, validar antes de merge/deploy, ou revisar PR."
---

# Quality Assurance — Manual Operacional

Manual denso de QA para código de produção. 7 dimensões de auditoria com checklists acionáveis, código de exemplo para padrões corretos vs incorretos, e Pirâmide de Testes completa.

## Quando usar

- Auditar código existente antes de merge/deploy.
- Validar alterações em code review.
- Verificar acessibilidade, performance, segurança de páginas/componentes.
- Implementar testes (unitários, integração, E2E).

**Pule** para `code-auditor` quando o foco é SAST de segurança profundo; `accessibility-reviewer` quando é auditoria WCAG completa; `webapp-testing` quando é teste visual com Playwright.

---

## Pirâmide de Testes

```
         ╱╲
        ╱ E2E ╲         ← Poucos (5-10): fluxos críticos end-to-end
       ╱────────╲         Playwright com seletores por role/intent
      ╱Integração╲       ← Médios (20-40): APIs, DB, componentes compostos
     ╱──────────────╲     Supertest, Testing Library, MSW
    ╱   Unitários    ╲   ← Muitos (100+): funções puras, hooks, utils
   ╱──────────────────╲   Vitest/Jest com coverage ≥ 80%
```

### Seletores E2E (Playwright) — Ordem de preferência

| Prioridade | Seletor | Exemplo | Resiliência |
|---|---|---|---|
| 1 | `getByRole` | `page.getByRole('button', { name: 'Salvar' })` | ✅ Alta (semântico) |
| 2 | `getByLabel` | `page.getByLabel('Email')` | ✅ Alta (acessibilidade) |
| 3 | `getByText` | `page.getByText('Bem-vindo')` | ⚠️ Média (texto muda) |
| 4 | `getByTestId` | `page.getByTestId('submit-btn')` | ⚠️ Média (acoplado) |
| 5 | CSS selector | `page.locator('.btn-primary')` | ❌ Baixa (frágil) |

### Regras de teste

1. **Zero flaky tests**: Teste que falha intermitentemente deve ser corrigido, não ignorado.
2. **Isolamento**: Cada teste roda independente. Sem dependência de ordem ou estado compartilhado.
3. **Assertions explícitas**: Todo teste tem `expect()` com condição específica. Teste sem assertion = teste inútil.
4. **Naming descritivo**: `it('should return 401 when token is expired')`, não `it('test auth')`.

---

## Dimensão 1: TypeScript Strict

| Regra | Correto | Incorreto |
|---|---|---|
| Zero `any` | `data: UserResponse` | `data: any` |
| Zero `as unknown as` | Refatorar o tipo | `result as unknown as SomeType` |
| Props tipadas | `interface ButtonProps { onClick: () => void }` | Props sem interface |
| Retorno tipado | `function getUser(id: string): Promise<User>` | Retorno implícito em funções complexas |
| Null safety | `user?.name ?? 'Anônimo'` | `user.name` sem verificar null |
| Enums/union types | `type Status = 'draft' \| 'published' \| 'archived'` | `status: string` |

### Checklist

- [ ] `strict: true` no `tsconfig.json`
- [ ] Zero `any` — todos os tipos explícitos
- [ ] Zero `as unknown as` — indica problema de design
- [ ] Props tipadas com `interface NomeProps`
- [ ] Retorno tipado em funções não-triviais
- [ ] Optional chaining (`?.`) e nullish coalescing (`??`) corretos
- [ ] Enums ou union types para valores fixos

---

## Dimensão 2: Componentes React

| Regra | Correto | Incorreto |
|---|---|---|
| Single Responsibility | Componente faz 1 coisa | God component com 15+ props |
| Derivar estado | `const display = format(value)` | `useState` + `useEffect` para computar |
| Keys únicas | `key={item.id}` | `key={index}` |
| Cleanup de efeitos | `useEffect(() => { ...; return () => cleanup() })` | Effect sem cleanup (memory leak) |
| Hooks no topo | Hooks antes de qualquer condicional | Hook dentro de `if` |

### Anti-padrões de estado

```tsx
// ❌ Estado redundante (re-render + bug potential)
const [items, setItems] = useState<Item[]>([]);
const [filteredItems, setFilteredItems] = useState<Item[]>([]);
useEffect(() => setFilteredItems(items.filter(i => i.active)), [items]);

// ✅ Derivar sempre que possível
const [items, setItems] = useState<Item[]>([]);
const filteredItems = useMemo(() => items.filter(i => i.active), [items]);
```

---

## Dimensão 3: Performance

| Verificação | Diagnóstico | Fix |
|---|---|---|
| Re-renders desnecessários | React DevTools Profiler | `React.memo` para componentes com props estáveis |
| Callbacks recriados | Novo objeto a cada render | `useCallback` para funções passadas como props |
| Cálculos pesados no render | Lag visível, DevTools flame chart | `useMemo` para computações O(n²) ou maiores |
| Imagens sem lazy loading | LCP lento, bandwidth alto | `loading="lazy"` ou `next/image` com `priority` |
| Bundle grande | Bundle analyzer > 200KB chunk | `dynamic()` para componentes pesados |
| Fetch em loop | N+1 queries, waterfall de requests | Batching, DataLoader, ou query única |
| DOM grande | > 1500 nodes, INP lento | Virtualização (react-virtual), paginação |

---

## Dimensão 4: Acessibilidade (WCAG 2.2 AA)

| Área | Regra | Verificação |
|---|---|---|
| **Contraste** | Texto: 4.5:1, texto grande: 3:1 | DevTools → Accessibility → Contrast ratio |
| **Imagens** | `alt` descritivo (decorativa: `alt=""`) | Grep por `<img` sem `alt` |
| **Formulários** | Todo input tem `<label>` associado (`htmlFor`/`id`) | Grep por `<input` sem label correspondente |
| **Botões** | Ícone-only tem `aria-label` | Verificar botões sem texto visível |
| **Links** | Texto descritivo (nunca "clique aqui") | Grep por links genéricos |
| **Teclado** | Tab order lógico, focus visible, sem trap | Navegar com Tab pela página inteira |
| **Modais** | Focus trap, `Escape` fecha, `aria-modal="true"` | Testar com teclado only |
| **Skip link** | `<a href="#main-content">Pular para conteúdo</a>` | Primeiro item focável |
| **Motion** | `prefers-reduced-motion` respeitado | Verificar com media query ativa |

### Ferramentas

```bash
# axe-core (programático)
npx @axe-core/cli https://localhost:3000

# Lighthouse accessibility audit
npx lighthouse https://localhost:3000 --only-categories=accessibility
```

---

## Dimensão 5: Responsividade

| Área | Regra | Implementação |
|---|---|---|
| **Layout** | Mobile-first (base = mobile, breakpoints = desktop) | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |
| **Touch targets** | Mínimo 44×44px com 8px spacing | `min-h-[44px] min-w-[44px]` |
| **Textos** | Mínimo 14px em mobile, escaláveis | `text-sm md:text-base lg:text-lg` |
| **Imagens** | Responsivas com `sizes` e `srcSet` | `w-full max-w-[1200px]` com `aspect-ratio` |
| **Formulários** | Inputs `w-full` em mobile | `w-full md:w-auto` |
| **Sem overflow** | Zero scroll horizontal | Testar em 375px width |
| **Viewport meta** | `<meta name="viewport" content="width=device-width, initial-scale=1">` | Verificar no `<head>` |

### Breakpoints padrão

| Breakpoint | Largura | Dispositivos |
|---|---|---|
| (base) | < 640px | Phones |
| `sm` | ≥ 640px | Phones landscape |
| `md` | ≥ 768px | Tablets |
| `lg` | ≥ 1024px | Laptops |
| `xl` | ≥ 1280px | Desktops |
| `2xl` | ≥ 1536px | Large screens |

---

## Dimensão 6: Segurança

- [ ] Validação server-side em TODAS as API routes (Zod schema)
- [ ] Secrets fora de `NEXT_PUBLIC_*` (nunca no client bundle)
- [ ] RLS ativo em todas as tabelas (Supabase)
- [ ] `dangerouslySetInnerHTML` só com DOMPurify sanitização
- [ ] Inputs com `maxLength` (prevenir overflow/DoS)
- [ ] URLs de redirect validadas (sem open redirect)
- [ ] Rate limiting em endpoints críticos (login, password reset)
- [ ] Respostas de erro genéricas (sem expor stack traces em produção)

---

## Dimensão 7: SEO

- [ ] `<title>` único e descritivo (50-60 chars)
- [ ] `<meta name="description">` presente (150-160 chars)
- [ ] Um único `<h1>` por página
- [ ] Heading hierarchy: h1 → h2 → h3 (sem pular)
- [ ] `alt` em todas as imagens
- [ ] URLs amigáveis com slugs legíveis
- [ ] `<link rel="canonical">` presente
- [ ] Open Graph tags para redes sociais
- [ ] Links internos com `<Link>` do Next.js (não `<a>`)
- [ ] Conteúdo principal acessível sem JavaScript (SSG/SSR)

---

## Processo de Code Review

### Antes de submeter

1. `npm run lint` — zero warnings
2. `npm run build` — sem erros
3. `npm run test` — todos passando (se existir suíte)
4. Testar mobile (375px width)
5. Testar todos os estados: loading, erro, vazio, sucesso
6. Navegar com Tab (acessibilidade básica)

### Template de Review (5 dimensões)

```markdown
## Code Review — [PR/Feature]

| Dimensão | ✅/❌ | Observação |
|---|---|---|
| TypeScript Strict | | Zero `any`, props tipadas |
| React Patterns | | Derivação, hooks rules, cleanup |
| Performance | | Sem re-renders, lazy loading |
| Acessibilidade | | Labels, contraste, teclado |
| Segurança | | Validação, RLS, secrets |

**Aprovado** / **Ajustes necessários**
```

---

## Composição com outras skills

- **Antes**: `tdd` (escrever teste antes), `requirement-analyzer` (critérios de aceite)
- **Durante**: `accessibility-reviewer` (WCAG profundo), `code-auditor` (SAST)
- **Depois**: `self-critique` (revisão final), `webapp-testing` (E2E visual)

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
