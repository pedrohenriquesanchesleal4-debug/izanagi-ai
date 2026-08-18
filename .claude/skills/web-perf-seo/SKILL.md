---
name: web-perf-seo
description: "Otimiza Core Web Vitals (LCP, CLS, INP), assets, cache e SEO on-page (meta tags, structured data) com metas de Lighthouse. Use ao criar páginas, otimizar performance ou auditar SEO."
---

# Web Performance & SEO — Manual Operacional

Manual denso de performance web e SEO para sistemas de produção. Baseado em Core Web Vitals 2026 (Google), Lighthouse 12, web.dev, e práticas de performance de produção (Vercel, Shopify, Next.js).

## Quando usar

- Criar páginas novas (SEO obrigatório desde o início).
- Otimizar performance (LCP lento, CLS alto, INP lento).
- Auditar SEO (meta tags, structured data, heading hierarchy).
- Configurar caching e CDN.
- Otimizar assets (imagens, fontes, JavaScript).

**Pule** para `frontend` para padrões de componentes React/Tailwind; `animation-web` para animações que não impactam performance negativamente.

---

## Core Web Vitals 2026

| Métrica | Bom | Precisa Melhorar | Ruim | O que mede |
|---|---|---|---|---|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5-4.0s | > 4.0s | Tempo até o maior elemento visível renderizar |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 | Instabilidade visual (layout shifts) |
| **INP** (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms | Responsividade a interações do usuário |

### Diagnóstico e Fix por Métrica

#### LCP lento (> 2.5s)

| Causa | Diagnóstico | Fix |
|---|---|---|
| Imagem hero grande | DevTools → Performance → LCP element | `next/image` com `priority`, WebP/AVIF, `sizes` attribute |
| Font blocking render | Waterfall mostra font antes de FCP | `next/font` com `display: swap`, font subsetting |
| JS bundle grande | Bundle analyzer mostra chunk > 100KB | Code splitting com `dynamic()`, tree shaking |
| Server response lento | TTFB > 600ms | SSG/ISR em vez de SSR, CDN, edge functions |
| Render-blocking CSS | CSS no `<head>` sem critical path extraction | Critical CSS inline, resto async |

#### CLS alto (> 0.1)

| Causa | Diagnóstico | Fix |
|---|---|---|
| Imagem sem dimensões | Layout shift quando imagem carrega | `width` + `height` em TODAS as `<img>`, `aspect-ratio` CSS |
| Font swap | Texto muda de tamanho quando font carrega | `font-display: optional` ou `size-adjust` |
| Conteúdo injetado acima do viewport | Banner/ad carrega e empurra conteúdo | Reservar espaço com `min-height` fixo |
| Componente dynamic sem skeleton | Espaço vazio → conteúdo aparece | Skeleton/placeholder com dimensões fixas |

#### INP lento (> 200ms)

| Causa | Diagnóstico | Fix |
|---|---|---|
| Event handler pesado | Long task na main thread | `requestIdleCallback`, `setTimeout(fn, 0)` para work deferido |
| Re-render excessivo | React Profiler mostra re-renders | `React.memo`, `useMemo`, `useCallback` |
| DOM grande (> 1500 nodes) | DevTools → Elements conta | Virtualização (react-virtual), paginação |
| Third-party scripts | Long tasks de analytics/chat widgets | `defer`, `async`, ou carregar após interação |

---

## Otimização de Assets

### Imagens

```tsx
// ✅ Padrão obrigatório com next/image
import Image from 'next/image';

<Image
  src="/images/hero.webp"
  alt="Descrição acessível e relevante para SEO"
  width={1200}
  height={630}
  priority              // true APENAS para imagens above-the-fold (LCP candidate)
  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 1200px"
  placeholder="blur"    // Evita CLS com placeholder blur
  blurDataURL={blurUrl} // Gerar com plaiceholder ou next/image auto
/>
```

| Formato | Uso | Suporte | Economia vs JPEG |
|---|---|---|---|
| **WebP** | Fotos, banners, thumbnails | 97%+ browsers | 25-35% menor |
| **AVIF** | Fotos de alta qualidade | 92%+ browsers | 50% menor |
| **SVG** | Ícones, logos, ilustrações | 100% | Infinitamente escalável |
| **PNG** | Screenshots, imagens com transparência | 100% | Usar só quando necessário |

### Fontes

```tsx
// ✅ next/font (zero layout shift, zero network request bloqueante)
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',          // Texto visível imediatamente
  variable: '--font-inter',
});
```

- [ ] `next/font` em vez de `<link>` do Google Fonts (elimina round-trip)
- [ ] `display: swap` ou `display: optional` (nunca `block`)
- [ ] Subset: `latin` + `latin-ext` (não carregar grego/cirílico se não usar)
- [ ] Variable fonts quando disponíveis (1 arquivo vs 6 weights)

### Code Splitting

```tsx
// Componentes pesados: lazy loading
const HeavyEditor = dynamic(() => import('@/components/HtmlEditor'), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full" />,
});

// Rotas: Next.js já faz code splitting por página automaticamente
// Bibliotecas: import dinâmico para libs pesadas (chart.js, three.js)
const loadChart = () => import('chart.js').then(m => m.default);
```

---

## Estratégias de Cache

| Camada | Estratégia | TTL | Quando usar |
|---|---|---|---|
| **CDN** (CloudFront/Vercel Edge) | `immutable` com hash no filename | 1 ano | Assets estáticos (JS, CSS, imagens) |
| **ISR** (Incremental Static Regeneration) | `revalidate` por tempo ou on-demand | 60s-24h | Páginas com dados semi-estáticos (blog, produtos) |
| **SSG** (Static Site Generation) | Build-time | Até próximo build | Páginas que nunca mudam (about, legal, docs) |
| **SWR** (stale-while-revalidate) | Serve cache + revalida em background | Variável | API responses no client (useSWR, react-query) |
| **Service Worker** | Network First / Cache First | Configurável | PWA, offline-first |
| **Browser Cache** | Cache-Control headers | 1h-1ano | Recursos estáticos com versionamento |

### Cache-Control Headers

```http
# Assets estáticos (JS, CSS, imagens com hash)
Cache-Control: public, max-age=31536000, immutable

# HTML de páginas ISR
Cache-Control: public, s-maxage=60, stale-while-revalidate=300

# API responses
Cache-Control: private, no-cache, must-revalidate

# Dados sensíveis
Cache-Control: private, no-store
```

---

## SEO On-Page

### Meta Tags Obrigatórias (por página)

```tsx
// Next.js App Router (metadata export)
export const metadata: Metadata = {
  title: 'Título Específico da Página — Nome do Site',  // 50-60 chars
  description: 'Descrição compelling com keywords naturais, 150-160 chars max.',
  openGraph: {
    title: 'Título para compartilhamento social',
    description: 'Descrição para redes sociais',
    images: [{ url: '/og/pagina.png', width: 1200, height: 630 }],
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Título para Twitter/X',
    description: 'Descrição para Twitter/X',
  },
  alternates: { canonical: 'https://site.com/pagina' },
  robots: { index: true, follow: true },
};
```

### Checklist SEO

- [ ] `<title>` único e descritivo por página (50-60 chars)
- [ ] `<meta name="description">` compelling (150-160 chars)
- [ ] Um único `<h1>` por página
- [ ] Heading hierarchy correta: h1 → h2 → h3 (sem pular níveis)
- [ ] URLs amigáveis com slugs legíveis (`/blog/titulo-do-post`)
- [ ] `<link rel="canonical">` em todas as páginas
- [ ] Open Graph tags para compartilhamento social
- [ ] `sitemap.xml` gerado automaticamente
- [ ] `robots.txt` configurado
- [ ] Imagens com `alt` descritivo e relevante

### Structured Data (JSON-LD)

```tsx
// Exemplo: Artigo
<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: post.title,
  datePublished: post.publishedAt,
  dateModified: post.updatedAt,
  author: { '@type': 'Person', name: post.author.name },
  image: post.coverImage,
  publisher: {
    '@type': 'Organization',
    name: 'Nome do Site',
    logo: { '@type': 'ImageObject', url: '/logo.png' },
  },
}) }} />
```

| Schema Type | Quando usar |
|---|---|
| `Article` / `NewsArticle` | Blog posts, notícias |
| `Product` | Páginas de produto (e-commerce) |
| `Organization` | Página principal da empresa |
| `FAQ` | ⚠️ Google **removeu o rich result de FAQ** em 07/05/2026 (suporte no Search Console e Rich Results Test caiu em jun/2026, API em ago/2026). Mantenha o schema `FAQPage` para ajudar o entendimento da página e AI Overviews/voice — mas não espere o snippet expandido no SERP |
| `BreadcrumbList` | Navegação breadcrumb |
| `WebApplication` | SaaS / App |
| `HowTo` | Tutoriais passo-a-passo |

---

## Auditoria Lighthouse — Targets

| Categoria | Target mínimo | Ideal |
|---|---|---|
| Performance | ≥ 90 | ≥ 95 |
| Accessibility | ≥ 95 | 100 |
| Best Practices | ≥ 95 | 100 |
| SEO | ≥ 95 | 100 |

### Como rodar

```bash
# CLI (headless)
npx lighthouse https://site.com --output=json --output-path=./lighthouse.json

# Chrome DevTools → Lighthouse tab → Analyze page load
```

### Peso de cada métrica no Performance score

O score de Performance é uma média ponderada (curva log-normal contra dados reais do HTTP Archive) — **TBT e LCP somam mais da metade do peso**, então são a prioridade de otimização:

| Métrica | Peso |
|---|---|
| Total Blocking Time (TBT) | 30% |
| Largest Contentful Paint (LCP) | 25% |
| Cumulative Layout Shift (CLS) | 25% |
| First Contentful Paint (FCP) | 10% |
| Speed Index (SI) | 10% |

Os pesos mudam entre versões do Lighthouse (o time do Chrome recalibra com base em pesquisa de UX real) — confirme a versão atual em `developer.chrome.com/docs/lighthouse/performance/performance-scoring` antes de prometer uma nota exata.

---

## Anti-padrões (NUNCA)

| Anti-padrão | Impacto | Fix |
|---|---|---|
| Imagens sem `width`/`height` | CLS alto | Sempre especificar dimensões |
| Google Fonts via `<link>` no `<head>` | Render-blocking, FOUT | `next/font` |
| JS bundle > 200KB inicial | LCP lento | Code splitting, tree shaking |
| `loading="lazy"` em imagem above-the-fold | LCP lento | `priority={true}` para LCP candidates |
| `overflow-x: hidden` no body como "fix" para layout | Esconde problemas de layout | Corrigir o overflow real |
| Meta description duplicada entre páginas | SEO penalizado | Descrição única por página |
| Sem `alt` em imagens | Accessibility + SEO penalizados | `alt` descritivo sempre |

---

## Composição com outras skills

- **Antes**: `ui-ux-pro-max` (design system com performance), `frontend` (componentes otimizados)
- **Durante**: `accessibility-reviewer` (contraste, ARIA), `qa` (checklist de performance)
- **Depois**: `devops` (CDN, headers, compression)

## References

- Core Web Vitals (oficial): https://web.dev/learn-web-vitals/ · Lighthouse scoring (oficial): https://developer.chrome.com/docs/lighthouse/performance/performance-scoring
- Structured data (oficial, políticas gerais): https://developers.google.com/search/docs/appearance/structured-data/sd-policies · Galeria completa de rich results: https://developers.google.com/search/docs/appearance/structured-data/search-gallery · Vocabulário: https://schema.org
- PageSpeed Insights (dados de campo + lab): https://pagespeed.web.dev
- Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

> Gerado pelo Izanagi AI: cópia fiel de `skills/web-perf-seo/SKILL.md` (fonte da verdade).
