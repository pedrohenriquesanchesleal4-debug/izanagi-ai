---
name: react-next-practices
version: 2.0.0
description: Padrões avançados e arquitetura moderna para React 19 e Next.js App Router (Vercel Agent Skills): Server Components, streaming com Suspense, Server Actions, rotas paralelas e otimização de performance.
category: frontend
risk: low
token_budget: 1400
stacks: [react, nextjs, typescript]
tools:
  mcp: []
capabilities:
  - server-components
  - nextjs-app-router
  - server-actions
  - streaming-suspense
  - core-web-vitals
triggers:
  - criar ou refatorar páginas e componentes no Next.js App Router
  - implementar Server Actions, data fetching e streaming com Suspense
  - otimizar performance e bundle size em aplicações React/Next.js
  - auditar arquitetura de Server Components vs Client Components ('use client')
---

# React & Next.js Best Practices — App Router & React 19

Esta skill sintetiza as diretrizes oficiais de alto desempenho para React e Next.js, estabelecendo padrões para divisão estrita entre servidor e cliente, streaming de dados sem bloqueio e gerenciamento de estado minimalista.

---

## 1. Princípios de Arquitetura Server-First

### 1.1 Server Components por Padrão (RSC)
- **Tudo é Server Component até prova em contrário**: Deixe os componentes como Server Components (`async function Component()`).
- **Quando usar `'use client'`**:
  - Manipulação de eventos do navegador (`onClick`, `onChange`, `onSubmit`).
  - Hooks de estado e ciclo de vida (`useState`, `useReducer`, `useEffect`, `useLayoutEffect`).
  - APIs exclusivas de browser (`window`, `localStorage`, `navigator`, `IntersectionObserver`).
  - Bibliotecas de animação baseadas em canvas/DOM direto (ex.: Framer Motion, GSAP).
- **Move Client Components to the Leaves**: Isole a diretiva `'use client'` nos nós folha da árvore de componentes. Nunca marque uma página inteira (`page.tsx`) ou layout (`layout.tsx`) com `'use client'` apenas porque um botão ou input precisa de interatividade.

### 1.2 Data Fetching e Streaming
- **Fetch Direto no Componente**: Em Server Components, faça chamadas assíncronas diretamente no corpo do componente com `await db.query()` ou `await fetch()`. Elimine o antipadrão legado de `useEffect` + `useState` para carregar dados iniciais.
- **Suspense Boundaries Granulares**:
  - Envolva componentes que realizam IO lento em `<Suspense fallback={<Skeleton />}>`.
  - Permita que a casca da página renderize imediatamente e faça streaming dos dados progressivamente (TTFB ultrarrápido).
- **Parallel Fetching**: Utilize `Promise.all([fetchUsers(), fetchStats()])` para requisições independentes em vez de encadear múltiplos `await` sequenciais (*waterfalls*).

---

## 2. Server Actions & Mutação de Dados

### 2.1 Padrões de Server Actions
- Declare ações em arquivos dedicados com `'use server'` no topo (ex.: `app/actions/user.ts`) para reutilização limpa e segurança.
- **Validação com Zod Obrigatória**: Toda Server Action deve validar o payload recebido com schema estrito antes de qualquer operação no banco.
- **Retorno Estruturado**: Devolva sempre `{ success: true, data }` ou `{ success: false, error: string, fields?: Record<string, string> }`. Nunca dispare erros não tratados que quebrem a fronteira de serialização.
- **Revalidação Imediata**: Utilize `revalidatePath('/dashboard')` ou `revalidateTag('user-profile')` após mutações bem-sucedidas para invalidar o cache de forma atômica.

### 2.2 Tratamento Otimista de UI
- Use `useOptimistic` do React 19 para refletir atualizações instantaneamente na interface enquanto a Server Action processa em background.
- Em caso de falha na mutação, reverta o estado automaticamente com toast de erro amigável.

---

## 3. Otimizações de Performance & Assets

1. **`next/image` Obrigatório**:
   - Sempre forneça `width` e `height` explícitos ou utilize `fill` com contêiner `relative` para prevenir Cumulative Layout Shift (CLS).
   - Use `priority` apenas para a imagem principal acima da dobra (Hero LCP).
2. **`next/font` Local/Otimizado**:
   - Carregue fontes via `next/font/google` ou `next/font/local` com `display: 'swap'` e subconjuntos (`subsets: ['latin']`) para zero layout shift tipográfico.
3. **Dynamic Imports com `next/dynamic`**:
   - Carregue sob demanda componentes pesados que só aparecem em resposta a ações do usuário (modais complexos, gráficos recharts, editores rich text) com `{ ssr: false }`.
