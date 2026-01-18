# Research: Procore-PostgreSQL Drawings Integration

**Feature Branch**: `007-procore-postgres-drawings`
**Date**: 2026-01-18

## Research Summary

This document captures research findings for integrating blueprint-imager with the external Procore PostgreSQL database for browsing and processing M-series drawings.

---

## 1. PostgreSQL Multi-Database Connection Pattern

### Decision: Separate Connection Pool for External Database

### Rationale
The application already uses PostgreSQL (via psycopg2) for its internal database. Adding a second database connection requires isolation to:
- Prevent credential mixing
- Enable independent connection pool tuning
- Enforce read-only access on external database
- Allow different timeout/retry configurations

### Implementation Pattern

```python
# procore_db_client.py
import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from src.config import Config

class ProcoreDBClient:
    _pool = None

    @classmethod
    def get_pool(cls):
        if cls._pool is None:
            config = Config()
            cls._pool = pool.ThreadedConnectionPool(
                minconn=1,
                maxconn=10,
                host=config.PROCORE_DB_HOST,
                port=config.PROCORE_DB_PORT,
                database=config.PROCORE_DB_NAME,
                user=config.PROCORE_DB_USER,
                password=config.PROCORE_DB_PASSWORD,
                options='-c default_transaction_read_only=on'  # Enforce read-only
            )
        return cls._pool

    @classmethod
    @contextmanager
    def get_cursor(cls, dict_cursor=True):
        pool = cls.get_pool()
        conn = pool.getconn()
        try:
            cursor_factory = RealDictCursor if dict_cursor else None
            with conn.cursor(cursor_factory=cursor_factory) as cursor:
                yield cursor
        finally:
            pool.putconn(conn)
```

### Alternatives Considered
1. **SQLAlchemy with multiple engines**: Adds ORM overhead not needed for read-only queries
2. **Reuse existing db.py with flag**: Risk of accidental writes, credential confusion
3. **Async with asyncpg**: Would require refactoring existing sync code

### Best Practice References
- PostgreSQL connection pooling: Use `ThreadedConnectionPool` for web applications
- Read-only enforcement: Set `default_transaction_read_only=on` at connection level
- Context managers: Follow existing `db.py` pattern for resource cleanup

---

## 2. S3 Multi-Bucket Access Pattern

### Decision: Extend Existing S3Client with Bucket Parameter

### Rationale
The existing `S3Client` class already supports passing a bucket name. The same AWS credentials work for both buckets. No new client needed - just pass the `PROCORE_S3_BUCKET` when downloading drawing files.

### Implementation Pattern

```python
# Existing S3Client already supports this:
procore_s3 = S3Client(bucket_name=Config().PROCORE_S3_BUCKET)
file_bytes = procore_s3.download_bytes(s3_key)
```

### Verification
Reviewed `src/services/s3_client.py`:
- Constructor accepts `bucket_name` parameter
- Falls back to `Config().S3_BUCKET_NAME` if not provided
- All methods use `self.bucket_name` consistently

### Alternatives Considered
1. **Separate ProcoreS3Client class**: Unnecessary duplication
2. **Environment variable switching**: Confusing, error-prone
3. **Subclassing S3Client**: Over-engineering for simple bucket change

---

## 3. Database Query Optimization

### Decision: Indexed Queries with Pagination

### Rationale
The spec requires <2 second response for 1,000 drawings. The external database already has indexes on key columns (confirmed in spec):
- `drawings.discipline`
- `drawings.project_id`
- `drawing_revisions.current`
- `drawing_revisions.drawing_id`

### Query Patterns

**List M-Series Drawings with Project Filter**:
```sql
SELECT
    d.id, d.drawing_number, d.title, d.discipline,
    p.id as project_id, p.name as project_name, p.project_number,
    da.name as drawing_area_name,
    dr.id as revision_id, dr.revision_number, dr.s3_key, dr.filename, dr.file_size
FROM drawings d
JOIN projects p ON d.project_id = p.id
LEFT JOIN drawing_areas da ON d.drawing_area_id = da.id
LEFT JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.current = true
WHERE d.discipline = 'M'
  AND ($1::bigint IS NULL OR d.project_id = $1)
  AND ($2::text IS NULL OR d.drawing_number ILIKE $2 OR d.title ILIKE $2)
ORDER BY p.name, d.drawing_number
LIMIT $3 OFFSET $4;
```

**Performance Notes**:
- `discipline = 'M'` uses index on `drawings.discipline`
- `current = true` uses index on `drawing_revisions.current`
- `project_id` filter uses index on `drawings.project_id`
- ILIKE search may require full scan; acceptable for filtered result sets
- Pagination with LIMIT/OFFSET suitable for <10K total drawings

