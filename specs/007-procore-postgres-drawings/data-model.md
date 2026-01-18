# Data Model: Procore-PostgreSQL Drawings Integration

**Feature Branch**: `007-procore-postgres-drawings`
**Date**: 2026-01-18

## Overview

This document describes the data models for integrating with the external Procore PostgreSQL database. The external database schema is **read-only** - this feature queries existing tables but does not modify them. Internal extensions to the local database are documented for job tracking.

---

## External Database Schema (Read-Only)

The external PostgreSQL database (`procore_int_v2`) contains the following tables that this feature queries.

### Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────┐       ┌──────────────────┐
│   projects   │       │ drawing_sets │       │  drawing_areas   │
│              │       │              │       │                  │
│ id (PK)      │       │ id (PK)      │       │ id (PK)          │
│ name         │       │ project_id   │───────│ project_id (FK)  │
│ display_name │       │ name         │       │ name             │
│ project_no   │       │ set_date     │       └────────┬─────────┘
│ active       │       └──────┬───────┘                │
└──────┬───────┘              │                        │
       │                      │                        │
       │                      │                        │
       ▼                      │                        ▼
┌──────────────────────────────────────────────────────────────────┐
│                           drawings                                │
│                                                                   │
│ id (PK)           │ project_id (FK) ───────────────────────────► │
│ drawing_number    │ drawing_area_id (FK) ──────────────────────► │
│ title             │ discipline                                    │
│ created_at        │ updated_at                                    │
└─────────────────────────────────────────────────────────┬────────┘
                                                          │
                                                          │
                                                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                       drawing_revisions                           │
│                                                                   │
│ id (PK)            │ drawing_id (FK) ────────────────────────────│
│ project_id (FK)    │ drawing_area_id (FK)                        │
│ drawing_set_id     │ revision_number                             │
│ current (bool)     │ s3_key                                       │
│ filename           │ file_size                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Table: projects

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY | Procore project ID |
| name | TEXT | NOT NULL | Project name |
| display_name | TEXT | | Display name |
| project_number | TEXT | | Project number |
| address | TEXT | | Street address |
| city | TEXT | | City |
| state_code | TEXT | | State/province code |
| country_code | TEXT | | Country code |
| zip | TEXT | | Postal code |
| active | BOOLEAN | DEFAULT true | Whether project is active |
| estimated_start_date | DATE | | Project start date |
| estimated_completion_date | DATE | | Project end date |
| created_at | TIMESTAMP | | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |
| last_synced_at | TIMESTAMP | | Last Procore sync |

**Indexes**:
- `projects_pkey` on `id`
- `projects_active_idx` on `active`

### Table: drawings

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY | Procore drawing ID |
| project_id | BIGINT | FK → projects, NOT NULL | Parent project |
| drawing_area_id | BIGINT | FK → drawing_areas | Drawing area/discipline |
| drawing_number | TEXT | NOT NULL | Drawing number (e.g., "M-101") |
| title | TEXT | | Drawing title |
| discipline | TEXT | | Discipline code (M, E, A, etc.) |
| created_at | TIMESTAMP | | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |
| last_synced_at | TIMESTAMP | | Last Procore sync |

**Indexes**:
- `drawings_pkey` on `id`
- `drawings_project_id_idx` on `project_id`
- `drawings_discipline_idx` on `discipline`
- `drawings_drawing_area_id_idx` on `drawing_area_id`
- `drawings_project_number_unique` on `(project_id, drawing_number)` UNIQUE

### Table: drawing_revisions

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY | Procore revision ID |
| project_id | BIGINT | FK → projects, NOT NULL | Parent project |
| drawing_id | BIGINT | FK → drawings, NOT NULL | Parent drawing |
| drawing_area_id | BIGINT | FK → drawing_areas | Drawing area |
| drawing_set_id | BIGINT | FK → drawing_sets | Associated set |
| revision_number | TEXT | | Revision identifier (A, 1, Rev2) |
| current | BOOLEAN | DEFAULT false | Is current/latest revision |
| s3_key | TEXT | | S3 storage key for file |
| filename | TEXT | | Original filename |
| file_size | INTEGER | | File size in bytes |
| created_at | TIMESTAMP | | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |
| last_synced_at | TIMESTAMP | | Last Procore sync |

