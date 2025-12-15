# Data Model: Browse History Feature

**Feature**: 005-browse-history
**Date**: 2025-12-13

## Overview

This feature primarily extends the frontend with client-side data models for history management. The backend models (Job, Upload) remain unchanged, with new API endpoints exposing existing data.

---

## Frontend Data Models (TypeScript)

### HistoryEntry

Stored in browser localStorage. Represents a single upload/conversion job in the user's history.

```typescript
interface HistoryEntry {
  // Core identifiers
  jobId: number;
  uploadId: number;

  // Display information
  fileName: string;
  uploadedAt: string;           // ISO 8601 timestamp

  // Page information
  pageCount: number;            // Total pages in original PDF
  selectedPages: number[];      // Pages selected for processing

  // Status tracking
  status: HistoryStatus;
  lastSyncedAt: string;         // ISO 8601 timestamp

  // Conversion settings (for display)
  settings: {
    dpi: number;
    tileSize: number;
    overlap: number;
  };
}

type HistoryStatus =
  | 'pending'      // Job created, not started
  | 'processing'   // Currently processing
  | 'completed'    // Successfully finished
  | 'failed'       // Processing failed
  | 'unavailable'; // Server files no longer exist
```

**Validation Rules**:
- `jobId` must be positive integer
- `uploadId` must be positive integer
- `fileName` must be non-empty string
- `uploadedAt` must be valid ISO 8601 timestamp
- `pageCount` must be positive integer
- `selectedPages` must be non-empty array of positive integers
- `selectedPages` values must be ≤ `pageCount`

**State Transitions**:
```
pending → processing → completed
                    → failed

Any status → unavailable (when server returns 404)
```

---

### JobDetails

Response from API when fetching detailed job information for history view.

```typescript
interface JobDetails {
  jobId: number;
  status: JobStatus;
  progress: number;              // 0-100

  // Upload info
  uploadId: number;
  fileName: string;
  uploadedAt: string;

  // Page info
  totalPages: number;            // In original PDF
  selectedPages: number[];
  processedPages: number;

  // Conversion settings
  dpi: number;
  tileSize: number;
  overlap: number;

  // Error info (if failed)
  errorMessage?: string;

  // Download (if completed)
  downloadUrl?: string;
}

type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

---

### PageInfo

Information about a single processed page.

```typescript
interface PageInfo {
  pageNumber: number;            // 1-indexed (matches PDF page numbers)
  tileCount: number;             // Number of tiles generated
  gridSize: {
    rows: number;
    cols: number;
  };
  thumbnailUrl?: string;         // Presigned URL (if pre-cached)
}
```

---

### TileInfo

Information about a single tile within a page.

```typescript
interface TileInfo {
  row: number;                   // 0-indexed
  col: number;                   // 0-indexed
  url: string;                   // Presigned S3 URL
  width: number;                 // Pixel width (usually tileSize)
  height: number;                // Pixel height (may vary at edges)
}
```

---

### TileGridResponse

API response for tile listing.

```typescript
interface TileGridResponse {
  jobId: number;
  pageNumber: number;
  tiles: TileInfo[];
  totalTiles: number;
  gridSize: {
    rows: number;
    cols: number;
  };
}
```

---

## Backend Data Models (Python)

### No New Models Required

The existing `Job` and `Upload` models already contain all necessary fields:

**Job model (existing)**:
- `id`, `status`, `created_at`, `updated_at`
- `upload_id`, `selected_pages` (JSON), `total_pages`, `processed_pages`
- `dpi`, `tile_size`, `overlap`
- `error_message`

**Upload model (existing)**:
- `id`, `s3_bucket`, `s3_key`, `file_name`, `file_size`
- `page_count`, `status`, `created_at`

### New Query Functions

Add to `job_service.py`:

```python
def get_jobs_by_ids(job_ids: List[int]) -> List[dict]:
    """Fetch multiple jobs by ID for history sync."""
    pass

def get_job_with_upload(job_id: int) -> Optional[dict]:
    """Get job with joined upload data for detail view."""
    pass

def get_page_tiles(job_id: int, page_num: int) -> dict:
    """Get tile info for a specific page."""
    pass
```

---

## Storage Schema

### localStorage Key

```
Key: 'blueprint-imager-history'
Value: JSON string of HistoryEntry[]
```

**Example**:
```json
[
  {
    "jobId": 42,
    "uploadId": 15,
    "fileName": "floor-plans.pdf",
    "uploadedAt": "2025-12-13T10:30:00Z",
    "pageCount": 25,
    "selectedPages": [1, 2, 3, 4, 5],
    "status": "completed",
    "lastSyncedAt": "2025-12-13T10:35:00Z",
    "settings": {
      "dpi": 600,
      "tileSize": 1920,
      "overlap": 250
    }
  }
]
```

---

## S3 Key Patterns

Existing patterns used by history feature:

| Resource | S3 Key Pattern |
|----------|----------------|
| Original PDF | `uploads/{upload_id}/{filename}` |
| Output tiles | `output/{job_id}/tiles/page_{page_num}_tile_{row}_{col}.png` |

---

## Entity Relationships

```
┌─────────────────┐     references     ┌─────────────────┐
│  HistoryEntry   │ ─────────────────> │      Job        │
│  (localStorage) │                    │    (SQLite)     │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                │ belongs to
                                                ▼
                                       ┌─────────────────┐
                                       │     Upload      │
                                       │    (SQLite)     │
                                       └────────┬────────┘
                                                │
                                                │ stored in
                                                ▼
                                       ┌─────────────────┐
                                       │    S3 Bucket    │
                                       │   (PDF/Tiles)   │
                                       └─────────────────┘
```

---

## Data Lifecycle

1. **On Upload Complete**:
   - Backend creates `Upload` and `Job` records
   - Frontend adds `HistoryEntry` to localStorage

2. **On History View**:
   - Frontend loads entries from localStorage
   - Frontend syncs status with backend via batch API call
   - Stale entries updated, unavailable entries marked

3. **On Entry Delete**:
   - Frontend removes entry from localStorage
   - Backend files remain (until 30-day expiry)

4. **On 30-Day Expiry**:
   - Backend cleanup removes S3 files and database records
   - Next sync marks localStorage entry as 'unavailable'
