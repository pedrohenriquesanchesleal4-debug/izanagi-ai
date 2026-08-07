# Referências — Stack Moderna 2026

Curadoria da stack recomendada pelo Izanagi para projetos novos. URLs canônicas — **nunca invente URLs além destas**.

## Frontend

| Recurso | URL | Por quê |
|---|---|---|
| Next.js | https://nextjs.org | Framework React full-stack: App Router, SSR/SSG, Server Components, Image optimization, deploy 1-clique na Vercel |
| React | https://react.dev | Docs oficiais (inclui React 19: actions, useOptimistic, Server Components) |
| Tailwind CSS | https://tailwindcss.com | CSS utility-first (v4: engine nova, CSS-first config) — base do design system Izanagi |
| TypeScript | https://www.typescriptlang.org | Tipagem estática — exigência de qualidade do framework |
| Vite | https://vitejs.dev | Build/dev server rápido — alternativa a Next.js para SPA pura ou libs |

## Backend & dados

| Recurso | URL | Por quê |
|---|---|---|
| Node.js | https://nodejs.org | Runtime (versão LTS atual 22+) |
| Prisma | https://www.prisma.io | ORM TypeScript-first com migrations e Prisma Studio — mais produtivo |
| Drizzle | https://orm.drizzle.team | ORM SQL-like, leve e tipado — alternativa para quem prefere SQL explícito |
| PostgreSQL | https://www.postgresql.org | Banco relacional padrão (JSONB, full-text, extensões) |
| Redis | https://redis.io | Cache, filas, rate limiting, sessões |

## Infra & deploy

| Recurso | URL | Por quê |
|---|---|---|
| Docker | https://www.docker.com | Containerização padronizada para dev/prod |
| Vercel | https://vercel.com | Deploy de Next.js com edge/preview automáticos |
| Cloudflare | https://www.cloudflare.com | CDN, Workers, R2, Pages — edge global e custo baixo |
| pnpm | https://pnpm.io | Gerenciador de pacotes rápido e eficiente (hard links, workspace) |

## Como usar no Izanagi

- **Quando consultar**: Discovery deve abrir esta curadoria na Fase 3 (P14 — stack) para justificar a stack no blueprint; se o usuário disser "aberto a sugestão", esta é a recomendação padrão.
- **Como citar no prompt rico**: na seção "Arquitetura" (stack com justificativa) e nas "Decisões ADR-lite" (ex: "ADR-1: Next.js App Router + Tailwind v4 + shadcn/ui; trade-off: SSR vs SPA puro").
- **Regras**: stack não é decisão do agente — é confirmada com o usuário na Fase 3; quando houver backend com dados, acionar aliases `architect`/`data-engineering`/`db` para o blueprint.
- **Para o senior-engineer**: consultar esta curadoria antes de instalar dependências (RULES.md: pré-instalar deps antes de codar) e alinhar versões com package.json.
