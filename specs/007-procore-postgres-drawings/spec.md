# Feature Specification: Procore-PostgreSQL Drawings Integration

**Feature Branch**: `007-procore-postgres-drawings`
**Created**: 2026-01-18
**Status**: Draft
**Input**: User description: "integrate procore, data on postgres db. you will read db, get drawings."

## Database Schema (Discovered)

The Procore integration database (`procore_int_v2`) already contains a complete drawing management schema with the following key tables and relationships:

### Entity Relationship Diagram

```
projects (1) ──────────────────┬───────────────────────────────────────┐
     │                         │                                       │
     │                         │                                       │
     ▼                         ▼                                       ▼
drawing_areas (N)         drawing_sets (N)                    drawings (N)
     │                         │                                  │
     │                         │                                  │
     └─────────────────────────┼──────────────────────────────────┤
                               │                                  │
                               ▼                                  │
                        drawing_revisions (N) ◄───────────────────┘
```

### Table Definitions

**projects**
- `id` (bigint, PK): Procore project ID
- `name`, `display_name`, `project_number`: Project identification
- `address`, `city`, `state_code`, `country_code`, `zip`: Location
- `active` (boolean): Whether project is active
- `estimated_start_date`, `estimated_completion_date`: Project timeline
- `created_at`, `updated_at`, `last_synced_at`: Timestamps

**drawings**
- `id` (bigint, PK): Procore drawing ID
- `project_id` (bigint, FK → projects): Parent project
- `drawing_area_id` (bigint, FK → drawing_areas): Drawing area/discipline category
- `drawing_number` (text): Unique number within project (e.g., "M-101")
- `title` (text): Drawing title
- `discipline` (text): Discipline code (e.g., "M" for mechanical, "E" for electrical)
- Unique constraint: `(project_id, drawing_number)`
- Indexed by: `discipline`, `drawing_area_id`, `project_id`, `last_synced_at`

**drawing_revisions**
- `id` (bigint, PK): Procore revision ID
- `project_id` (bigint, FK → projects): Parent project
- `drawing_id` (bigint, FK → drawings): Parent drawing
- `drawing_area_id` (bigint, FK → drawing_areas): Drawing area
- `drawing_set_id` (bigint, FK → drawing_sets, nullable): Associated drawing set
- `revision_number` (text): Revision identifier (e.g., "A", "1", "Rev2")
- `current` (boolean): Whether this is the current/latest revision
- `s3_key` (text, nullable): S3 storage key for the file
- `filename` (text, nullable): Original filename
- `file_size` (integer, nullable): File size in bytes
- Indexed by: `current`, `drawing_id`, `drawing_set_id`, `s3_key`

**drawing_areas**
- `id` (bigint, PK): Procore drawing area ID
- `project_id` (bigint, FK → projects): Parent project
- `name` (text): Area name (e.g., "Mechanical", "Electrical", "Architectural")

**drawing_sets**
- `id` (bigint, PK): Procore drawing set ID
- `project_id` (bigint, FK → projects): Parent project
- `name` (text): Set name (e.g., "IFC Set", "Bid Set")
- `set_date` (date, nullable): Date of the drawing set

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Browse M-Series Drawings from Database (Priority: P1)

A user wants to view and select mechanical (M-series) drawings from the PostgreSQL database that have already been synced from Procore, so they can process them for YOLO training without needing live Procore API access.

**Why this priority**: This is the core capability - enabling users to work with drawings that already exist in the database. The data is already synced; we just need to provide access to it.

**Independent Test**: Can be fully tested by querying drawings where `discipline = 'M'` and displaying them in a list with project context.

**Acceptance Scenarios**:

1. **Given** drawings exist in the database with `discipline = 'M'`, **When** a user requests to view M-series drawings, **Then** all mechanical drawings are listed with their drawing number, title, and parent project name.

2. **Given** drawings exist across multiple projects, **When** a user filters by a specific project, **Then** only drawings from that project are returned.

3. **Given** a drawing has multiple revisions, **When** the user views the drawing, **Then** only the current revision (where `current = true`) is shown by default.

---

### User Story 2 - Download Drawing Files for Processing (Priority: P2)

A user wants to retrieve the actual drawing PDF files stored in S3 (referenced by `s3_key` in `drawing_revisions`) so they can be processed through the existing PDF-to-tile conversion pipeline.

**Why this priority**: Once users can browse drawings, they need the actual files to process. The files are already stored in S3; we need to provide the download capability.

**Independent Test**: Can be tested by selecting a drawing revision with a valid `s3_key` and successfully downloading the file.

**Acceptance Scenarios**:

1. **Given** a drawing revision has an `s3_key` value, **When** a user requests to download that revision, **Then** the PDF file is retrieved from S3 and made available for processing.

2. **Given** a drawing revision has no `s3_key` (file not yet synced), **When** a user tries to download, **Then** the system displays a clear message that the file is not available.

3. **Given** a user selects multiple drawings for batch download, **When** they initiate download, **Then** all available files are queued for processing.

---

### User Story 3 - Process Drawings Through Tile Pipeline (Priority: P3)

A user wants to send selected drawings from the database directly to the existing conversion pipeline (600 DPI, 1920x1920 tiles) to generate training images.

**Why this priority**: This connects the database browsing feature to the existing core functionality. Once users can browse and access files, processing completes the workflow.

**Independent Test**: Can be tested by selecting a drawing from the database browse interface and initiating conversion, verifying tiles are generated.

**Acceptance Scenarios**:

