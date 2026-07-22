---
name: i18n-l10n
description: |
  Skill de Internacionalizacao (i18n) e Localizacao (l10n) para o Portal. Aborda
  next-intl, react-intl, gerenciamento de traducoes, locale routing, formatação de datas/
  numeros/moeda e boas praticas de internacionalizacao em Next.js.
---

# Skill i18n & Localization — Portal

## Stack Recomendada

| Ferramenta | Uso |
|------------|-----|
| `next-intl` | i18n para Next.js App Router (preferido) |
| `react-intl` | Alternativa madura |
| Lokalise / Crowdin | Gerenciamento de traducao |
| ICU Message Syntax | Formato de mensagens com placeholders |

---

## next-intl Setup

### Configuracao
```tsx
// i18n.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

### Middleware (Locale Detection)
```tsx
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["pt-BR", "en", "es"],
  defaultLocale: "pt-BR",
  localePrefix: "as-needed",  // /sobre (pt-BR) vs /en/about
});
```

---

## Estrutura de Mensagens

```json
// messages/pt-BR.json
{
  "nav": {
    "home": "Inicio",
    "about": "Sobre",
    "contact": "Contato"
  },
  "home": {
    "title": "Bem-vindo ao Portal",
    "description": "Associacao Nacional dos Servidores da Previdencia"
  },
  "common": {
    "loading": "Carregando...",
    "error": "Erro ao carregar dados",
    "retry": "Tentar novamente"
  }
}
```

---

## Uso nos Componentes

```tsx
import { useTranslations } from "next-intl";

export default function Hero() {
  const t = useTranslations("home");

  return (
    <h1>{t("title")}</h1>
  );
}
```

### Formatação
```tsx
import { useFormatter } from "next-intl";

const format = useFormatter();
format.dateTime(new Date(), { dateStyle: "long" });
format.number(1234567.89, { style: "currency", currency: "BRL" });
```

---

## Boas Praticas

- **Granularidade**: mensagens organizadas por pagina/componente (nao um arquivao so)
- **Fallbacks**: locale fallback para en (ou pt-BR) se traducao faltando
- **SEO**: `<link rel="alternate" hreflang="pt-BR" href="...">` em cada pagina
- **RTL**: preparar CSS para idiomas right-to-left (arabe, hebraico)
- **Plurais**: ICU `{count, plural, one {# item} other {# items}}`
- **Dynamic content**: nunca concatenar strings traduzidas com interpolacao manual
