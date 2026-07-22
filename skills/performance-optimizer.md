# Skill: Performance Optimizer

> Version 1.0.0
> Priority: High
> Dependencies: Complexity Analyzer, Database Engineer
> Compatibility: ">=1.0.0"

---

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
