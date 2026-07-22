---
name: web-perf-seo
description: |
  Skill de Web Performance e SEO para o Portal. Aborda Core Web Vitals, lighthouse,
  otimizacao de assets, cache, SEO on-page, structured data e analytics.
  Use esta skill para auditar e otimizar performance e visibilidade nos buscadores.
---

# Skill Web Performance & SEO — Portal

## Core Web Vitals

| Metrica | Bom | Precisa Melhorar | Ruim |
|---------|-----|------------------|------|
| LCP (Largest Contentful Paint) | < 2.5s | 2.5-4.0s | > 4.0s |
| FID (First Input Delay) | < 100ms | 100-300ms | > 300ms |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |
| INP (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |

---

## Otimizacao de Performance

### Imagens
```tsx
// Usar componente OptimizedImage do projeto
<OptimizedImage
  src="/images/banner.jpg"
  alt="Banner"
  width={1200}
  height={600}
  priority={false}          // true para acima do fold
  loading="lazy"            // lazy para abaixo do fold
/>
```

### Fontes
- `next/font` com `display=swap` (nunca usar google fonts via link tag)
- Subset de caracteres (latin, latin-ext)
- Preload de fontes criticas

### Code Splitting
```tsx
// Componentes pesados carregados sob demanda
const HtmlEditor = dynamic(() => import("@/components/HtmlEditor"), {
  ssr: false,
  loading: () => <Loading />,
});
```

### Cache
| Estrategia | Onde | TTL |
|------------|------|-----|
| CDN cache | CloudFront (static assets) | 1 ano (hash) |
| SSR cache | Next.js ISR | Sob demanda |
| Browser cache | Service Worker | Network First |
| API cache | Supabase cache | 60s |

---

## SEO On-Page

### Head
```tsx
import Head from "next/head";

<Head>
  <title>Portal — {pageTitle}</title>
  <meta name="description" content={pageDescription} />
  <meta property="og:title" content={pageTitle} />
  <meta property="og:description" content={pageDescription} />
  <meta property="og:image" content={ogImage} />
  <link rel="canonical" href={`https://portal.example.com${path}`} />
</Head>
```

### Estrutura de Conteudo
- Unico `<h1>` por pagina
- Hierarquia: `h1 → h2 → h3` (sem pular niveis)
- URLs amigaveis: `/noticias/titulo-da-noticia` (slug descritivo)
- Internal linking entre paginas relacionadas

---

## Structured Data (JSON-LD)

```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: post.title,
      datePublished: post.publishedAt,
      author: { "@type": "Organization", name: "Portal" },
    }),
  }}
/>
```

---

## Analytics

| Ferramenta | Uso |
|------------|-----|
| Google Analytics 4 | Trafego geral, comportamento |
| Google Search Console | SEO, indexacao, queries |
| Vercel Analytics | Core Web Vitals, performance |
| Sentry | Error tracking |
