# Implementation Plan: Browse History - View Previously Uploaded Files

**Branch**: `005-browse-history` | **Date**: 2025-12-13 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/005-browse-history/spec.md`

## Summary

Enable users to browse their previously uploaded PDF files, view processed pages with thumbnails, inspect generated tiles, and download conversion results. History is stored locally in the browser (localStorage) with references to server-side job data. Thumbnails are re-rendered from the original PDF files retained in S3.

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI, Next.js 14 (App Router), pdfjs-dist, SWR, Tailwind CSS
**Storage**: SQLite (jobs/uploads), AWS S3 (PDFs/tiles), localStorage (history references)
**Testing**: pytest (Backend), Vitest + Playwright (Frontend)
**Target Platform**: Linux server (Backend), Vercel (Frontend), Desktop browsers
**Project Type**: Web application (frontend + backend)
**Performance Goals**: History loads in <2s, thumbnails in <3s, tile grid in <3s
**Constraints**: 30-day server file retention, browser-specific history, no authentication
**Scale/Scope**: ~50 uploads per user, ~100 pages per PDF, ~200 tiles per page

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution template is not yet customized for this project. Proceeding with standard best practices:

- [x] **Test-First**: Unit tests for new API endpoints and frontend components
- [x] **Simplicity**: Extend existing models/endpoints rather than creating new abstractions
- [x] **Observability**: Logging for history operations, error states
- [x] **No Overengineering**: Use localStorage for history (no auth/database required)

## Project Structure

### Documentation (this feature)

```text
specs/005-browse-history/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
# Backend
src/
├── models/
│   ├── job.py           # Extend for history queries
│   ├── upload.py        # Existing upload model
│   └── job_page.py      # Existing job page model
├── services/
│   ├── job_service.py   # Add list_jobs, get_job_details
│   ├── s3_client.py     # Add get_tile_urls, get_pdf_url
│   └── pdf_processor.py # Existing PDF processing
└── api/
    ├── jobs.py          # Extend with list, pages, tiles endpoints
    └── history.py       # NEW: History-specific endpoints

tests/
├── contract/
│   └── test_history_api.py  # NEW: API contract tests
├── integration/
│   └── test_history_flow.py # NEW: End-to-end history tests
└── unit/
    └── test_job_service.py  # Extend for history functions

# Frontend
frontend/
├── src/
│   ├── app/
│   │   ├── page.tsx           # Add History tab
│   │   └── history/
│   │       ├── page.tsx       # NEW: History list view
│   │       └── [jobId]/
│   │           ├── page.tsx   # NEW: Job detail/pages view
│   │           └── [pageNum]/
│   │               └── page.tsx # NEW: Tile grid view
│   ├── components/
│   │   ├── Navigation/        # NEW: Tab navigation (Upload/History)
│   │   ├── HistoryList/       # NEW: Upload history list
│   │   ├── HistoryItem/       # NEW: Single history entry
│   │   ├── PageGrid/          # NEW: Page thumbnails for job
│   │   ├── TileGrid/          # NEW: Tiles for a page
│   │   ├── TilePreview/       # NEW: Full-size tile modal
│   │   └── EmptyState/        # NEW: No history message
│   ├── contexts/
│   │   └── HistoryContext.tsx # NEW: History state management
│   ├── hooks/
│   │   ├── useHistory.ts      # NEW: localStorage operations
│   │   └── useJobDetails.ts   # NEW: Fetch job pages/tiles
│   ├── lib/
│   │   └── history-storage.ts # NEW: localStorage wrapper
│   └── types/
│       └── history.ts         # NEW: History-specific types
└── tests/
    ├── unit/
    │   ├── useHistory.test.ts     # NEW
    │   └── history-storage.test.ts # NEW
    └── e2e/
        └── history.spec.ts        # NEW: E2E history flow
```

**Structure Decision**: Web application with separate frontend/backend. Extends existing project structure with new history-specific components and API endpoints.

## Complexity Tracking

No constitution violations. Design follows existing patterns:
- Extends existing Job/Upload models rather than creating new entities
- Uses localStorage for browser-specific history (no auth needed)
- Reuses existing S3 client and PDF rendering infrastructure
