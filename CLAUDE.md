# Claude Code Context - Blueprint Imager

## Project Overview
PDF to Image converter for YOLO training. Converts mechanical drawings (M-series from Procore and manual uploads) to tiled PNG images at 600 DPI with 1920x1920 tiles and 13% overlap.

## Current Feature
**Branch**: 005-browse-history
**Status**: Implementation complete
**Spec**: `/specs/005-browse-history/spec.md`
**Plan**: `/specs/005-browse-history/plan.md`

## Tech Stack

### Backend
- **Language**: Python 3.11+
- **Framework**: FastAPI (API), Click (CLI)
- **PDF Processing**: pdf2image with Poppler
- **Image Processing**: Pillow (PIL)
- **Database**: SQLite
- **HTTP Client**: httpx
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
# Backend
src/
├── models/       # Data models (job, upload, job_page)
├── services/     # Core logic (pdf_processor, image_tiler, s3_client, job_service)
├── api/          # FastAPI endpoints (upload, convert, jobs)
├── cli/          # Command-line interface
├── config.py     # Environment configuration
└── db.py         # Database connection

tests/
├── contract/     # API contract tests
├── integration/  # Feature integration tests
└── unit/         # Unit tests

# Frontend
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── FileUpload/   # Drag-drop upload
│   │   ├── PageSelector/ # Page range/individual selection
│   │   ├── ThumbnailGrid/# PDF page previews
│   │   ├── ProcessingStatus/ # Job progress display
│   │   ├── SubmitButton/ # Conversion trigger
│   │   ├── DownloadButton/ # ZIP download
│   │   ├── Instructions/ # User help
│   │   └── ConfirmModal/ # Confirmation dialog
│   ├── contexts/         # React contexts (Upload, Selection, Processing)
│   ├── hooks/            # Custom hooks (useJobStatus)
│   ├── lib/              # Utility functions
│   └── types/            # TypeScript types
├── public/               # Static assets (favicon)
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright E2E tests
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── vercel.json           # Vercel deployment config
```

## Key Features

### Core (feature 001)
1. Convert PDFs at 600 DPI to PNG (RGB, lossless)
2. Generate 1920x1920 tiles with 250px overlap (stride=1670)
3. Filter M-series drawings from Procore
4. OAuth integration with Procore sandbox
5. Bulk ZIP downloads of converted images

### Frontend (feature 002)
1. Web-based PDF upload with drag-drop support
2. Page selection via ranges (1-10) or individual (3, 7, 15)
3. PDF thumbnail previews for all pages
4. Direct S3 upload (bypass Vercel limits)
5. Real-time processing status with progress indication
6. ZIP download of converted tiles
7. Responsive design for desktop browsers

## API Endpoints

### Upload
- `POST /api/upload/presign` - Get presigned URL for S3 upload
- `POST /api/upload/complete` - Confirm upload and get page count

### Convert
- `POST /api/convert/pages` - Start conversion job for selected pages

### Jobs
- `GET /api/jobs/{jobId}` - Get job status and progress
- `GET /api/jobs/{jobId}/download` - Download tiles as ZIP

## Environment Variables

### Backend (.env)
```bash
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=blueprint-imager-uploads

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
# Install dependencies
pip install -r requirements.txt

# Initialize database
python -m src.cli.main init-db

# Start API server
python -m src.cli.main serve --port 3001

# Convert single PDF (CLI)
python -m src.cli.main convert sample.pdf --output-dir ./output

# Procore operations
python -m src.cli.main procore-auth
python -m src.cli.main procore-list --project-id 123456
python -m src.cli.main procore-convert --project-id 123456 --series M
```

### Frontend
```bash
cd frontend

# Install dependencies
npm install

# Start dev server (http://localhost:3000)
npm run dev

# Run unit tests
npm run test

# Run E2E tests
npm run test:e2e

# Production build
npm run build

# Deploy to Vercel
vercel
```

### Full Stack Development
```bash
# Terminal 1 - Backend
python -m src.cli.main serve --port 3001

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Testing

### Backend
```bash
# Run all tests
pytest

# Run specific test file
pytest tests/unit/test_pdf_processor.py

# Run with coverage
pytest --cov=src
```

### Frontend
```bash
cd frontend

# Run unit tests
npm run test

# Run with coverage
npm run test:coverage

# Run E2E tests (requires backend running)
npm run test:e2e
```

## Deployment

### Backend
- Deploy to any Python-capable host (Railway, Render, AWS EC2, etc.)
- Ensure Poppler is installed for PDF processing
- Configure environment variables for S3 access

### Frontend
```bash
cd frontend
vercel
```

Configure in Vercel dashboard:
- `NEXT_PUBLIC_API_URL` - Backend API URL
- S3 CORS configuration must include Vercel domain

---
*Context for Claude Code - Last updated: 2025-12-13*

## Active Technologies
- Python 3.11+ (Backend), TypeScript 5.x (Frontend) + FastAPI, Next.js 14 (App Router), pdfjs-dist, SWR, Tailwind CSS (005-browse-history)
- SQLite (jobs/uploads), AWS S3 (PDFs/tiles), localStorage (history references) (005-browse-history)

## Recent Changes
- 005-browse-history: Added Python 3.11+ (Backend), TypeScript 5.x (Frontend) + FastAPI, Next.js 14 (App Router), pdfjs-dist, SWR, Tailwind CSS
