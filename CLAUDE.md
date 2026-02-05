# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PDF to Image converter for YOLO training. Converts mechanical drawings to tiled PNG images at configurable DPI (default 600) with configurable tile sizes (default 1920x1920) and overlap (default 250px).

**Tech Stack**: Python 3.11+ FastAPI backend, Next.js 14 TypeScript frontend, PostgreSQL, AWS S3

## Development Commands

### Backend
```bash
pip install -r requirements.txt              # Install dependencies
python -m src.cli.main init-db               # Initialize database
python -m src.cli.main serve --port 3001     # Start API server
python -m src.cli.main convert sample.pdf --output-dir ./output  # CLI conversion
```

### Frontend
```bash
cd frontend
npm install       # Install dependencies
npm run dev       # Dev server (localhost:3000)
npm run build     # Production build
npm run lint      # ESLint
```

### Testing
```bash
# Backend
pytest                                    # All tests
pytest tests/unit/test_tile_calculator.py # Single test file
pytest -k "test_name"                     # Single test by name

# Frontend
cd frontend
npm run test                     # Vitest unit tests
npm run test -- path/to/test.ts  # Single test file
npm run test:e2e                 # Playwright (requires backend running)
```

## Architecture

### Backend (src/)

**API Layer** (`src/api/`): Thin FastAPI routes delegating to services
- `upload.py`: Presigned S3 URLs and upload completion
- `convert.py`: Job creation and tile estimation
- `jobs.py`: Job status, details, downloads
- `tiles.py`: Static tile serving

**Service Layer** (`src/services/`): Core business logic
- `PDFProcessor`: PDF→PNG conversion at specified DPI
- `ImageTiler`: Tiling with overlap, blank detection (95%+ white pixels filtered)
- `S3Client`: Presigned URLs, upload/download operations
- `JobService`: Job CRUD and progress tracking
- `TileCalculator`: Area-based tile grid calculations

**Data Layer** (`src/models/`, `src/db.py`): Dataclasses and PostgreSQL operations

### Frontend (frontend/src/)

**State Management**: React Context (5 contexts in `contexts/`)
- UploadContext, SelectionContext, ProcessingContext, AreaSelectionContext, HistoryContext

**Data Fetching**: SWR hooks in `hooks/` (useJobStatus, useJobDetails, useHistory)

**Path alias**: `@/*` → `./src/*`

### Processing Flow

1. Frontend uploads PDF directly to S3 via presigned URL
2. Backend receives upload notification, counts pages
3. User selects pages/areas, requests conversion
4. Backend creates job, processes pages in background
5. Frontend polls job status, displays progress
6. Tiles served from local storage or downloaded as ZIP

### Key Formulas

- **Stride**: `tile_size - overlap` (default: 1920 - 250 = 1670)
- **Blank detection**: 95%+ white pixels → tile filtered

## API Routes

All endpoints under `/api/`:
- `POST /upload/presign`, `POST /upload/complete` - S3 upload flow
- `POST /convert/pages`, `POST /convert/estimate-tiles` - Conversion
- `GET /jobs/{id}`, `GET /jobs/{id}/details`, `GET /jobs/{id}/download` - Job operations
- `GET /tiles/{jobId}/{filename}` - Tile serving
- `GET /roboflow/status`, `POST /roboflow/upload` - Roboflow integration

## Database Tables

- **uploads**: PDF metadata (s3_key, page_count, status)
- **jobs**: Conversion jobs (upload_id, selected_pages, dpi, tile_size, overlap, status)
- **job_pages**: Per-page processing status and tile counts

## Environment Variables

Backend requires: `DATABASE_*` (PostgreSQL), `AWS_*` + `S3_BUCKET_NAME`, `CORS_ORIGINS`
Frontend requires: `NEXT_PUBLIC_API_URL`

See `.env.example` for full list.

## Feature Specifications

Feature specs live in `/specs/NNN-feature-name/` with: spec.md, plan.md, tasks.md, data-model.md

Current specs: 001 (core PDF tiling), 002 (frontend upload), 005 (history), 006 (area selection), 007 (HVAC detection - planned)
