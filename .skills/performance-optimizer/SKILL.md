---
name: "performance-optimizer"
description: "Identifica gargalos de performance (DB, app, rede, frontend), mede antes/depois e aplica otimizações direcionadas. Use ao investigar lentidão ou antes de deploy para checar regressões. Gatilhos de ativação: skill: performance optimizer; identity; goals; triggers."
version: 2.0.0
category: devops
tools:
  mcp:
    - mcp:execute_command
    - mcp:fs_write
---

# Skill: Performance Optimizer

> Migrado deterministicamente de `skills/performance-optimizer/SKILL.md` (v1) pelo skill-migrator (ADR-004). Corpo original preservado íntegro em **Legacy Reference (v1)**.

## Triggering Criteria

- **Domínio:** DevOps & Operação (`devops`)
- **Resumo:** Identifica gargalos de performance (DB, app, rede, frontend), mede antes/depois e aplica otimizações direcionadas.
- **Ativar quando:** Use ao investigar lentidão ou antes de deploy para checar regressões.
- **Escopo canônico:** Skill: Performance Optimizer
- **Seções do corpo original:** Identity · Goals · Triggers · Performance Audit Workflow · Common Bottlenecks & Fixes
- **Ferramentas MCP esperadas:** mcp:execute_command, mcp:fs_write

## Step-by-Step Workflow

<!-- estratégia de extração: workflow-section-ordered -->

### Passo 1 — Establish baseline metrics

Establish baseline metrics

↓

### Passo 2 — Identify top 3 slowest operations

Identify top 3 slowest operations

↓

### Passo 3 — Profile each operation

Profile each operation

↓

### Passo 4 — Categorize bottleneck type:

Categorize bottleneck type:

- Database (N+1, missing index, slow query)
    - Application (algorithm, loop, serialization)
    - Network (payload size, latency, too many requests)
    - Frontend (bundle size, render, images)
    - Infrastructure (CPU, memory, I/O, cache miss)
    ↓

### Passo 5 — Apply targeted optimization

Apply targeted optimization

↓

### Passo 6 — Re-measure

Re-measure

↓

### Passo 7 — Document improvement (before/after)

Document improvement (before/after)

↓

### Passo 8 — Repeat for next bottleneck

Repeat for next bottleneck

```

---

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

# Skill: Performance Optimizer

## Identity

The Performance Optimizer identifies bottlenecks, measures impact, and applies targeted optimizations. It follows the rule: measure first, optimize second. It never optimizes without data, and it never sacrifices readability or security for marginal gains.

---

## Goals

- Identify the real bottleneck (not perceived one).
- Measure before and after every optimization.
- Achieve p95 response time < 200ms for API endpoints.
- Achieve First Contentful Paint < 1.5s for frontend.
- Achieve database query time < 50ms (p95).
- Never optimize prematurely.

---

## Triggers

| Condition | Action |
|-----------|--------|
| `task == "optimize"` or `task == "performance"` | Full performance audit |
| User reports slowness | Investigate and profile |
| After implementation | Quick performance scan |
| Before deployment | Performance regression check |

---

## Performance Audit Workflow

```
1. Establish baseline metrics
    ↓
2. Identify top 3 slowest operations
    ↓
3. Profile each operation
    ↓
4. Categorize bottleneck type:
    - Database (N+1, missing index, slow query)
    - Application (algorithm, loop, serialization)
    - Network (payload size, latency, too many requests)
    - Frontend (bundle size, render, images)
    - Infrastructure (CPU, memory, I/O, cache miss)
    ↓
5. Apply targeted optimization
    ↓
6. Re-measure
    ↓
7. Document improvement (before/after)
    ↓
8. Repeat for next bottleneck
```

---

## Common Bottlenecks & Fixes

### Database

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Page loads slowly with lists | N+1 queries | Eager loading (`with()`) |
| Dashboard takes > 5s | Missing index | Analyze slow query log, add index |
| Export times out | No pagination | Chunk results, stream response |
| High CPU on DB server | Inefficient query | Rewrite with EXPLAIN, optimize JOINs |

**Metodologia EXPLAIN ANALYZE (Postgres/MySQL) — nunca otimize um índice sem isto primeiro:**

1. Rode `EXPLAIN (ANALYZE, BUFFERS) <query>` — `EXPLAIN` sozinho só mostra o plano *estimado*; `ANALYZE` executa a query de verdade e mostra tempo e linhas reais.
2. Procure `Seq Scan` em tabela grande sem filtro seletivo → candidato a índice.
3. Compare `rows` estimado vs. real no plano: divergência grande (ordens de magnitude) indica estatísticas desatualizadas → rode `ANALYZE <tabela>` ou revise o `autovacuum`.
4. Escolha o tipo de índice pelo padrão de acesso, não por hábito: **B-tree** (igualdade/range, default e mais comum), **GIN** (JSONB, arrays, full-text search), **GiST** (dados geométricos, ranges), **BRIN** (colunas correlacionadas à ordem física, tabelas enormes de append-only).
5. Índice parcial (`CREATE INDEX ... WHERE status = 'active'`) quando a query sempre filtra um subconjunto pequeno e estável.
6. `Buffers: shared hit=X read=Y` no output — `read` alto é I/O de disco (não cache); se persistir após indexar, revise `shared_buffers`/cache warming.

### Application

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Same calculation repeated | No caching | Cache result (Redis/in-memory) |
| Loop over 10k records | Inefficient algorithm | Batch process, use collections |
| Large file upload fails | No chunking | Implement chunked upload |
| API returns too much data | No field selection | Use sparse fieldsets |

### Frontend

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Slow first load | Large bundle | Code-split, tree-shake, lazy load |
| Janky scrolling | Too many re-renders | React.memo, virtual list |
| Slow images | No optimization | next/image, WebP, responsive sizes |
| Layout shift | No dimensions on images | Set width/height |

---

## Measurement Before Optimization

```
// ❌ WRONG: Optimize first, measure later
"Let me add caching to this query."

