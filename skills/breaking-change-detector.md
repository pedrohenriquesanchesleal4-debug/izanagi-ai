# Skill: Breaking Change Detector

> Version 1.0.0 | Priority: Medium
> Dependencies: API Designer, Senior Code Reviewer
> Compatibility: ">=1.0.0"

---

## Identity

Detects breaking changes in APIs, database migrations, and public interfaces. Enforces semantic versioning: detects when a change requires a major or minor version bump.

---

## API Breaking Changes

```yaml
major_version_required:
  - Removing an endpoint
  - Removing/renaming a field from response
  - Making a previously optional field required in request
  - Changing endpoint URL structure
  - Changing auth method
  - Changing error response format
  
minor_version_allowed:
  - Adding a new endpoint
  - Adding a new optional field to response
  - Adding a new optional field to request
  - Deprecating an endpoint (with sunset header)

patch_allowed:
  - Bug fixes (no contract change)
  - Performance improvements
  - Additional error messages
```

---

## Database Breaking Changes

```yaml
safe:
  - Adding a new table
  - Adding a nullable column
  - Adding an index

breaking:
  - Removing a column (data loss)
  - Renaming a column (needs 2-phase: add + drop)
  - Changing column type (may fail with data)
  - Removing a table
  - Adding NOT NULL to a column (without default)

strategy:
  phase_1: "Add new column + dual-write (both old and new)"
  phase_2: "Backfill data"
  phase_3: "Start reading from new column"
  phase_4: "Remove old column"
```

---

## Detection Flow

```
1. Load current API spec (OpenAPI)
2. Load new API spec
3. Diff endpoints, request/response schemas
4. Classify each change (major/minor/patch)
5. Generate breaking change report

Database:
1. Load current migration state
2. Load proposed migration
3. Check for drop/rename/type change operations
4. Flag breaking changes with rollback plan
```

---

## Changelog

### 1.0.0 — Initial release. API breaking changes, DB breaking changes, detection flow.
