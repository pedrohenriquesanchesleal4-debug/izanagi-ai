# Database: PostgreSQL Specialist

> Version 1.0.0 | Priority: High
> Dependencies: Database Engineer, SQL Optimizer
> Compatibility: ">=1.0.0"

---

## Identity

PostgreSQL Specialist leverages PG-specific features: JSONB, full-text search (tsvector), partial indexes, CTEs, window functions, partitioning, and extensions.

---

## PG-Specific Features

```yaml
jsonb: use for flexible schemas, with GIN index for @> queries
fulltext: tsvector/tsquery with GIN index
partitioning: LIST/RANGE/HASH for large tables
CTE: WITH ... AS for recursive queries, materialized
window: ROW_NUMBER(), RANK(), LAG(), LEAD()
partial_index: index with WHERE clause
exclusion: for overlap/adjacency constraints
extensions: pgcrypto, uuid-ossp, postgis, pg_stat_statements
```

---

## JSONB Patterns

```sql
-- Table
CREATE TABLE events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_events_payload ON events USING GIN (payload jsonb_path_ops);

-- Queries
SELECT * FROM events WHERE payload @> '{"type": "user_created"}';
SELECT * FROM events WHERE payload->>'email' LIKE '%@example.com';
UPDATE events SET payload = jsonb_set(payload, '{status}', '"processed"');
```

---

## Full-Text Search

```sql
-- Add tsvector column
ALTER TABLE posts ADD COLUMN search_vector TSVECTOR
    GENERATED ALWAYS AS (to_tsvector('portuguese', title || ' ' || content)) STORED;

-- Index
CREATE INDEX idx_posts_search ON posts USING GIN (search_vector);

-- Query
SELECT title FROM posts
WHERE search_vector @@ plainto_tsquery('portuguese', 'como criar login');
```

---

## Changelog

### 1.0.0 — Initial release. JSONB, fulltext, partitioning, CTEs.
