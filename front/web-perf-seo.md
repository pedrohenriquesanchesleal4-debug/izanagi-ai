---
name: web-perf-seo
description: "Otimização de Core Web Vitals (LCP, CLS, INP), carregamento de assets (fontes, imagens, bundle JS) e SEO técnico com metadados OpenGraph e dados estruturados JSON-LD."
triggers:
  - "otimizar velocidade de carregamento, LCP, CLS ou INP da aplicação"
  - "configurar SEO on-page, metadados sociais OpenGraph e JSON-LD"
  - "auditar pontuação de Lighthouse para atingir 95+ em produção"
stack: [nextjs, web-vitals, lighthouse, seo, performance]
---

# Web Performance & SEO Técnico — Core Web Vitals 2026

Esta skill condensa os parâmetros essenciais de engenharia de performance e SEO para garantir carregamento instantâneo, estabilidade visual absoluta e indexação máxima nos motores de busca.

---

## 1. As Métricas dos Core Web Vitals (Metas Obrigatórias)

| Métrica | Meta Ideal | O Que Mede | Como Otimizar |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | **< 2.5s** | Tempo até o maior elemento visual (imagem hero ou título) renderizar | Imagem hero com `priority` no `next/image`; pré-carregamento de fontes; Server-Side Rendering (SSR). |
| **CLS** (Cumulative Layout Shift) | **< 0.1** | Estabilidade visual (ausência de elementos pulando na tela) | Sempre declarar `width` e `height` explícitos em imagens e vídeos; reservar espaço para banners. |
| **INP** (Interaction to Next Paint) | **< 200ms** | Tempo de resposta visual do navegador após um clique ou digitação | Evitar tarefas síncronas longas na main thread; usar `startTransition` para atualizações pesadas. |

---

## 2. Otimização de Assets (Imagens, Fontes e Bundle)

### 2.1 Imagens com `next/image`
- Imagens acima da dobra (Hero LCP) **DEVEM** conter `priority`:
  ```tsx
  <Image
    src="/hero-cover.webp"
    alt="Visão geral da plataforma NexusAI"
    width={1200}
    height={630}
    priority
    className="rounded-2xl border border-zinc-800"
  />
  ```
- Imagens de fundo ou dinâmicas que preenchem o contêiner:
  ```tsx
  <div className="relative w-full h-80">
    <Image
      src="/banner.webp"
      alt="Fundo ilustrativo"
      fill
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      className="object-cover"
    />
  </div>
  ```

### 2.2 Fontes com `next/font` (Zero CLS Tipográfico)
O `next/font` faz o download das fontes no build e as hospeda localmente, aplicando `size-adjust` para que a fonte de fallback ocupe exatamente a mesma área que a fonte web:

```tsx
// app/layout.tsx
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="bg-zinc-950 text-zinc-100 font-sans">{children}</body>
    </html>
  );
}
```

---

## 3. SEO Técnico & Metadados em Next.js App Router

### 3.1 Metadata Dinâmico & OpenGraph
Defina metadados no `page.tsx` ou `layout.tsx`:

```tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'NexusAI — Engenharia Autônoma de Software',
  description: 'Plataforma multi-agente de desenvolvimento e arquitetura de código de alta fidelidade.',
  metadataBase: new URL('https://nexusai.dev'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'NexusAI — Engenharia Autônoma de Software',
    description: 'Arquitetura e desenvolvimento de ponta a ponta com agentes especializados.',
    url: 'https://nexusai.dev',
    siteName: 'NexusAI',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Pré-visualização do NexusAI',
      },
    ],
    locale: 'pt_BR',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NexusAI — Engenharia Autônoma de Software',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};
```

### 3.2 Dados Estruturados (JSON-LD)
Injete marcação semântica para rich snippets no Google:

```tsx
export function JsonLdSchema() {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'NexusAI',
    operatingSystem: 'All',
    applicationCategory: 'DeveloperApplication',
    offers: {
      '@type': 'Offer',
      price: '0.00',
      priceCurrency: 'USD',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
```

---

## 4. Checklist de Performance & SEO

- [ ] LCP < 2.5s com imagem herói carregada com `priority`.
- [ ] Todas as imagens possuem largura e altura definidas para garantir CLS < 0.1.
- [ ] Fontes são gerenciadas via `next/font` sem dependência de requisições externas em tempo de execução.
- [ ] Tags OpenGraph (`og:image`, `og:title`, `og:description`) configuradas com imagem 1200×630px.
- [ ] URL canônica (`alternates.canonical`) declarada para evitar conteúdo duplicado.
- [ ] Scripts pesados e modais secundários carregados com import dinâmico (`next/dynamic`).
