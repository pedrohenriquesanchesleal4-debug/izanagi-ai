---
name: serverless-edge
description: |
  Skill de Serverless e Edge Computing para o Portal. Aborda AWS Lambda, Cloudflare
  Workers, Vercel Edge Functions, serverless patterns, cold start optimization e edge caching.
  Use esta skill para implementar funcionalidades serverless e edge computing.
---

# Skill Serverless & Edge — Portal

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
