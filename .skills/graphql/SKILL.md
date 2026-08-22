---
name: "graphql"
description: "Padrões de schema, resolvers, Apollo Client/Server, DataLoader, caching e segurança em GraphQL. Use ao implementar ou revisar APIs GraphQL. Gatilhos de ativação: skill graphql — izanagi; schema design; apollo client (frontend); apollo server (backend)."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill GraphQL — Izanagi

> Migrado deterministicamente de `skills/graphql/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Padrões de schema, resolvers, Apollo Client/Server, DataLoader, caching e segurança em GraphQL.
- **Ativar quando:** Use ao implementar ou revisar APIs GraphQL.
- **Escopo canônico:** Skill GraphQL — Izanagi
- **Seções do corpo original:** Schema Design · Apollo Client (Frontend) · Apollo Server (Backend) · Performance · Segurança
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Princípios

- **Schema-first**: definir schema.graphql antes de implementar resolvers
- **Node interface**: todo tipo tem `id: ID!` e implementa `Node`
- **Connection pattern**: listas usam `Connection` type (Relay spec) para paginação
- **Input types**: mutations recebem `Input!` types, nunca args soltos

### Passo 2 — Aplicar: Naming Conventions

| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Types | PascalCase | `Associated`, `NewsPost` |
| Fields | camelCase | `fullName`, `createdAt` |
| Inputs | PascalCase + `Input` | `CreatePostInput` |
| Payloads | PascalCase + `Payload` | `CreatePostPayload` |
| Enums | PascalCase + `Enum` | `PostStatusEnum` |
| Arguments | camelCase | `first, after, filter` |

---

### Passo 3 — Aplicar: Setup

```tsx
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";

const client = new ApolloClient({
  link: createHttpLink({ uri: "/api/graphql" }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: { fields: { posts: { merge: false } } },
    },
  }),
});
```

### Passo 4 — Aplicar: Fragment Colocation

```tsx
const POST_FRAGMENT = gql`
  fragment PostFields on Post {
    id title excerpt publishedAt
  }
`;

// Componente consome apenas o fragment que precisa
function PostCard({ post }: { post: PostFieldsFragment }) { ... }
```

---

### Passo 5 — Aplicar: Codegen First (GraphQL Codegen)

```yaml
generates:
  src/types/graphql.ts:
    plugins:
      - typescript
      - typescript-resolvers
```

### Passo 6 — Aplicar: Resolver Pattern

```tsx
const resolvers: Resolvers = {
  Query: {
    posts: async (_, args, { dataSources }) =>
      dataSources.posts.findAll(args),
  },
  Post: {
    author: async (parent, _, { dataSources }) =>
      dataSources.users.findById(parent.authorId),
  },
};
```

---

### Passo 7 — Aplicar: Performance

- **DataLoader**: sempre usar para N+1 problem
- **Persisted Queries**: reduzir overhead de rede
- **@defer / @stream**: usar para loading progressivo (quando disponível)
- **Query complexity**: limitar profundidade máxima (3-5 níveis)
- **Batch queries**: ApolloCache com merge policies

---

### Passo 8 — Aplicar: Segurança

- **Depth limiting**: evitar queries recursivas maliciosas
- **Auth directives**: `@auth(requires: ADMIN)` nos campos protegidos
- **Rate limiting**: por query complexity, não por request count
- **Persisted queries only**: em produção, aceitar apenas queries pré-registradas
- **Validation**: Zod schema nos inputs de mutation (além do GraphQL type system)

### Passo 9 — Aplicar: References

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

# Skill GraphQL — Izanagi

## Schema Design

### Princípios
- **Schema-first**: definir schema.graphql antes de implementar resolvers
- **Node interface**: todo tipo tem `id: ID!` e implementa `Node`
- **Connection pattern**: listas usam `Connection` type (Relay spec) para paginação
- **Input types**: mutations recebem `Input!` types, nunca args soltos

### Naming Conventions
| Elemento | Padrão | Exemplo |
|----------|--------|---------|
| Types | PascalCase | `Associated`, `NewsPost` |
| Fields | camelCase | `fullName`, `createdAt` |
| Inputs | PascalCase + `Input` | `CreatePostInput` |
| Payloads | PascalCase + `Payload` | `CreatePostPayload` |
| Enums | PascalCase + `Enum` | `PostStatusEnum` |
| Arguments | camelCase | `first, after, filter` |

---

## Apollo Client (Frontend)

### Setup
```tsx
import { ApolloClient, InMemoryCache, createHttpLink } from "@apollo/client";

const client = new ApolloClient({
  link: createHttpLink({ uri: "/api/graphql" }),
  cache: new InMemoryCache({
    typePolicies: {
      Query: { fields: { posts: { merge: false } } },
    },
  }),
});
```

### Fragment Colocation
```tsx
const POST_FRAGMENT = gql`
  fragment PostFields on Post {
    id title excerpt publishedAt
  }
`;

// Componente consome apenas o fragment que precisa
function PostCard({ post }: { post: PostFieldsFragment }) { ... }
```

---

## Apollo Server (Backend)

### Codegen First (GraphQL Codegen)
```yaml
generates:
  src/types/graphql.ts:
    plugins:
      - typescript
      - typescript-resolvers
```

### Resolver Pattern
```tsx
const resolvers: Resolvers = {
  Query: {
    posts: async (_, args, { dataSources }) =>
      dataSources.posts.findAll(args),
  },
  Post: {
    author: async (parent, _, { dataSources }) =>
      dataSources.users.findById(parent.authorId),
  },
};
```

---

## Performance

- **DataLoader**: sempre usar para N+1 problem
- **Persisted Queries**: reduzir overhead de rede
- **@defer / @stream**: usar para loading progressivo (quando disponível)
- **Query complexity**: limitar profundidade máxima (3-5 níveis)
- **Batch queries**: ApolloCache com merge policies

---

## Segurança

- **Depth limiting**: evitar queries recursivas maliciosas
- **Auth directives**: `@auth(requires: ADMIN)` nos campos protegidos
- **Rate limiting**: por query complexity, não por request count
- **Persisted queries only**: em produção, aceitar apenas queries pré-registradas
- **Validation**: Zod schema nos inputs de mutation (além do GraphQL type system)

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
