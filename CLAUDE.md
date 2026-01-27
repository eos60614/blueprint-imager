# Claude Code Context - Blueprint Imager

## Project Overview

PDF to Image converter for YOLO training. Converts mechanical drawings (M-series from Procore and manual uploads) to tiled PNG images at configurable DPI (default 600) with configurable tile sizes (default 1920x1920) and overlap (default 250px / ~13%).

## Tech Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI (API), Click (CLI)
- **PDF Processing**: pdf2image with Poppler
- **Image Processing**: Pillow (PIL), NumPy (blank detection)
- **Database**: PostgreSQL (psycopg2)
- **HTTP Client**: httpx, requests
- **File Uploads**: python-multipart
- **Cloud Storage**: AWS S3 (boto3)

### Frontend
- **Language**: TypeScript 5.x
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **PDF Rendering**: pdf.js (pdfjs-dist)
- **File Upload**: react-dropzone + S3 presigned URLs
- **Data Fetching**: SWR
- **Testing**: Vitest + Playwright

## Project Structure

```
blueprint-imager/
├── src/                          # Backend source
│   ├── api/                      # FastAPI endpoints
│   │   ├── main.py              # App setup, CORS, routers
│   │   ├── upload.py            # Presign & complete endpoints
│   │   ├── convert.py           # Conversion & tile estimation
│   │   ├── jobs.py              # Job status, download, details
│   │   ├── tiles.py             # Static tile serving
│   │   └── roboflow.py          # Roboflow upload integration
│   ├── services/                 # Core business logic
│   │   ├── pdf_processor.py     # PDF to PNG conversion
│   │   ├── image_tiler.py       # Image tiling with blank detection
│   │   ├── s3_client.py         # AWS S3 operations
│   │   ├── job_service.py       # Job CRUD & progress tracking
│   │   ├── tile_calculator.py   # Area-based tile calculations
│   │   ├── procore_client.py    # Procore API integration
│   │   └── roboflow_client.py   # Roboflow API integration
│   ├── models/                   # Data models (dataclasses)
│   │   ├── job.py               # Job with progress calculation
│   │   ├── upload.py            # Upload metadata
│   │   ├── job_page.py          # Per-page processing status
│   │   ├── area_selection.py    # Area selection for tiling
│   │   ├── drawing.py           # Procore drawing
│   │   └── image.py             # Tiled image
│   ├── cli/                      # Click CLI commands
│   │   └── main.py              # init-db, convert, serve, etc.
│   ├── config.py                 # Environment configuration
│   └── db.py                     # PostgreSQL connection & schema
├── tests/
│   ├── unit/                     # pytest unit tests
│   │   └── test_tile_calculator.py
│   ├── integration/              # Integration tests
│   └── contract/                 # API contract tests
├── frontend/
│   ├── src/
│   │   ├── app/                  # Next.js App Router
│   │   │   ├── page.tsx         # Main conversion page
│   │   │   ├── layout.tsx       # Root layout
│   │   │   └── history/         # History browsing
│   │   │       ├── page.tsx     # History list
│   │   │       └── [jobId]/     # Job detail & page tiles
│   │   ├── components/           # React components
│   │   │   ├── FileUpload/      # Drag-drop PDF upload
│   │   │   ├── PageSelector/    # Page range selection
│   │   │   ├── ThumbnailGrid/   # PDF page previews
│   │   │   ├── TileGrid/        # Tile viewer with pagination
│   │   │   ├── TilePreview/     # Single tile preview
│   │   │   ├── AreaSelector/    # Area selection overlay
│   │   │   ├── PagePreview/     # Page preview with area
│   │   │   ├── ProcessingStatus/# Job progress display
│   │   │   ├── ConversionSettings/ # DPI/tile settings
│   │   │   ├── TileEstimateDisplay/ # Tile count preview
│   │   │   ├── HistoryList/     # History browsing
│   │   │   ├── PageGrid/        # Page thumbnails
│   │   │   ├── RoboflowUpload/  # Roboflow integration UI
│   │   │   ├── Navigation/      # Nav header
│   │   │   ├── SubmitButton/    # Convert trigger
│   │   │   ├── DownloadButton/  # ZIP download
│   │   │   ├── ConfirmModal/    # Confirmation dialog
│   │   │   └── Instructions/    # User help
│   │   ├── contexts/             # React Context state
│   │   │   ├── UploadContext.tsx
│   │   │   ├── SelectionContext.tsx
│   │   │   ├── ProcessingContext.tsx
│   │   │   ├── AreaSelectionContext.tsx
│   │   │   └── HistoryContext.tsx
│   │   ├── hooks/                # Custom hooks
│   │   │   ├── useJobStatus.ts
│   │   │   ├── useJobDetails.ts
│   │   │   ├── useHistory.ts
│   │   │   └── useRoboflowUpload.ts
│   │   ├── lib/                  # Utilities
│   │   │   ├── api-client.ts    # API wrapper
│   │   │   ├── s3-upload.ts     # S3 direct upload
│   │   │   ├── pdf-utils.ts     # PDF.js utilities
│   │   │   ├── page-parser.ts   # Page range parsing
│   │   │   ├── history-storage.ts # localStorage
│   │   │   ├── coordinate-utils.ts # Area coords
│   │   │   ├── validators.ts
│   │   │   └── config.ts
│   │   └── types/                # TypeScript types
│   │       ├── api.ts
│   │       ├── state.ts
│   │       ├── history.ts
│   │       ├── area-selection.ts
│   │       └── roboflow.ts
│   ├── tests/
│   │   ├── unit/                 # Vitest tests
│   │   └── e2e/                  # Playwright tests
│   ├── package.json
│   ├── tsconfig.json
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── vercel.json
├── specs/                        # Feature specifications
│   ├── 001-need-an-application/  # Core PDF to tiles
│   ├── 002-i-want-to/            # Frontend upload
│   ├── 005-browse-history/       # History browsing
│   └── 006-feature-that-will/    # Area selection
├── Dockerfile
├── docker-compose.yml
├── nginx.conf
├── requirements.txt
└── .env.example
```

