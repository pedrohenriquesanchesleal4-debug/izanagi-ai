---
name: graphql
description: |
  Skill de GraphQL para o Portal. Contém padrões de schema design, resolver patterns,
  Apollo Client/Server, caching, subscriptions e boas práticas de performance.
  Use esta skill para implementar ou revisar APIs GraphQL.
---

# Skill GraphQL — Portal

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
