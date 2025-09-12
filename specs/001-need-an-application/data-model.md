# Data Model: PDF Drawing to Image Converter

## Core Entities

### DrawingSource
Represents the origin of drawings (Procore or manual upload).

**Fields**:
- `id`: UUID - Unique identifier
- `type`: Enum["procore", "upload"] - Source type
- `procore_project_id`: Optional[str] - Procore project ID if applicable
- `procore_drawing_id`: Optional[str] - Procore drawing ID if applicable
- `created_at`: datetime - Timestamp of creation
- `metadata`: dict - Additional source-specific data

**Relationships**:
- Has many PDFDocuments

### PDFDocument
Represents an uploaded or retrieved PDF file.

**Fields**:
- `id`: UUID - Unique identifier
- `source_id`: UUID - Foreign key to DrawingSource
- `filename`: str - Original filename
- `file_path`: str - Storage location
- `page_count`: int - Number of pages
- `file_size`: int - Size in bytes
- `upload_date`: datetime - When uploaded/retrieved
- `is_m_series`: bool - Whether this is an M-series drawing
- `drawing_number`: Optional[str] - Drawing identifier (e.g., "M-101")
- `status`: Enum["pending", "processing", "completed", "failed"] - Processing status
- `error_message`: Optional[str] - Error details if failed

**Relationships**:
- Belongs to DrawingSource
- Has many ConvertedImages

**Validation**:
- filename must not contain path traversal characters
- file_size must be positive
- page_count must be >= 1

### ConvertedImage
Represents an extracted image from a PDF page.

**Fields**:
- `id`: UUID - Unique identifier  
- `document_id`: UUID - Foreign key to PDFDocument
- `page_number`: int - Source page (1-indexed)
- `file_path`: str - Full-resolution image location
- `width`: int - Image width in pixels
- `height`: int - Image height in pixels
- `dpi`: int - Resolution (always 600)
- `format`: str - Image format (always "PNG")
- `color_mode`: str - Color mode (always "RGB")
- `created_at`: datetime - Conversion timestamp

**Relationships**:
- Belongs to PDFDocument
- Has many ImageTiles

**Validation**:
- page_number must be >= 1
- dpi must equal 600
- format must be "PNG"
- color_mode must be "RGB"

### ImageTile
Represents a 1920×1920 pixel section of a full-page image.

**Fields**:
- `id`: UUID - Unique identifier
- `image_id`: UUID - Foreign key to ConvertedImage  
- `tile_index`: int - Sequential tile number
- `file_path`: str - Tile image location
- `x_position`: int - X coordinate in parent image
- `y_position`: int - Y coordinate in parent image
- `width`: int - Tile width (always 1920)
- `height`: int - Tile height (always 1920)
- `overlap_pixels`: int - Overlap amount (250)
- `is_edge_tile`: bool - Whether tile touches image boundary

**Relationships**:
- Belongs to ConvertedImage

**Validation**:
- width must equal 1920
- height must equal 1920
- x_position must be >= 0
- y_position must be >= 0

### ConversionJob
Represents a batch processing request.

**Fields**:
- `id`: UUID - Unique identifier
- `status`: Enum["queued", "running", "completed", "failed", "cancelled"] - Job status
- `created_at`: datetime - Job creation time
- `started_at`: Optional[datetime] - Processing start time
- `completed_at`: Optional[datetime] - Completion time
- `total_documents`: int - Number of PDFs to process
- `processed_documents`: int - Number completed
- `total_pages`: int - Total pages across all PDFs
- `processed_pages`: int - Pages converted so far
- `output_zip_path`: Optional[str] - ZIP file location when complete
- `error_message`: Optional[str] - Error details if failed

**Relationships**:
- Has many PDFDocuments

**Validation**:
- processed_documents <= total_documents
- processed_pages <= total_pages

## State Transitions

### PDFDocument Status
```
pending → processing → completed
        ↘          ↗
          failed
```

### ConversionJob Status  
```
queued → running → completed
       ↘        ↗
         failed
       ↘
        cancelled
```

## Database Schema (SQLite)

```sql
CREATE TABLE drawing_sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK(type IN ('procore', 'upload')),
    procore_project_id TEXT,
    procore_drawing_id TEXT,
    created_at TIMESTAMP NOT NULL,
    metadata TEXT -- JSON
);

CREATE TABLE pdf_documents (
    id TEXT PRIMARY KEY,
    source_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    page_count INTEGER NOT NULL,
    file_size INTEGER NOT NULL,
    upload_date TIMESTAMP NOT NULL,
    is_m_series BOOLEAN NOT NULL,
    drawing_number TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    FOREIGN KEY (source_id) REFERENCES drawing_sources(id)
);

CREATE TABLE converted_images (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL,
    page_number INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    dpi INTEGER NOT NULL,
    format TEXT NOT NULL,
    color_mode TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (document_id) REFERENCES pdf_documents(id)
);

CREATE TABLE image_tiles (
    id TEXT PRIMARY KEY,
    image_id TEXT NOT NULL,
    tile_index INTEGER NOT NULL,
    file_path TEXT NOT NULL,
    x_position INTEGER NOT NULL,
    y_position INTEGER NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    overlap_pixels INTEGER NOT NULL,
    is_edge_tile BOOLEAN NOT NULL,
    FOREIGN KEY (image_id) REFERENCES converted_images(id)
);

CREATE TABLE conversion_jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    total_documents INTEGER NOT NULL,
    processed_documents INTEGER NOT NULL,
    total_pages INTEGER NOT NULL,
    processed_pages INTEGER NOT NULL,
    output_zip_path TEXT,
    error_message TEXT
);

CREATE TABLE job_documents (
    job_id TEXT NOT NULL,
    document_id TEXT NOT NULL,
    PRIMARY KEY (job_id, document_id),
    FOREIGN KEY (job_id) REFERENCES conversion_jobs(id),
    FOREIGN KEY (document_id) REFERENCES pdf_documents(id)
);
```

## Indexes

```sql
CREATE INDEX idx_documents_source ON pdf_documents(source_id);
CREATE INDEX idx_documents_status ON pdf_documents(status);
CREATE INDEX idx_images_document ON converted_images(document_id);
CREATE INDEX idx_tiles_image ON image_tiles(image_id);
CREATE INDEX idx_job_documents_job ON job_documents(job_id);
CREATE INDEX idx_jobs_status ON conversion_jobs(status);
```

---
*Data model defined: 2025-09-12*