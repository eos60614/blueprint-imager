# Data Model: PDF Upload Frontend with Page Selection

**Branch**: `002-i-want-to` | **Date**: 2025-12-12

## Overview

This feature introduces frontend state management and extends the backend with S3 integration for direct uploads. The existing SQLite schema is extended to track uploads from the web frontend.

## Frontend State Model

### UploadState

Manages the lifecycle of a PDF upload session.

```typescript
interface UploadState {
  // File selection
  file: File | null;
  fileName: string | null;
  fileSize: number | null;

  // Upload progress
  uploadProgress: number; // 0-100
  uploadStatus: 'idle' | 'uploading' | 'uploaded' | 'error';
  uploadError: string | null;

  // S3 reference
  s3Key: string | null;
  s3Bucket: string | null;
}
```

**Validation Rules**:
- `file.type` must be `application/pdf`
- `fileSize` must be ≤ 100MB (104,857,600 bytes)
- `s3Key` is set after successful upload

### DocumentState

Represents the uploaded PDF document.

```typescript
interface DocumentState {
  // Document metadata
  s3Key: string;
  pageCount: number;

  // Thumbnails (lazy loaded)
  thumbnails: Map<number, ThumbnailState>; // page number -> thumbnail
  thumbnailLoadingStatus: 'idle' | 'loading' | 'complete' | 'error';
}

interface ThumbnailState {
  pageNumber: number;
  dataUrl: string; // base64 encoded image
  width: number;
  height: number;
  loaded: boolean;
}
```

**Validation Rules**:
- `pageCount` must be ≥ 1
- `pageNumber` in thumbnails must be 1 ≤ n ≤ `pageCount`

### PageSelectionState

Manages user's selection of mechanical drawing pages.

```typescript
interface PageSelectionState {
  // Raw input
  inputText: string; // e.g., "1-5, 8, 12-15"

  // Parsed selection
  selectedPages: number[]; // sorted, deduplicated: [1,2,3,4,5,8,12,13,14,15]

  // Validation
  isValid: boolean;
  validationError: string | null;
}
```

**Validation Rules**:
- Input format: comma-separated values, each being either:
  - Single page number: `\d+`
  - Page range: `\d+-\d+` where start ≤ end
- All page numbers must be 1 ≤ n ≤ `documentState.pageCount`
- Ranges must be ascending (start < end)
- At least one page must be selected for submission

**Error Messages**:
- "Invalid format: use numbers and ranges like '1-5, 8, 12-15'"
- "Page {n} exceeds document length ({pageCount} pages)"
- "Invalid range: {start}-{end} (start must be less than end)"
- "Please select at least one page"

### ProcessingState

Tracks the conversion job progress.

```typescript
interface ProcessingState {
  // Job reference
  jobId: string | null;

  // Progress tracking
  status: 'idle' | 'submitting' | 'processing' | 'complete' | 'error';
  progress: number; // 0-100
  processedPages: number;
  totalPages: number;

  // Error handling
  error: string | null;

  // Download
  downloadUrl: string | null;
  downloadReady: boolean;
}
```

**State Transitions**:
```
idle -> submitting -> processing -> complete
                  \-> error
```

### Combined Application State

```typescript
interface AppState {
  upload: UploadState;
  document: DocumentState | null;
  selection: PageSelectionState;
  processing: ProcessingState;
}
```

## Backend Data Model Extensions

### New Table: uploads

Tracks PDF uploads from the web frontend (separate from Procore drawings).

```sql
CREATE TABLE uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    -- pending, ready, processing, completed, failed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_uploads_s3_key ON uploads(s3_key);
CREATE INDEX idx_uploads_status ON uploads(status);
```

**Field Constraints**:
- `s3_bucket`: Non-empty string
- `s3_key`: Unique, format: `uploads/{uuid}/document.pdf`
- `file_size`: 1 ≤ n ≤ 104857600 (100MB)
- `page_count`: ≥ 1 when status is 'ready'
- `status`: enum('pending', 'ready', 'processing', 'completed', 'failed')

### Extended Table: jobs

Add source tracking to existing jobs table.

```sql
ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT 'procore';
-- 'procore' = from Procore integration
-- 'upload' = from web frontend upload

ALTER TABLE jobs ADD COLUMN upload_id INTEGER REFERENCES uploads(id);
ALTER TABLE jobs ADD COLUMN selected_pages TEXT;
-- JSON array: [1, 2, 3, 4, 5, 8, 12, 13, 14, 15]
```

### New Table: job_pages

Tracks per-page processing status.

```sql
CREATE TABLE job_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    page_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    -- pending, processing, completed, failed
    tile_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(job_id, page_number)
);

CREATE INDEX idx_job_pages_job_id ON job_pages(job_id);
```

## Entity Relationships

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   uploads   │────<│    jobs     │────<│  job_pages  │
└─────────────┘     └─────────────┘     └─────────────┘
      │                   │
      │                   │
      │             ┌─────────────┐
      │             │   images    │  (existing)
      │             └─────────────┘
      │
      │
┌─────────────┐
│   S3 Bucket │
│  (uploads/) │
└─────────────┘
```

## S3 Object Model

### Bucket: blueprint-imager-uploads

```
blueprint-imager-uploads/
├── uploads/
│   └── {uuid}/
│       └── document.pdf          # Original uploaded PDF
│
└── output/
    └── {job_id}/
        ├── thumbnails/           # Low-res page previews (optional)
        │   └── page_{n}.png
        └── tiles/                # Full-res tiled images
            └── page_{n}_tile_{row}_{col}.png
```

**Object Metadata**:
```yaml
uploads/{uuid}/document.pdf:
  ContentType: application/pdf
  x-amz-meta-original-filename: {user's filename}
  x-amz-meta-upload-id: {database upload id}

output/{job_id}/tiles/*.png:
  ContentType: image/png
  x-amz-meta-job-id: {job_id}
  x-amz-meta-page-number: {n}
  x-amz-meta-tile-row: {row}
  x-amz-meta-tile-col: {col}
```

## API Request/Response Models

### PresignedUrlRequest

```typescript
interface PresignedUrlRequest {
  fileName: string;
  fileSize: number;
  contentType: string; // must be "application/pdf"
}
```

### PresignedUrlResponse

```typescript
interface PresignedUrlResponse {
  uploadUrl: string;      // Presigned PUT URL
  s3Key: string;          // Key to use for subsequent requests
  expiresIn: number;      // Seconds until URL expires (900)
}
```

### UploadCompleteRequest

```typescript
interface UploadCompleteRequest {
  s3Key: string;
}
```

### UploadCompleteResponse

```typescript
interface UploadCompleteResponse {
  uploadId: number;
  pageCount: number;
  status: 'ready';
}
```

### ConvertPagesRequest

```typescript
interface ConvertPagesRequest {
  uploadId: number;
  selectedPages: number[];  // [1, 2, 3, 4, 5, 8, 12, 13, 14, 15]
}
```

### ConvertPagesResponse

```typescript
interface ConvertPagesResponse {
  jobId: number;
  status: 'processing';
  totalPages: number;
}
```

### JobStatusResponse

```typescript
interface JobStatusResponse {
  jobId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;           // 0-100
  processedPages: number;
  totalPages: number;
  errorMessage?: string;
  downloadUrl?: string;       // Presigned URL when status='completed'
}
```
