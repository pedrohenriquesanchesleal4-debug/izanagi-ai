# Database: SQL Server Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Database Engineer, SQL Optimizer
> Compatibility: ">=1.0.0"

---

## Identity

SQL Server Specialist leverages MSSQL-specific features: T-SQL, indexed views, query hints, CTEs, window functions, execution plans, and tempdb optimization.

---

## MSSQL-Specific Features

```yaml
indexes: clustered + nonclustered, filtered, columnstore (analytics)
views: indexed (materialized) views for aggregates
CTE: recursive CTEs for hierarchies
window: OVER(PARTITION BY ... ORDER BY ...)
temp: table variables vs #temp tables (performance matters)
hints: WITH (NOLOCK) for read-only (careful with dirty reads)
execution: SET SHOWPLAN_XML ON for detailed plans
```

---

## Execution Plan Analysis

```sql
SET STATISTICS IO ON;
SET STATISTICS TIME ON;

SELECT * FROM posts WHERE status = 'published';

-- Look for:
-- Table Scan → missing index
-- Index Scan → better, full index read
-- Index Seek → best, targeted index lookup
-- Key Lookup → consider INCLUDE columns in index
-- RID Lookup → heap table, consider clustered index
-- Sort → consider index on ORDER BY
-- Spool → tempdb usage, consider index
```

---

## T-SQL Patterns

```sql
-- Pagination (offset/fetch)
SELECT * FROM posts
ORDER BY created_at DESC
OFFSET 0 ROWS FETCH NEXT 15 ROWS ONLY;

-- Merge (upsert)
MERGE users AS target
USING (SELECT @id AS id, @email AS email) AS source
ON target.id = source.id
WHEN MATCHED THEN UPDATE SET email = source.email
WHEN NOT MATCHED THEN INSERT (id, email) VALUES (source.id, source.email);
```

---

## Changelog

### 1.0.0 — Initial release. T-SQL, execution plans, indexed views.
