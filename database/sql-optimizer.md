# Database: SQL Optimizer

> Version 1.0.0 | Priority: High
> Dependencies: Database Engineer
> Compatibility: ">=1.0.0"

---

## Identity

SQL Optimizer analyzes and rewrites slow queries. It uses `EXPLAIN ANALYZE`, index recommendations, query restructuring, and schema denormalization to achieve p95 query time under 50ms.

---

## Goals

- Identify slow queries via EXPLAIN ANALYZE.
- Reduce query time by 80%+ on identified bottlenecks.
- Eliminate full table scans, nested loops, and temp files.
- Recommend indexes that match query patterns.
- Restructure queries to use sargable predicates.

---

## Bottleneck Detection

```sql
EXPLAIN ANALYZE
SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC;

-- Look for:
-- Seq Scan (full table scan) → needs index
-- Sort (disk) → needs index on order column
-- Nested Loop (many rows) → needs index on join
-- Rows Removed by Filter → high → needs index
```

---

## Index Rules

```yaml
B-tree: default, equality + range, ORDER BY
Hash: equality only (no range, no sort)
GIN: JSONB, full-text search, arrays
GiST: geometric, full-text, range types
BRIN: large tables with naturally ordered data

composite:
  - columns: [status, published_at]
    query: "WHERE status = ? ORDER BY published_at"
    order: most selective first

partial:
  - columns: [published_at]
    where: "WHERE status = 'published'"
    query: "dashboard listing"
```

---

## Sargable Predicates

```sql
-- NON-sargable (cannot use index)
WHERE YEAR(created_at) = 2024
WHERE LOWER(email) = 'user@test.com'
WHERE CONCAT(first, ' ', last) = 'John Doe'

-- Sargable (can use index)
WHERE created_at >= '2024-01-01' AND created_at < '2025-01-01'
WHERE email = 'user@test.com'
WHERE first = 'John' AND last = 'Doe'
```

---

## Common Rewrites

```sql
-- ❌ Slow
SELECT * FROM posts p
WHERE (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) > 5;

-- ✅ Fast
SELECT p.* FROM posts p
INNER JOIN comments c ON c.post_id = p.id
GROUP BY p.id HAVING COUNT(c.id) > 5;
```

---

## Changelog

### 1.0.0 — Initial release. EXPLAIN, indexes, sargable, rewrites.
