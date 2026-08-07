# Referências — Performance & SEO

Curadoria de métricas, ferramentas e boas práticas para entregar sites rápidos e encontráveis. URLs canônicas — **nunca invente URLs além destas**.

## Métricas & ferramentas

| Recurso | URL | O que extrair |
|---|---|---|
| Core Web Vitals | https://web.dev/vitals | As 3 métricas: LCP (carregamento), INP (interação), CLS (estabilidade visual) + limites "good" |
| Lighthouse | https://developer.chrome.com/docs/lighthouse | Auditoria automatizada (performance, a11y, SEO, best practices) — rodar no CI |
| PageSpeed Insights | https://pagespeed.web.dev | Score de campo e laboratório por URL real |
| web.dev/learn | https://web.dev/learn | Trilhas gratuitas: performance, a11y, HTML/CSS/JS |

## Otimização prática

| Recurso | URL | O que extrair |
|---|---|---|
| Next.js Image | https://nextjs.org/docs/app/api-reference/components/image | `<Image>` com AVIF/WebP, lazy loading, responsive sizes, CLS zero |
| Schema.org | https://schema.org | Dados estruturados (JSON-LD: Product, Article, Organization, FAQ) |
| Guia SEO do Google | https://developers.google.com/search/docs/fundamentals/seo-starter-guide | Fundamentos oficiais: títulos, metadados, crawlability, sitemaps |

## Como usar no Izanagi

- **Quando consultar**: Discovery deve abrir esta curadoria na Fase 3 (P15 — restrições) para transformar "quero site rápido" em critérios mensuráveis; e para incluir LCP/INP/CLS nos Critérios de Aceite do prompt rico.
- **Como citar no prompt rico**: nas seções "Restrições" e "Critérios de Aceite" (ex: "LCP < 2,5s em 4G; Lighthouse performance ≥ 90; JSON-LD Product no site").
- **Regra de ouro**: performance não é opinião — é métrica; todo prompt rico deve conter números (web.dev/vitals) e a ferramenta de verificação (Lighthouse/PageSpeed).
- **Para o senior-engineer/web-perf**: usar aliases `web-perf-seo` e `webapp-testing` para auditar antes do deploy; acessibilidade revisada com `a11y`.