**Indexes**:
- `drawing_revisions_pkey` on `id`
- `drawing_revisions_drawing_id_idx` on `drawing_id`
- `drawing_revisions_current_idx` on `current`
- `drawing_revisions_s3_key_idx` on `s3_key`
- `drawing_revisions_drawing_set_id_idx` on `drawing_set_id`

### Table: drawing_areas

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY | Procore drawing area ID |
| project_id | BIGINT | FK → projects, NOT NULL | Parent project |
| name | TEXT | NOT NULL | Area name (Mechanical, Electrical) |
| created_at | TIMESTAMP | | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |

### Table: drawing_sets

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | BIGINT | PRIMARY KEY | Procore drawing set ID |
| project_id | BIGINT | FK → projects, NOT NULL | Parent project |
| name | TEXT | NOT NULL | Set name (IFC Set, Bid Set) |
| set_date | DATE | | Date of the drawing set |
| created_at | TIMESTAMP | | Creation timestamp |
| updated_at | TIMESTAMP | | Last update timestamp |

---

## Internal Database Extensions

The local application database (`mechdrawings`) requires these extensions to support Procore drawing processing.

### Modified Table: jobs

New columns to support Procore-sourced jobs:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| procore_drawing_ids | JSONB | NULL | Array of drawing IDs from external DB |
| procore_s3_keys | JSONB | NULL | Array of S3 keys for drawings |

**Migration**:
```sql
ALTER TABLE jobs
ADD COLUMN procore_drawing_ids JSONB,
ADD COLUMN procore_s3_keys JSONB;
```

**Usage**:
- `source = 'procore'` indicates a Procore-sourced job
- `procore_drawing_ids` stores the external drawing IDs
- `procore_s3_keys` caches S3 keys at job creation time

---

## Python Data Models

### ProcoreProject

```python
from dataclasses import dataclass
from typing import Optional
from datetime import date, datetime

@dataclass
class ProcoreProject:
    """Read-only model for Procore project from external database."""
    id: int
    name: str
    display_name: Optional[str] = None
    project_number: Optional[str] = None
    active: bool = True
    city: Optional[str] = None
    state_code: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'ProcoreProject':
        return cls(
            id=row['id'],
            name=row['name'],
            display_name=row.get('display_name'),
            project_number=row.get('project_number'),
            active=row.get('active', True),
            city=row.get('city'),
            state_code=row.get('state_code'),
        )
```

### ProcoreDrawing

```python
@dataclass
class ProcoreDrawing:
    """Read-only model for Procore drawing with current revision."""
    id: int
    project_id: int
    drawing_number: str
    title: Optional[str]
    discipline: Optional[str]
    drawing_area_name: Optional[str]

    # From current revision (joined)
    revision_id: Optional[int] = None
    revision_number: Optional[str] = None
    s3_key: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None

    # From project (joined)
    project_name: Optional[str] = None
    project_number: Optional[str] = None

    @property
    def has_file(self) -> bool:
        """Check if drawing has an available file."""
        return self.s3_key is not None

    @property
    def display_name(self) -> str:
        """Human-readable display name."""
        if self.title:
            return f"{self.drawing_number} - {self.title}"
        return self.drawing_number

    @classmethod
    def from_row(cls, row: dict) -> 'ProcoreDrawing':
        return cls(
            id=row['id'],
            project_id=row['project_id'],
            drawing_number=row['drawing_number'],
            title=row.get('title'),
            discipline=row.get('discipline'),
            drawing_area_name=row.get('drawing_area_name'),
            revision_id=row.get('revision_id'),
            revision_number=row.get('revision_number'),
            s3_key=row.get('s3_key'),
            filename=row.get('filename'),
            file_size=row.get('file_size'),
            project_name=row.get('project_name'),
            project_number=row.get('project_number'),
        )
```

### ProcoreDrawingList (Paginated Response)

```python
from typing import List

@dataclass
class ProcoreDrawingList:
    """Paginated list of drawings."""
    drawings: List[ProcoreDrawing]
    total: int
    page: int
    limit: int
    has_more: bool

    @property
    def total_pages(self) -> int:
        return (self.total + self.limit - 1) // self.limit
```