## Key Features

### Core Processing
- Convert PDFs at configurable DPI (default 600) to PNG (RGB, lossless)
- Generate tiles with configurable size (default 1920x1920) and overlap (default 250px)
- Blank tile detection (95%+ white pixels) with option to filter
- Stride calculation: stride = tile_size - overlap (default 1670)

### Frontend Features
- Web-based PDF upload with drag-drop support
- Page selection via ranges (1-10) or individual (3, 7, 15)
- PDF thumbnail previews for all pages
- **Area selection**: Define regions for tile generation per page
- **Tile estimation**: Preview tile count before conversion
- **Conversion settings**: Configurable DPI, tile size, overlap
- Direct S3 upload (bypass Vercel limits)
- Real-time processing status with progress indication
- ZIP download of converted tiles (all or selected)
- **History browsing**: View past conversions with page/tile details
- **Roboflow upload**: Send tiles to Roboflow for ML training

### Procore Integration (Legacy)
- OAuth integration with Procore sandbox
- Filter M-series mechanical drawings
- Bulk download and convert project drawings

## API Endpoints

### Upload
```
POST /api/upload/presign     - Get S3 presigned URL for upload
POST /api/upload/complete    - Confirm upload, get page count
```

### Convert
```
POST /api/convert/pages          - Start conversion job
POST /api/convert/estimate-tiles - Estimate tiles without processing
```

### Jobs
```
GET  /api/jobs?ids=1,2,3           - Batch fetch jobs for history
GET  /api/jobs/{jobId}             - Get job status and progress
GET  /api/jobs/{jobId}/details     - Get complete job details
GET  /api/jobs/{jobId}/pages       - Get pages with tile counts
GET  /api/jobs/{jobId}/pages/{num}/tiles - Get tiles for a page
GET  /api/jobs/{jobId}/download    - Download all tiles as ZIP
POST /api/jobs/{jobId}/download-tiles - Download selected tiles
GET  /api/jobs/{jobId}/pdf-url     - Get presigned PDF URL
```

### Tiles
```
GET  /api/tiles/{jobId}/{filename} - Serve individual tile
```

### Roboflow
```
GET  /api/roboflow/status     - Check Roboflow configuration
POST /api/roboflow/upload     - Upload tiles to Roboflow
```

### Health
```
GET  /         - API info
GET  /health   - Health check
```

## Database Schema (PostgreSQL)

### Tables
- **uploads**: PDF file metadata (s3_key, page_count, status)
- **jobs**: Conversion jobs (upload_id, selected_pages, dpi, tile_size, overlap, status, progress)
- **job_pages**: Per-page status (job_id, page_number, tile_count, status)
- **drawings**: Procore drawings (legacy)
- **images**: Tiled images (legacy)
- **auth_tokens**: Procore OAuth tokens (legacy)

