---
name: "react-next-practices"
description: "Padrões avançados e arquitetura moderna para React 19 e Next.js App Router (Vercel Agent Skills): Server Components, streaming com Suspense, Server Actions, rotas paralelas e otimização de performance. Gatilhos de ativação: react & next.js best practices — app router & react 19; 1. princípios de arquitetura server-first; 2. server actions & mutação de dados; 3. otimizações de performance & assets."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# React & Next.js Best Practices — App Router & React 19

> Migrado deterministicamente de `skills/react-next-practices/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Padrões avançados e arquitetura moderna para React 19 e Next.js App Router (Vercel Agent Skills): Server Components, streaming com Suspense, Server Actions, rotas paralelas e otimização de performance.

- **Escopo canônico:** React & Next.js Best Practices — App Router & React 19
- **Seções do corpo original:** 1. Princípios de Arquitetura Server-First · 2. Server Actions & Mutação de Dados · 3. Otimizações de Performance & Assets
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: top-level-ordered -->

### Passo 1 — next/image Obrigatório:

**`next/image` Obrigatório**:

- Sempre forneça `width` e `height` explícitos ou utilize `fill` com contêiner `relative` para prevenir Cumulative Layout Shift (CLS).
   - Use `priority` apenas para a imagem principal acima da dobra (Hero LCP).

### Passo 2 — next/font Local/Otimizado:

**`next/font` Local/Otimizado**:

- Carregue fontes via `next/font/google` ou `next/font/local` com `display: 'swap'` e subconjuntos (`subsets: ['latin']`) para zero layout shift tipográfico.

### Passo 3 — Dynamic Imports com next/dynamic:

**Dynamic Imports com `next/dynamic`**:

- Carregue sob demanda componentes pesados que só aparecem em resposta a ações do usuário (modais complexos, gráficos recharts, editores rich text) com `{ ssr: false }`.

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
