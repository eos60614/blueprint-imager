# Implementation Plan: Procore-PostgreSQL Drawings Integration

**Branch**: `007-procore-postgres-drawings` | **Date**: 2026-01-18 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/007-procore-postgres-drawings/spec.md`

## Summary

Integrate blueprint-imager with an external PostgreSQL database (`procore_int_v2`) to browse M-series (mechanical) drawings synced from Procore, retrieve drawing files from a dedicated S3 bucket, and process them through the existing tile conversion pipeline. This is a **read-only** integration - no writes to the external database.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI, psycopg2, boto3, Next.js 14 (App Router), SWR, Tailwind CSS
**Storage**: External PostgreSQL (`procore_int_v2`), Separate S3 bucket (`PROCORE_S3_BUCKET`)
**Testing**: pytest (backend), Vitest + Playwright (frontend)
**Target Platform**: Linux server (Docker), Vercel (frontend)
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Browse 1,000 drawings in <2 seconds response time
**Constraints**: Read-only database access, max 10 drawings per batch job
**Scale/Scope**: Thousands of drawings across multiple projects

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The project constitution template has placeholder principles. Based on codebase patterns observed:

| Principle | Status | Notes |
|-----------|--------|-------|
| Library-First | N/A | Not adding new libraries - extending existing services |
| Test-First | PASS | Will add tests for new endpoints and services |
| Integration Testing | PASS | Contract tests for new PostgreSQL and S3 integrations |
| Simplicity | PASS | Reusing existing patterns (S3Client, job processing) |

**Gate Status**: PASS - No violations requiring justification

## Project Structure

### Documentation (this feature)

```text
specs/007-procore-postgres-drawings/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── procore-browse-api.yaml  # OpenAPI spec
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Web application structure (existing)
backend/
├── src/
│   ├── models/
│   │   └── procore_drawing.py    # NEW: Procore drawing models
│   ├── services/
│   │   ├── procore_db_client.py  # NEW: External PostgreSQL client
│   │   └── s3_client.py          # EXTEND: Multi-bucket support
│   ├── api/
│   │   └── procore_browse.py     # NEW: Browse/process endpoints
│   └── config.py                  # EXTEND: New env vars
└── tests/
    ├── contract/
    │   └── test_procore_browse_api.py  # NEW
    ├── integration/
    │   └── test_procore_db_client.py   # NEW
    └── unit/
        └── test_procore_drawing.py     # NEW

frontend/
├── src/
│   ├── app/
│   │   └── browse/               # NEW: Procore browse page
│   │       └── page.tsx
│   ├── components/
│   │   ├── DrawingList/          # NEW: Drawing list component
│   │   ├── DrawingFilters/       # NEW: Project/search filters
│   │   └── DrawingProcessButton/ # NEW: Batch process trigger
│   ├── hooks/
│   │   └── useDrawings.ts        # NEW: SWR hook for drawings
│   └── types/
│       └── procore.ts            # NEW: Procore-specific types
└── tests/
    └── unit/
        └── test_drawing_list.tsx # NEW
```

**Structure Decision**: Following existing web application pattern with backend/ and frontend/ separation. New procore_browse API router parallel to existing upload/convert/jobs routers. New /browse frontend page separate from upload workflow.

## Complexity Tracking

> No constitution violations requiring justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| N/A | - | - |

## Architecture Decisions

### AD-001: Separate Database Connection Pool

**Decision**: Create a dedicated `procore_db_client.py` service for the external PostgreSQL database rather than reusing `db.py`.

**Rationale**:
- External database has different credentials and connection lifecycle
- Read-only access requires different connection configuration
- Separation prevents accidental writes to external database
- Connection pooling can be tuned independently

### AD-002: S3 Multi-Bucket Support

**Decision**: Extend `S3Client` to support multiple buckets rather than creating a separate client.

**Rationale**:
- Reuses existing boto3 session management
- Single class with bucket parameter is simpler than duplicating code
- Same credential chain (AWS creds) works for both buckets

### AD-003: Reuse Existing Job Processing Pipeline

**Decision**: Create Procore-sourced jobs that feed into the existing `process_pages_job` function.

**Rationale**:
- Existing pipeline handles PDF download, conversion, tiling
- Job status tracking already implemented
- Frontend job polling already works
- Only need to adapt the file source (Procore S3 bucket vs upload S3 bucket)

### AD-004: Frontend Dedicated Browse Route

**Decision**: Create `/browse` route separate from main upload page.

**Rationale**:
- Different user workflow (browse database vs upload file)
- Avoids cluttering existing upload UI
- Clear navigation between upload and browse modes
- Matches spec requirement FR-011

## Integration Points

### External PostgreSQL Database

- **Host**: `database-3.czsyw64yw006.us-east-2.rds.amazonaws.com:5432`
- **Database**: `procore_int_v2`
- **Tables**: projects, drawings, drawing_revisions, drawing_areas, drawing_sets
- **Access**: Read-only SELECT queries

### Procore S3 Bucket

- **Bucket**: Configured via `PROCORE_S3_BUCKET` env var
- **Keys**: Referenced by `drawing_revisions.s3_key`
- **Access**: Download PDFs for processing

### Existing Internal Systems

- **Job Service**: Create jobs with `source='procore'`
- **PDF Processor**: Same 600 DPI PNG conversion
- **Image Tiler**: Same 1920x1920 tiles with 250px overlap
- **Local Tile Storage**: Same `LOCAL_TILE_STORAGE_PATH/{job_id}/tiles/`

## Environment Variables (New)

```bash
# External Procore PostgreSQL Database
PROCORE_DB_HOST=database-3.czsyw64yw006.us-east-2.rds.amazonaws.com
PROCORE_DB_PORT=5432
PROCORE_DB_NAME=procore_int_v2
PROCORE_DB_USER=readonly_user
PROCORE_DB_PASSWORD=<secret>

# Procore Drawings S3 Bucket
PROCORE_S3_BUCKET=procore-drawings-bucket
```

## API Design Overview

### Browse Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/procore/projects` | List all active projects |
| GET | `/api/procore/drawings` | List M-series drawings with filters |
| GET | `/api/procore/drawings/{id}` | Get single drawing with current revision |
| POST | `/api/procore/process` | Create job to process selected drawings |

### Query Parameters

- `project_id`: Filter by project
- `search`: Search drawing_number or title (partial match)
- `page`, `limit`: Pagination (default limit=50, max=100)

See `contracts/procore-browse-api.yaml` for full OpenAPI specification.

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| External DB unavailable | Low | High | Connection retry with exponential backoff, clear error messages |
| S3 access denied for files | Low | Medium | Validate s3_key exists before job creation, handle missing files gracefully |
| Large query performance | Medium | Medium | Add indexes, pagination, limit result sets |
| Stale revision data | Low | Low | Always filter `current=true`, trust sync process |