### Key Models
- `Job`: id, project_id, status, total_pages, processed_pages, upload_id, selected_pages, dpi, tile_size, overlap
- `Upload`: id, s3_key, file_name, page_count, status
- `JobPage`: id, job_id, page_number, tile_count, status
- `AreaSelection`: page_num, x, y, width, height

## Services

| Service | Purpose |
|---------|---------|
| `PDFProcessor` | PDF to PNG at specified DPI |
| `ImageTiler` | Tile images with overlap, blank detection |
| `S3Client` | Presigned URLs, upload/download |
| `JobService` | Job CRUD, progress tracking |
| `TileCalculator` | Tile grid for area selection |
| `RoboflowClient` | Upload tiles with train/valid/test split |
| `ProcoreClient` | OAuth and drawing retrieval |

## Environment Variables

### Backend (.env)
```bash
# PostgreSQL
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=blueprint_imager
DATABASE_USER=postgres
DATABASE_PASSWORD=password

# AWS S3
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=blueprint-imager-uploads

# Processing Defaults
PDF_DPI=600
TILE_SIZE=1920
TILE_OVERLAP=250

# Local Storage
LOCAL_TILE_STORAGE_PATH=/var/data/tiles
TILE_TTL_HOURS=24

# CORS
CORS_ORIGINS=http://localhost:3000,https://your-frontend.vercel.app

# Roboflow (optional)
ROBOFLOW_API_KEY=your_key
ROBOFLOW_PROJECT_NAME=your_project

# Procore (optional)
PROCORE_CLIENT_ID=...
PROCORE_CLIENT_SECRET=...
PROCORE_API_BASE_URL=https://sandbox.procore.com
PROCORE_AUTH_BASE_URL=https://login-sandbox.procore.com
PROCORE_COMPANY_ID=...
```

### Frontend (.env.local)
```bash
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## Development Commands

### Backend
```bash
# Install
pip install -r requirements.txt

# Initialize database
python -m src.cli.main init-db

# Start server
python -m src.cli.main serve --port 3001

# Convert PDF (CLI)
python -m src.cli.main convert sample.pdf --output-dir ./output --dpi 600

# Cleanup old tiles
python -m src.cli.main cleanup-tiles --ttl-hours 24

# Procore commands
python -m src.cli.main procore-auth
python -m src.cli.main procore-list --project-id 123456
python -m src.cli.main procore-convert --project-id 123456 --series M
```

### Frontend
```bash
cd frontend

npm install          # Install dependencies
npm run dev          # Dev server (http://localhost:3000)
npm run build        # Production build
npm run test         # Unit tests
npm run test:e2e     # E2E tests
vercel               # Deploy
```

### Testing
```bash
# Backend
pytest                        # All tests
pytest tests/unit/            # Unit tests
pytest --cov=src              # With coverage

# Frontend
cd frontend
npm run test                  # Vitest
npm run test:e2e              # Playwright (backend required)
```

## Deployment

### Docker (with Cloudflare Tunnel)
```bash
docker-compose up -d
```
Services:
- **api**: FastAPI backend on port 3010
- **nginx**: Reverse proxy
- **tunnel**: Cloudflare tunnel for HTTPS (no account needed)

### Docker (standalone)
```bash
docker build -t blueprint-imager .
docker run -p 3001:3010 --env-file .env blueprint-imager
```

### Frontend (Vercel)
```bash
cd frontend && vercel
```
Configure `NEXT_PUBLIC_API_URL` in Vercel dashboard.

## Code Conventions

### Backend
- Use dataclasses for models in `src/models/`
- Services contain business logic, API routes are thin
- All database operations through `src/db.py` context managers
- Configuration via `src/config.py` with environment variables
- Type hints for all function signatures

### Frontend
- React Context for state management (5 contexts)
- Custom hooks for data fetching and reusable logic
- Components in folders with index.ts re-exports
- TypeScript strict mode enabled
- Path alias: `@/*` → `./src/*`

### API Design
- RESTful endpoints under `/api/`
- Job-based async processing with polling
- Presigned URLs for direct S3 uploads
- ZIP responses for bulk downloads

## Specifications

Feature specs are in `/specs/` directories:
- `001-need-an-application/`: Core PDF to tiles
- `002-i-want-to/`: Frontend upload interface
- `005-browse-history/`: History browsing
- `006-feature-that-will/`: Area selection & tile estimates

Each contains: spec.md, data-model.md, plan.md, quickstart.md, research.md, tasks.md

---
*Context for Claude Code - Last updated: 2026-01-27*