### Alternatives Considered
1. **Cursor-based pagination**: Better for large datasets, but OFFSET sufficient here
2. **Full-text search**: Overkill for drawing_number/title partial match
3. **Materialized view**: Adds sync complexity, not needed for read-only

---

## 4. Job Processing Integration

### Decision: Reuse Existing Job Pipeline with Source='procore'

### Rationale
The existing `jobs` table already supports multiple sources via the `source` column. The `process_pages_job` function handles PDF download and tiling. We can create jobs that reference Procore drawings instead of uploads.

### Schema Adaptation

**New job fields needed** (or reuse existing):
- `source = 'procore'` (existing column)
- Store drawing IDs in a new association or JSON field

**Option A: JSON array in jobs table**
```python
# Add to jobs table
procore_drawing_ids: Optional[List[int]]  # JSON serialized
```

**Option B: New job_drawings junction table**
```sql
CREATE TABLE job_drawings (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES jobs(id),
    drawing_id BIGINT,  -- External Procore drawing ID
    s3_key TEXT,        -- Cached S3 key
    status TEXT DEFAULT 'pending',
    error_message TEXT
);
```

### Decision: Use JSON array (Option A)
- Simpler implementation
- Consistent with existing `selected_pages` JSON pattern
- Batch limit (10 drawings) keeps array small

### Processing Flow
1. Create job with `source='procore'`, `procore_drawing_ids=[...]`
2. Background task iterates drawing IDs
3. For each drawing:
   - Lookup s3_key from external DB
   - Download PDF from Procore S3 bucket
   - Process through existing tile pipeline
4. Update job status as drawings complete

---

## 5. Error Handling Patterns

### Decision: Graceful Degradation with Clear Error Messages

### Connection Errors
```python
try:
    with ProcoreDBClient.get_cursor() as cursor:
        cursor.execute(query, params)
except psycopg2.OperationalError as e:
    raise HTTPException(
        status_code=503,
        detail="Unable to connect to Procore database. Please try again later."
    )
```

### Missing S3 Files
```python
# Before processing, validate all s3_keys exist
for drawing in drawings:
    if not drawing.s3_key:
        raise HTTPException(
            status_code=400,
            detail=f"Drawing {drawing.drawing_number} does not have a file available"
        )
```

### Partial Batch Failures
- Continue processing remaining drawings if one fails
- Track per-drawing status in job metadata
- Report summary: "8 of 10 drawings processed successfully"

---

## 6. Frontend Integration Pattern

### Decision: New `/browse` Route with SWR Data Fetching

### Component Structure
```
/browse
├── page.tsx              # Main browse page
├── ProjectFilter.tsx     # Dropdown for project selection
├── DrawingSearch.tsx     # Search input for drawing_number/title
├── DrawingList.tsx       # Paginated list of drawings
├── DrawingCard.tsx       # Individual drawing display
└── ProcessButton.tsx     # Batch process selected drawings
```

### SWR Pattern (following existing useJobStatus)
```typescript
// useDrawings.ts
import useSWR from 'swr';

interface UseDrawingsParams {
  projectId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

export function useDrawings({ projectId, search, page = 1, limit = 50 }: UseDrawingsParams) {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId.toString());
  if (search) params.set('search', search);
  params.set('page', page.toString());
  params.set('limit', limit.toString());

  return useSWR(`/api/procore/drawings?${params.toString()}`);
}
```

### State Management
- Selection state: React useState for selected drawing IDs
- No new context needed (unlike upload workflow)
- Simple prop drilling sufficient for contained feature

---

## 7. Security Considerations

### Read-Only Database Access
- Connection string includes `default_transaction_read_only=on`
- No INSERT/UPDATE/DELETE statements in codebase
- Use parameterized queries (prevent SQL injection)

### S3 Access
- Same AWS credentials as main bucket
- IAM policy should allow GetObject on Procore bucket
- No ListBucket needed (we have explicit s3_keys)

### Input Validation
- Project ID: Validate as positive integer
- Search: Limit length, escape LIKE wildcards
- Drawing IDs: Validate against database before processing

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| DB Connection | Separate ProcoreDBClient | Isolation, read-only enforcement |
| S3 Access | Extend existing S3Client | No duplication, same credentials |
| Queries | Indexed + paginated | Performance for 1,000+ drawings |
| Job Integration | JSON array for drawing IDs | Matches existing patterns |
| Error Handling | Graceful degradation | Clear messages, partial batch success |
| Frontend | New /browse route + SWR | Isolated feature, consistent patterns |
| Security | Read-only + parameterized | Prevent writes and injection |