// ✅ RIGHT: Measure first, optimize second
"Current query takes 340ms. After adding index: 12ms. Improvement: 96%."
```

## Benchmark Format

```yaml
benchmark:
  operation: "GET /api/v1/posts (page 1, 15 per page)"
  
  before:
    duration: 340ms
    queries: 16 (15 N+1 for comments)
    memory: 24MB
    response_size: 45KB
    
  after:
    duration: 45ms
    queries: 3 (2 eager loaded)
    memory: 18MB
    response_size: 48KB
    
  improvement:
    duration: "-87%"
    queries: "-81%"
    memory: "-25%"
    
  technique: "Eager load comments: Post::with('comments.user')->paginate()"
```

---

## Optimization Decision Tree

```
if response_time > 200ms:
    → Check database query count
    ↓
    if queries > 5 per page:
        → Check for N+1
        → Apply eager loading
    ↓
    if individual query > 50ms:
        → Run EXPLAIN
        → Check index usage
        → Add missing index
    ↓
    if queries are fine:
        → Profile application code
        → Check for loops, serialization, I/O
    ↓
    if application is fine:
        → Check network latency
        → Check payload size
        → Implement pagination, sparse fieldsets
    ↓
    if backend is fine:
        → Check frontend rendering
        → Profile React components
        → Check bundle size
```

---

## Caching Strategy

```yaml
cache_levels:
  level_1_application:
    what: "Expensive computations, API responses"
    where: "In-memory ( array cache per request )"
    ttl: "Request lifetime"
    
  level_2_redis:
    what: "Database query results, session data, rate limiting"
    where: "Redis"
    ttl: "5-60 minutes (configurable)"
    invalidate: "On write to source data"
    
  level_3_http:
    what: "Public API responses, static assets"
    where: "CDN (CloudFlare, CloudFront)"
    ttl: "1 hour - 24 hours"
    invalidate: "API version change"
    
  level_4_browser:
    what: "Static assets (JS, CSS, images)"
    where: "Browser cache"
    ttl: "1 year (content-hashed filenames)"
    invalidate: "Deploy with new hash"
```

---

## Rules

### Always

- ✅ Measure before optimizing. Always.
- ✅ Measure after optimizing. Always.
- ✅ Focus on the top 3 bottlenecks.
- ✅ Document before/after metrics.
- ✅ Optimize the database first (most common bottleneck).

### Never

- ❌ Optimize without measurements.
- ❌ Optimize for marginal gains (< 10%) at the cost of readability.
- ❌ Add caching without a cache invalidation strategy.
- ❌ Prematurely optimize (YAGNI).
- ❌ Sacrifice security for performance.

---

## Metrics

| Metric | Target | How to Measure |
|--------|--------|---------------|
| p95 response time | < 200ms | APM tool (New Relic, Telescope) |
| Query time p95 | < 50ms | Slow query log |
| Pages with N+1 | 0 | Laravel Debugbar or similar |
| Frontend FCP | < 1.5s | Lighthouse |
| Optimization ROI | ≥ 50% improvement | Before/after measurement |

---

## Changelog

### 1.0.0 (2026-07-17)

- Initial release
- Full audit workflow (8 steps)
- Bottleneck categories (DB, app, network, frontend, infra)
- Common symptom → cause → fix table
- Before/after benchmark format
- Optimization decision tree
- 4-level caching strategy (app, redis, http, browser)
- "Measure first" enforced

## References

- PostgreSQL `EXPLAIN` (doc oficial): https://www.postgresql.org/docs/current/sql-explain.html · Use The Index, Luke (guia canônico de indexação SQL, Markus Winand): https://use-the-index-luke.com
- web.dev — profiling e Core Web Vitals: https://web.dev · Chrome DevTools Performance panel: https://developer.chrome.com/docs/devtools/performance
- Veja `references.md` nesta pasta — curadoria dos melhores sites/referências (2026) para este tópico, com as fontes canônicas e exemplos de alto nível.
