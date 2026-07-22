# Database: MySQL Specialist

> Version 1.0.0 | Priority: Medium
> Dependencies: Database Engineer, SQL Optimizer
> Compatibility: ">=1.0.0"

---

## Identity

MySQL Specialist optimizes for MySQL 8+ specific features: InnoDB, full-text indexes, window functions, CTEs, JSON, and EXPLAIN FORMAT=JSON.

---

## MySQL-Specific Features

```yaml
engine: InnoDB only (never MyISAM)
charset: utf8mb4 (full Unicode, including emoji)
collation: utf8mb4_unicode_ci
json: native JSON type with virtual columns
fulltext: FULLTEXT index on CHAR/VARCHAR/TEXT
window: ROW_NUMBER(), RANK() (MySQL 8+)
CTE: WITH ... AS (MySQL 8+)
spatial: SPATIAL index for geometry
```

---

## EXPLAIN Analysis

```sql
EXPLAIN FORMAT=JSON
SELECT * FROM posts WHERE status = 'published'\G

-- Look for:
-- type: ALL (full scan) → needs index
-- type: index (full index scan) → better, but still slow
-- type: ref/range → good, index used
-- type: const → best (PK/UNIQUE lookup)
-- Extra: Using filesort → needs index on ORDER BY
-- Extra: Using temporary → needs index on GROUP BY
```

---

## InnoDB Tuning

```ini
innodb_buffer_pool_size = 70% of RAM
innodb_log_file_size = 1GB
innodb_flush_log_at_trx_commit = 2 (balance)
innodb_file_per_table = 1
innodb_autoinc_lock_mode = 2
```

---

## Changelog

### 1.0.0 — Initial release. InnoDB, EXPLAIN FORMAT=JSON, tuning.
