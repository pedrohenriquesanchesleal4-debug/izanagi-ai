---
name: "i18n-l10n"
description: "Padrões de i18n/l10n com next-intl, react-intl, locale routing e formatação de datas/números/moeda. Use ao internacionalizar ou traduzir uma aplicação Next.js. Gatilhos de ativação: skill i18n & localization — izanagi; stack recomendada; next-intl setup; estrutura de mensagens."
version: 2.0.0
category: engineering
tools:
  mcp:
    - mcp:fs_write
    - mcp:execute_command
---

# Skill i18n & Localization — Izanagi

> Migrado deterministicamente de `skills/i18n-l10n/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** Engenharia (`engineering`)
- **Resumo:** Padrões de i18n/l10n com next-intl, react-intl, locale routing e formatação de datas/números/moeda.
- **Ativar quando:** Use ao internacionalizar ou traduzir uma aplicação Next.js.
- **Escopo canônico:** Skill i18n & Localization — Izanagi
- **Seções do corpo original:** Stack Recomendada · next-intl Setup · Estrutura de Mensagens · Uso nos Componentes · Boas Praticas
- **Ferramentas MCP esperadas:** mcp:fs_write, mcp:execute_command

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Stack Recomendada

| Ferramenta | Uso |
|------------|-----|
| `next-intl` | i18n para Next.js App Router (preferido) |
| `react-intl` | Alternativa madura |
| Lokalise / Crowdin | Gerenciamento de traducao |
| ICU Message Syntax | Formato de mensagens com placeholders |

---

### Passo 2 — Aplicar: Configuracao

```tsx
// i18n.ts
import { getRequestConfig } from "next-intl/server";

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));
```

### Passo 3 — Aplicar: Middleware (Locale Detection)

```tsx
import createMiddleware from "next-intl/middleware";

export default createMiddleware({
  locales: ["pt-BR", "en", "es"],
  defaultLocale: "pt-BR",
  localePrefix: "as-needed",  // /sobre (pt-BR) vs /en/about
});
```

---

### Passo 4 — Aplicar: Estrutura de Mensagens

```json
// messages/pt-BR.json
{
  "nav": {
    "home": "Inicio",
    "about": "Sobre",
    "contact": "Contato"
  },
  "home": {
    "title": "Bem-vindo ao Izanagi",
    "description": "Enterprise Organization System"
  },
  "common": {
    "loading": "Carregando...",
    "error": "Erro ao carregar dados",
    "retry": "Tentar novamente"
  }
}
```

---

### Passo 5 — Aplicar: Uso nos Componentes

```tsx
import { useTranslations } from "next-intl";

export default function Hero() {
  const t = useTranslations("home");

  return (
    <h1>{t("title")}</h1>
  );
}
```

### Passo 6 — Aplicar: Formatação

```tsx
import { useFormatter } from "next-intl";

const format = useFormatter();
format.dateTime(new Date(), { dateStyle: "long" });
format.number(1234567.89, { style: "currency", currency: "BRL" });
```

---

### Passo 7 — Aplicar: Boas Praticas

- **Granularidade**: mensagens organizadas por pagina/componente (nao um arquivao so)
- **Fallbacks**: locale fallback para en (ou pt-BR) se traducao faltando
- **SEO**: `<link rel="alternate" hreflang="pt-BR" href="...">` em cada pagina
- **RTL**: preparar CSS para idiomas right-to-left (arabe, hebraico)
- **Plurais**: ICU `{count, plural, one {# item} other {# items}}`
- **Dynamic content**: nunca concatenar strings traduzidas com interpolacao manual

### Passo 8 — Aplicar: References

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

# Skill i18n & Localization — Izanagi

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
    "title": "Bem-vindo ao Izanagi",
    "description": "Enterprise Organization System"
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

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