1. **Given** a user has selected one or more drawings from the database, **When** they initiate processing, **Then** a job is created that downloads files from S3 and processes them through the tile pipeline.

2. **Given** processing is initiated, **When** the job runs, **Then** the user can track progress using the existing job status interface.

3. **Given** processing completes, **When** the user views results, **Then** they can download the generated tiles as a ZIP file.

---

### Edge Cases

- What happens when the database connection fails? System should display a clear connection error and suggest checking database credentials.
- How does the system handle drawings without files (null s3_key)? These should be visually marked as "File not available" in the browse interface.
- What happens if S3 access is denied? System should log the error and inform the user that the file could not be retrieved.
- How does the system handle very large drawing files? The existing file size limits should apply; drawings with `file_size` exceeding limits should show a warning.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST connect to the external PostgreSQL database (`procore_int_v2`) using provided credentials.
- **FR-002**: System MUST query the `drawings` table filtered by `discipline` column to retrieve M-series drawings (where `discipline = 'M'`).
- **FR-003**: System MUST join `drawings` with `projects` to display project context (name, project_number) for each drawing.
- **FR-004**: System MUST join `drawings` with `drawing_revisions` to identify current revisions (where `current = true`).
- **FR-005**: System MUST retrieve S3 keys from `drawing_revisions.s3_key` for file download.
- **FR-006**: System MUST allow filtering drawings by `project_id`.
- **FR-007**: System MUST allow searching drawings by `drawing_number` or `title` (partial match).
- **FR-008**: System MUST display `drawing_areas.name` to show the discipline/area categorization.
- **FR-009**: System MUST integrate with the existing conversion pipeline for processing retrieved files.
- **FR-010**: System MUST use the existing S3 client to download files referenced by `s3_key`.
- **FR-011**: System MUST provide a new dedicated frontend page/route (e.g., `/browse` or `/procore`) for database browsing, separate from the existing upload workflow.
- **FR-012**: System MUST limit batch processing to a maximum of 10 drawings per job to ensure predictable resource usage and processing times.

### Key Entities

- **Drawing**: A single drawing document within a project. Key attributes: `id`, `drawing_number`, `title`, `discipline`. Belongs to a Project and Drawing Area. Has many Revisions.
- **Drawing Revision**: A specific version of a drawing. Key attributes: `id`, `revision_number`, `current`, `s3_key`, `filename`, `file_size`. The `current = true` flag identifies the latest revision.
- **Drawing Area**: A categorization/grouping of drawings within a project (e.g., "Mechanical", "Electrical"). Key attributes: `id`, `name`.
- **Drawing Set**: A collection of drawing revisions released together (e.g., "IFC Set"). Key attributes: `id`, `name`, `set_date`.
- **Project**: The parent container for all drawings. Key attributes: `id`, `name`, `display_name`, `project_number`, `active`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can browse and filter M-series drawings from the database within 2 seconds response time for up to 1,000 drawings.
- **SC-002**: Users can successfully download drawing files from S3 for at least 95% of drawings that have valid `s3_key` values.
- **SC-003**: Users can process drawings from the database browse interface with the same tile generation quality as manual PDF uploads.
- **SC-004**: System correctly displays current revision for 100% of drawings (no stale revisions shown by default).
- **SC-005**: Users can filter by project and discipline to narrow down drawing selection to relevant items.

## Out of Scope

- **Database writes**: No INSERT, UPDATE, or DELETE operations on the PostgreSQL database. This feature is read-only.
- **Procore API sync**: No direct communication with Procore API; data comes exclusively from the pre-synced database.
- **Processing status tracking in database**: Processed drawings are not marked or tracked in the external database.
- **Non-M-series drawings**: Initial implementation focuses on M-series (mechanical) drawings only.

## Clarifications

### Session 2026-01-18
- Q: How should PostgreSQL database credentials be managed? → A: Environment variables via `.env` file (matches existing AWS credential pattern)
- Q: Where should database browsing functionality live in the UI? → A: New dedicated page/route (e.g., `/browse` or `/procore`)
- Q: What is the maximum number of drawings per batch processing operation? → A: 10 drawings maximum per batch
- Q: What database access level is in scope? → A: Read-only access; no write-back or sync capabilities
- Q: Which S3 bucket contains the Procore drawing files? → A: Separate bucket configured via new `PROCORE_S3_BUCKET` env var

## Assumptions

- PostgreSQL database credentials MUST be configured via environment variables in the `.env` file, following the same pattern as existing AWS credentials.
- The external PostgreSQL database is maintained by an existing Procore integration system and data is already being synced.
- The S3 bucket containing drawing files is accessible using the existing AWS credentials configured for this application.
- The `discipline` field values follow standard drawing discipline codes (M=Mechanical, E=Electrical, A=Architectural, etc.).
- The read-only database user has SELECT permissions on the required tables (projects, drawings, drawing_revisions, drawing_areas, drawing_sets).
- The existing PDF processing pipeline (pdf2image, Pillow tiling) works with the drawing PDFs stored in S3.

## Dependencies

- External PostgreSQL database at `database-3.czsyw64yw006.us-east-2.rds.amazonaws.com:5432/procore_int_v2`
- Separate AWS S3 bucket for Procore drawing files, configured via `PROCORE_S3_BUCKET` environment variable (referenced by `s3_key` in drawing_revisions)
- Existing PDF conversion pipeline (src/services/pdf_processor.py, image_tiler.py)
- Existing S3 client (src/services/s3_client.py) - may require modification to support multiple buckets
