---
name: site-launch-checklist
description: "Checklist de entrega de site: performance (pixels adiados, WebP, CLS), SEO em 3 blocos (deixar entrar, deixar entender, deixar rápido), Open Graph, schema, responsividade, rastros de código gerado por IA e visibilidade para buscadores de IA. Use antes de entregar ou publicar qualquer site ou landing page."
triggers:
  - "entregar site para cliente"
  - "publicar landing page"
  - "site não aparece no Google"
  - "revisão final de SEO e performance"
capabilities:
  - "launch-qa"
  - "technical-seo"
  - "core-web-vitals"
  - "ai-search-visibility"
---

# Site Launch Checklist

Site bonito que não indexa, que pula na tela ou que aparece quebrado no WhatsApp não está pronto. Rode este checklist e entregue o resultado junto com o link.

## Quando usar

Antes de mandar o link ao cliente, antes de apontar o domínio, depois de grande mudança de layout.

## Bloco 1: deixar entrar (sem isto, o resto é inútil)

- [ ] Nenhuma página pública com `noindex` (muito gerador deixa ligado por padrão). `grep -ri "noindex" .` e conferir o HTML servido.
- [ ] `robots.txt` existe e não bloqueia `/`. Não bloqueie robôs de busca de IA (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) a menos que o cliente peça.
- [ ] `sitemap.xml` gerado e citado no `robots.txt`.
- [ ] HTTPS forçado, sem conteúdo misto.

## Bloco 2: deixar entender

- [ ] Um `<h1>` por página; hierarquia `h2`/`h3` sem pular nível.
- [ ] `<title>` e `meta description` únicos e descritivos por página; URL canônica.
- [ ] URLs limpas e links internos entre as páginas.
- [ ] Dados estruturados (JSON-LD): `Organization`/`LocalBusiness`, e `Product`, `Article` ou `Service` conforme a página.
- [ ] Open Graph e Twitter Card (`og:title`, `og:description`, `og:image` 1200x630): testar o link colado no WhatsApp.

## Bloco 3: deixar rápido e apresentável

- [ ] Pixels e analytics (Google Ads, Meta, GA4, Clarity) carregam só após a primeira interação ou com `defer`/`afterInteractive`.
- [ ] Imagens em WebP/AVIF, com `width`/`height` e `loading="lazy"` abaixo da dobra.
- [ ] CLS perto de zero: nada pula na tela (fontes com `font-display: swap` e fallback de métrica, espaço reservado para mídia).
- [ ] Responsivo testado em 4 larguras: 1440, 1280, 768, 390.
- [ ] PageSpeed Insights mobile: anote LCP, CLS, INP no relatório de entrega.

## Bloco 4: rastros de IA

- [ ] Sem comentários de gerador, `console.log`, lorem ipsum, links `#`, textos "Your Company".
- [ ] Sem visual genérico: rodar `anti-ai-slop` na home.
- [ ] Favicon e `apple-touch-icon` próprios.

## Antes de começar: home ou landing?

Pergunte o objetivo da página antes de cor ou fonte. **Landing** tem uma ação só e corta a navegação; **home** distribui para várias rotas. Pedido de "home bonita que converte" geralmente é landing.

## Saída

Tabela com cada item marcado `ok`, `corrigido` ou `pendente (motivo)` e as 3 métricas de PageSpeed. Item pendente não some do relatório.
