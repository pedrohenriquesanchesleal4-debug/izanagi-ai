---
name: "serverless-edge"
description: "Use para implementar funções serverless ou edge (Vercel, AWS Lambda, Cloudflare Workers): padrões, cold start e caching no edge. Gatilhos de ativação: skill serverless & edge — izanagi; plataformas; serverless patterns; cold start optimization."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
references:
  - "references.md"
---

# Skill Serverless & Edge — Izanagi

> Migrado deterministicamente de `skills/serverless-edge/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Use para implementar funções serverless ou edge (Vercel, AWS Lambda, Cloudflare Workers): padrões, cold start e caching no edge.
- **Ativar quando:** Use para implementar funções serverless ou edge (Vercel, AWS Lambda, Cloudflare Workers): padrões, cold start e caching no edge.
- **Escopo canônico:** Skill Serverless & Edge — Izanagi
- **Seções do corpo original:** Plataformas · Serverless Patterns · Cold Start Optimization · Edge Computing · Costs & Limits
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: sections-as-steps -->

### Passo 1 — Aplicar: Vercel Serverless Functions (Preferido)

```tsx
// app/api/hello/route.ts
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Hello from Edge!" });
}
```
- **Runtime**: Node.js 20, Edge Runtime
- **Max duration**: 10s (serverless), 30s (pro), 900s (Enterprise)
- **Memory**: 128MB a 1024MB
- **Cold start**: ~100ms (Node), ~50ms (Edge)

### Passo 2 — Aplicar: AWS Lambda

- **Runtime**: Node.js 20, Python 3.12
- **Max duration**: 900s
- **Memory**: 128MB a 10240MB
- **Cold start**: ~200ms (Node), ~1s (Java/.NET)
- **Triggers**: API Gateway, SQS, S3, DynamoDB Streams, EventBridge

### Passo 3 — Aplicar: Cloudflare Workers (Edge)

- **Runtime**: Service Worker API (V8 isolates)
- **Limites**: 30ms CPU por request, 128MB memory
- **Casos de uso**: redirects, rewrites, A/B testing, geolocation routing

---

### Passo 4 — Aplicar: Lambda + API Gateway

```
Client → API Gateway → Lambda → DynamoDB/S3/External API
```

### Passo 5 — Aplicar: Event-driven

```
S3 Event → Lambda → Process → DynamoDB or SQS → Next Step
```

### Passo 6 — Aplicar: Fan-out

```
SQS → Lambda (process) → SNS → SQS A → Lambda A
                       → SQS B → Lambda B
```

---

### Passo 7 — Aplicar: Cold Start Optimization

| Estrategia | Impacto |
|------------|---------|
| Provisioned Concurrency (Lambda) | Elimina cold start |
| Keep warm (ping regular) | Reduz (nao elimina) |
| Lighter dependencies | Reduz tempo de carga |
| SnapStart (Lambda Java) | ~90% reducao |
| Edge Runtime (Vercel) | ~50ms cold start |
| Workers (Cloudflare) | Zero cold start |

---

### Passo 8 — Aplicar: Edge Functions (Vercel)

- **Geolocation**: rotear conteudo por pais/regiao
- **A/B testing**: servir diferentes variantes
- **Redirects**: redirecionar por dispositivo/idioma
- **Headers**: modificar security headers no edge
- **Authentication**: verificar JWT no edge (reduz latencia)

### Passo 9 — Aplicar: Next.js Edge Middleware

```tsx
// middleware.ts
export function middleware(req: NextRequest) {
  const country = req.geo?.country ?? "BR";
  const url = req.nextUrl.clone();
  if (country !== "BR" && url.pathname === "/") {
    url.pathname = "/internacional";
    return NextResponse.redirect(url);
  }
}
```

---

### Passo 10 — Aplicar: Costs & Limits

| Recurso | Limite | Custo |
|---------|--------|-------|
| Vercel Serverless | 100k requests/mes (Hobby) | Gratuito |
| Vercel Edge | 100k requests/mes (Hobby) | Gratuito |
| AWS Lambda | 1M requests/mes | Sempre gratis |
| Cloudflare Workers | 100k requests/dia | Gratuito |

### Passo 11 — Aplicar: References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.

## Verification Steps

<!-- fonte da verificação: fallback-honesto:devops -->

- Provar o pipeline ponta a ponta em ambiente de teste antes de produção.
- Confirmar healthcheck, rollback e alertas acionáveis configurados para o que foi alterado.
- Verificar que nenhum secret aparece em logs/manifestos gerados.
- Registrar versão, timestamp de deploy e resultado dos checks (rastreabilidade).

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

# Skill Serverless & Edge — Izanagi

## Plataformas

### Vercel Serverless Functions (Preferido)
```tsx
// app/api/hello/route.ts
export async function GET(req: NextRequest) {
  return NextResponse.json({ message: "Hello from Edge!" });
}
```
- **Runtime**: Node.js 20, Edge Runtime
- **Max duration**: 10s (serverless), 30s (pro), 900s (Enterprise)
- **Memory**: 128MB a 1024MB
- **Cold start**: ~100ms (Node), ~50ms (Edge)

### AWS Lambda
- **Runtime**: Node.js 20, Python 3.12
- **Max duration**: 900s
- **Memory**: 128MB a 10240MB
- **Cold start**: ~200ms (Node), ~1s (Java/.NET)
- **Triggers**: API Gateway, SQS, S3, DynamoDB Streams, EventBridge

### Cloudflare Workers (Edge)
- **Runtime**: Service Worker API (V8 isolates)
- **Limites**: 30ms CPU por request, 128MB memory
- **Casos de uso**: redirects, rewrites, A/B testing, geolocation routing

---

## Serverless Patterns

### Lambda + API Gateway
```
Client → API Gateway → Lambda → DynamoDB/S3/External API
```

### Event-driven
```
S3 Event → Lambda → Process → DynamoDB or SQS → Next Step
```

### Fan-out
```
SQS → Lambda (process) → SNS → SQS A → Lambda A
                       → SQS B → Lambda B
```

---

## Cold Start Optimization

| Estrategia | Impacto |
|------------|---------|
| Provisioned Concurrency (Lambda) | Elimina cold start |
| Keep warm (ping regular) | Reduz (nao elimina) |
| Lighter dependencies | Reduz tempo de carga |
| SnapStart (Lambda Java) | ~90% reducao |
| Edge Runtime (Vercel) | ~50ms cold start |
| Workers (Cloudflare) | Zero cold start |

---

## Edge Computing

### Edge Functions (Vercel)
- **Geolocation**: rotear conteudo por pais/regiao
- **A/B testing**: servir diferentes variantes
- **Redirects**: redirecionar por dispositivo/idioma
- **Headers**: modificar security headers no edge
- **Authentication**: verificar JWT no edge (reduz latencia)

### Next.js Edge Middleware
```tsx
// middleware.ts
export function middleware(req: NextRequest) {
  const country = req.geo?.country ?? "BR";
  const url = req.nextUrl.clone();
  if (country !== "BR" && url.pathname === "/") {
    url.pathname = "/internacional";
    return NextResponse.redirect(url);
  }
}
```

---

## Costs & Limits

| Recurso | Limite | Custo |
|---------|--------|-------|
| Vercel Serverless | 100k requests/mes (Hobby) | Gratuito |
| Vercel Edge | 100k requests/mes (Hobby) | Gratuito |
| AWS Lambda | 1M requests/mes | Sempre gratis |
| Cloudflare Workers | 100k requests/dia | Gratuito |

## References

Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
