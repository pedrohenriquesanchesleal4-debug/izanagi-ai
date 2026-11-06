---
name: react-next-practices
description: "Padrões de arquitetura moderna para React 19 e Next.js App Router: Server Components por padrão, streaming com Suspense, Server Actions tipadas com Zod, useOptimistic e otimizações de Core Web Vitals."
triggers:
  - "criar ou refatorar páginas, layouts ou componentes no Next.js App Router"
  - "implementar data fetching, caching, streaming ou revalidação de dados"
  - "estruturar Server Actions e mutações com Zod"
  - "auditar separação entre Server Components e Client Components ('use client')"
stack: [react-19, nextjs-15, typescript, zod]
---

# React 19 & Next.js App Router — Padrões de Alta Performance

Esta skill sintetiza as diretrizes oficiais de desenvolvimento com React 19 e Next.js App Router (15+), garantindo código server-first, streaming progressivo e bundle JS mínimo no navegador.

---

## 1. Princípios de Arquitetura Server-First

### 1.1 Server Components por Padrão (RSC)
- **Tudo é Server Component até prova em contrário**: Componentes são assíncronos (`export default async function Page()`).
- **Isole `'use client'` estritamente nas folhas da árvore**:
  - NUNCA declare `'use client'` em `page.tsx` ou `layout.tsx` só para ter um botão ou modal interativo.
  - Crie componentes folha dedicados (ex.: `<FavoriteButton id={item.id} />`, `<SearchInput />`) com `'use client'` e importe-os na página do servidor.
- **Quando usar `'use client'`**:
  - Event listeners do DOM (`onClick`, `onChange`, `onSubmit`).
  - Hooks de estado e efeitos (`useState`, `useReducer`, `useEffect`, `useRef`).
  - APIs de browser (`localStorage`, `window`, `navigator`).
  - Bibliotecas de animação baseadas em canvas/DOM direto (`framer-motion`, `gsap`).

### 1.2 Data Fetching e Streaming
- **Fetch Direto no Componente**: Em Server Components, consulte o banco ou APIs diretamente no corpo da função com `await db.query()` ou `await fetch()`. Elimine o antipadrão legado de `useEffect` para carregar dados iniciais.
- **Next.js 15+ Params são Promise**:
  ```tsx
  // ✅ CORRETO (Next.js 15+): params e searchParams chegam como Promise
  export default async function Page({
    params,
    searchParams,
  }: {
    params: Promise<{ slug: string }>;
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  }) {
    const { slug } = await params;
    const { query } = await searchParams;
    return <BlogPost slug={slug} query={query} />;
  }
  ```
- **Parallel Data Fetching**: Evite waterfalls sequenciais desnecessários:
  ```tsx
  // ✅ Executa requisições independentes em paralelo
  const [user, posts] = await Promise.all([
    getUser(id),
    getUserPosts(id),
  ]);
  ```
- **Suspense Boundaries Granulares**:
  ```tsx
  export default function Dashboard() {
    return (
      <main className="p-8">
        <h1 className="text-3xl font-bold">Painel</h1>
        {/* A casca renderiza de imediato, o bloco pesado faz streaming */}
        <Suspense fallback={<MetricsSkeleton />}>
          <AsyncMetricsFeed />
        </Suspense>
      </main>
    );
  }
  ```

---

## 2. Server Actions & Mutações de Dados

### 2.1 Padrão Estruturado com Zod
Declare Server Actions em arquivos dedicados com `'use server'` no topo (ex.: `app/actions/user.ts`):

```tsx
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

const CreateProjectSchema = z.object({
  name: z.string().min(3, "Nome do projeto deve ter no mínimo 3 caracteres"),
  description: z.string().optional(),
});

export type ActionResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export async function createProjectAction(formData: FormData): Promise<ActionResponse<{ id: string }>> {
  const rawData = Object.fromEntries(formData.entries());
  const validated = CreateProjectSchema.safeParse(rawData);

  if (!validated.success) {
    return {
      success: false,
      error: "Dados inválidos",
      fieldErrors: validated.error.flatten().fieldErrors,
    };
  }

  try {
    const project = await db.project.create({ data: validated.data });
    revalidatePath('/dashboard');
    return { success: true, data: { id: project.id } };
  } catch (err) {
    return { success: false, error: "Falha interna ao criar projeto" };
  }
}
```

### 2.2 Optimistic UI (React 19)
Em Client Components que disparam ações de feedback imediato (likes, listas de tarefas, arquivar):
```tsx
'use client';

import { useOptimistic, useTransition } from 'react';
import { toggleFavoriteAction } from '@/app/actions/favorites';

export function FavoriteButton({ id, isFavorited }: { id: string; isFavorited: boolean }) {
  const [optimisticFav, setOptimisticFav] = useOptimistic(
    isFavorited,
    (current, update: boolean) => update
  );
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    startTransition(async () => {
      setOptimisticFav(!optimisticFav);
      await toggleFavoriteAction(id);
    });
  };

  return (
    <button onClick={handleToggle} disabled={isPending} className="flex items-center gap-1">
      <HeartIcon filled={optimisticFav} />
    </button>
  );
}
```

---

## 3. Caching & Revalidação Atômica

- **Next.js Caching**: Chamadas `fetch()` dentro de Server Components têm comportamento de cache controlado.
  - Para dados sempre atualizados (dashboards autenticados): `fetch(url, { cache: 'no-store' })`.
  - Para revalidação por tempo (ISR): `fetch(url, { next: { revalidate: 60 } })`.
  - Para revalidação on-demand por tag: `revalidateTag('products')` após mutação.

---

## 4. Otimização de Assets & Bundle

1. **`next/image` Obrigatório**:
   - Sempre forneça `width` e `height` explícitos ou utilize `fill` em contêiner com `position: relative`.
   - Adicione `priority` EXCLUSIVAMENTE na imagem principal acima da dobra (Hero LCP).
2. **`next/font` Local/Google**:
   - Carregue fontes via `next/font` com `display: 'swap'` e subconjuntos específicos para eliminar Layout Shift (CLS zero).
3. **Dynamic Imports (`next/dynamic`)**:
   - Carregue sob demanda componentes pesados que não aparecem no first-load (modais complexos, charts, editores rich text):
   ```tsx
   import dynamic from 'next/dynamic';
   const HeavyChart = dynamic(() => import('@/components/HeavyChart'), {
     ssr: false,
     loading: () => <div className="h-64 animate-pulse bg-zinc-900 rounded-lg" />,
   });
   ```

---

## 5. Checklist de Verificação

- [ ] Todas as páginas em `app/` são Server Components sem `'use client'` desnecessário.
- [ ] No Next.js 15+, `params` e `searchParams` utilizam `await params`.
- [ ] Nenhum `useEffect` é usado para carregar dados iniciais que poderiam ser buscados no servidor.
- [ ] Operações de banco/API lentas estão encapsuladas em `<Suspense>` com skeleton screen.
- [ ] Server Actions validam payloads com Zod e retornam respostas estruturadas `{ success: boolean }`.
- [ ] Mutações invalidam cache com `revalidatePath` ou `revalidateTag`.
- [ ] Imagens utilizam `next/image` sem causar CLS e fontes usam `next/font`.
