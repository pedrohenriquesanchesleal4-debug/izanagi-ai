---
name: "site-launch-checklist"
description: "Checklist de entrega de site: performance (pixels adiados, WebP, CLS), SEO em 3 blocos (deixar entrar, deixar entender, deixar rápido), Open Graph, schema, responsividade, rastros de código gerado por IA e visibilidade para buscadores de IA. Use antes de entregar ou publicar qualquer site ou landing page. Gatilhos de ativação: site launch checklist; quando usar; bloco 1: deixar entrar (sem isto, o resto é inútil); bloco 2: deixar entender."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Site Launch Checklist

> Migrado deterministicamente de `skills/site-launch-checklist/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Checklist de entrega de site: performance (pixels adiados, WebP, CLS), SEO em 3 blocos (deixar entrar, deixar entender, deixar rápido), Open Graph, schema, responsividade, rastros de código gerado por IA e visibilidade para buscadores de IA.
- **Ativar quando:** Use antes de entregar ou publicar qualquer site ou landing page.
- **Escopo canônico:** Site Launch Checklist
- **Seções do corpo original:** Quando usar · Bloco 1: deixar entrar (sem isto, o resto é inútil) · Bloco 2: deixar entender · Bloco 3: deixar rápido e apresentável · Bloco 4: rastros de IA
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: paragraphs-as-steps -->

### Passo 1 — Site bonito que não indexa, que pula na tela ou que aparece quebrado no WhatsApp não es...

Site bonito que não indexa, que pula na tela ou que aparece quebrado no WhatsApp não está pronto. Rode este checklist e entregue o resultado junto com o link.

### Passo 2 — Antes de mandar o link ao cliente, antes de apontar o domínio, depois de grande mudança...

Antes de mandar o link ao cliente, antes de apontar o domínio, depois de grande mudança de layout.

### Passo 3 — Pergunte o objetivo da página antes de cor ou fonte.

Pergunte o objetivo da página antes de cor ou fonte. **Landing** tem uma ação só e corta a navegação; **home** distribui para várias rotas. Pedido de "home bonita que converte" geralmente é landing.

### Passo 4 — Tabela com cada item marcado ok, corrigido ou pendente (motivo) e as 3 métricas de Page...

Tabela com cada item marcado `ok`, `corrigido` ou `pendente (motivo)` e as 3 métricas de PageSpeed. Item pendente não some do relatório.

## Verification Steps

<!-- fonte da verificação: checklist-original -->

- [ ] Nenhuma página pública com `noindex` (muito gerador deixa ligado por padrão). `grep -ri "noindex" .` e conferir o HTML servido.
- [ ] `robots.txt` existe e não bloqueia `/`. Não bloqueie robôs de busca de IA (`GPTBot`, `ClaudeBot`, `PerplexityBot`, `Google-Extended`) a menos que o cliente peça.
- [ ] `sitemap.xml` gerado e citado no `robots.txt`.
- [ ] HTTPS forçado, sem conteúdo misto.
- [ ] Um `<h1>` por página; hierarquia `h2`/`h3` sem pular nível.
- [ ] `<title>` e `meta description` únicos e descritivos por página; URL canônica.
- [ ] URLs limpas e links internos entre as páginas.
- [ ] Dados estruturados (JSON-LD): `Organization`/`LocalBusiness`, e `Product`, `Article` ou `Service` conforme a página.
- [ ] Open Graph e Twitter Card (`og:title`, `og:description`, `og:image` 1200x630): testar o link colado no WhatsApp.
- [ ] Pixels e analytics (Google Ads, Meta, GA4, Clarity) carregam só após a primeira interação ou com `defer`/`afterInteractive`.

## Common Rationalizations

- **"Funciona na minha máquina, o problema é o ambiente."**
  - Verdade: Ambiente é parte do sistema. Sem IaC/container reproduzível, 'funciona aqui' é sintoma de config drift não diagnosticado — não é explicação, é o bug.
- **"Deploy manual hoje, pipeline depois que estabilizar."**
  - Verdade: Processo manual não estabiliza, fossiliza. Cada deploy manual adiciona um passo não versionado que o pipeline futuro terá que adivinhar.
- **"Monitoramento a gente implanta quando escalar."**
  - Verdade: Sem métrica baseline antes de escalar, degradação é invisível até o outage. Observabilidade é pré-condição de mudança, não resposta a incidente.
- **"Rollback nunca precisamos, pra que testar?"**
  - Verdade: A primeira necessidade de rollback é sempre a pior hora possível. Deploy sem caminho de volta verificado é aposta, não release.
- **"CI tá lento, vou pular os checks só dessa vez."**
  - Verdade: 'Só dessa vez' define o novo padrão do time. Checks pulados = gate inexistente; se o gate está errado, corrija o gate, não o contorne.
- **"Alerta demais incomoda, melhor só o essencial depois."**
  - Verdade: Sem alerta acionável, o primeiro sinal de incidente é o usuário. SLI/SLO definido antes evita tanto o silêncio quanto o spam de alerta.

## Red Flags

- Pipeline sem etapa obrigatória de build+teste antes do deploy.
- Secrets impressos no log de CI (mesmo mascarados tardiamente).
- Serviço sem healthcheck/readiness probe configurado.
- Infra alterada direto no console, fora do código versionado (drift).
- Single point of failure sem redundância nem plano documentado.
- Backup existente mas nunca restaurado em teste.
- Rollout sem estratégia gradual (canary/feature flag) em mudança de risco.

## Legacy Reference (v1)

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