---

## API Request/Response Models (Pydantic)

### ListProjectsResponse

```python
from pydantic import BaseModel
from typing import List, Optional

class ProjectResponse(BaseModel):
    id: int
    name: str
    display_name: Optional[str]
    project_number: Optional[str]
    active: bool
    city: Optional[str]
    state_code: Optional[str]

class ListProjectsResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int
```

### ListDrawingsRequest (Query Params)

```python
class ListDrawingsParams(BaseModel):
    project_id: Optional[int] = None
    search: Optional[str] = None
    page: int = 1
    limit: int = 50

    @field_validator('limit')
    @classmethod
    def validate_limit(cls, v):
        if v < 1 or v > 100:
            raise ValueError('limit must be between 1 and 100')
        return v

    @field_validator('page')
    @classmethod
    def validate_page(cls, v):
        if v < 1:
            raise ValueError('page must be positive')
        return v
```

### DrawingResponse

```python
class DrawingResponse(BaseModel):
    id: int
    project_id: int
    drawing_number: str
    title: Optional[str]
    discipline: Optional[str]
    drawing_area_name: Optional[str]
    revision_number: Optional[str]
    has_file: bool
    file_size: Optional[int]
    project_name: str
    project_number: Optional[str]

class ListDrawingsResponse(BaseModel):
    drawings: List[DrawingResponse]
    total: int
    page: int
    limit: int
    has_more: bool
```

### ProcessDrawingsRequest

```python
class ProcessDrawingsRequest(BaseModel):
    drawing_ids: List[int]
    dpi: int = 600
    tile_size: int = 1920
    overlap: int = 250

    @field_validator('drawing_ids')
    @classmethod
    def validate_drawing_ids(cls, v):
        if len(v) == 0:
            raise ValueError('At least one drawing must be selected')
        if len(v) > 10:
            raise ValueError('Maximum 10 drawings per batch')
        return v

    @field_validator('dpi')
    @classmethod
    def validate_dpi(cls, v):
        if v < 72 or v > 2400:
            raise ValueError('DPI must be between 72 and 2400')
        return v

class ProcessDrawingsResponse(BaseModel):
    job_id: int
    status: str
    total_drawings: int
    message: str
```

---

## TypeScript Types (Frontend)

```typescript
// types/procore.ts

export interface ProcoreProject {
  id: number;
  name: string;
  displayName?: string;
  projectNumber?: string;
  active: boolean;
  city?: string;
  stateCode?: string;
}

export interface ProcoreDrawing {
  id: number;
  projectId: number;
  drawingNumber: string;
  title?: string;
  discipline?: string;
  drawingAreaName?: string;
  revisionNumber?: string;
  hasFile: boolean;
  fileSize?: number;
  projectName: string;
  projectNumber?: string;
}

export interface ListProjectsResponse {
  projects: ProcoreProject[];
  total: number;
}

export interface ListDrawingsResponse {
  drawings: ProcoreDrawing[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ProcessDrawingsRequest {
  drawingIds: number[];
  dpi?: number;
  tileSize?: number;
  overlap?: number;
}

export interface ProcessDrawingsResponse {
  jobId: number;
  status: string;
  totalDrawings: number;
  message: string;
}
```

---

## Validation Rules

### Drawing Selection
- Minimum: 1 drawing per job
- Maximum: 10 drawings per job (FR-012)
- All drawings must have valid `s3_key` (file available)
- All drawings must exist in external database

### Query Parameters
- `page`: Positive integer, default 1
- `limit`: 1-100, default 50
- `search`: Max 200 characters
- `project_id`: Must exist in projects table if provided

### Processing Settings
- `dpi`: 72-2400, default 600
- `tile_size`: 512-4096, default 1920
- `overlap`: 0-500, default 250

---

## State Transitions

### Job Status (for Procore source)

```
pending → processing → completed
                   ↘ failed
```

- **pending**: Job created, not yet started
- **processing**: Downloading and tiling in progress
- **completed**: All drawings processed successfully
- **failed**: One or more drawings failed (partial results may exist)

### Per-Drawing Status (tracked in job metadata)

```
pending → downloading → processing → completed
                    ↘ failed
```
