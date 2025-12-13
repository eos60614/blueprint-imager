# Implementation Plan: PDF Upload Frontend with Page Selection

**Branch**: `002-i-want-to` | **Date**: 2025-12-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/002-i-want-to/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a Vercel-hosted frontend that allows users to upload PDF files, specify which pages contain mechanical drawings (via ranges like "1-10" or individual pages "3, 7, 15"), preview page thumbnails, and submit selected pages for processing by the existing Python/FastAPI backend. Uploads go directly to AWS S3 via presigned URLs to avoid Vercel's request size limits. The frontend displays conversion progress and provides ZIP download when complete.

## Technical Context

**Frontend Stack**:
- **Language/Version**: TypeScript 5.x with React 18+ (Next.js 14)
- **Framework**: Next.js 14 (App Router) deployed on Vercel
- **Styling**: Tailwind CSS
- **PDF Rendering**: pdf.js for client-side thumbnail generation
- **File Upload**: Direct-to-S3 via presigned URLs (react-dropzone for UI)
- **State Management**: React hooks + Context (zustand if complexity grows)
- **HTTP Client**: fetch API with SWR for data fetching

**Backend Stack** (existing):
- **Language/Version**: Python 3.11+
- **Framework**: FastAPI
- **PDF Processing**: pdf2image with Poppler (600 DPI)
- **Image Processing**: Pillow (1920×1920 tiles, 250px overlap)
- **Database**: SQLite
- **Storage**: AWS S3 (new - for uploaded PDFs and generated images)

**Testing**:
- Frontend: Vitest + React Testing Library, Playwright for E2E
- Backend: pytest (existing)

**Target Platform**: Modern desktop browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (frontend + backend)
**Performance Goals**: No specific speed requirements; quality over performance
**Constraints**: 100MB max PDF upload, Vercel request limits (50MB body, 10s edge timeout)
**Scale/Scope**: Single-user anonymous uploads, no authentication

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Note**: The project constitution is a template with placeholder values. No specific gates are defined.

| Principle | Status | Notes |
|-----------|--------|-------|
| N/A | PASS | Constitution not yet configured for this project |

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
# Backend (existing - Python/FastAPI)
src/
├── models/           # Data models (drawing, image, job)
├── services/         # Core logic (pdf_processor, image_tiler, procore_client)
├── api/              # FastAPI endpoints
└── cli/              # Command-line interface

tests/
├── contract/
├── integration/
└── unit/

# Frontend (new - Next.js)
frontend/
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── page.tsx      # Main upload page
│   │   ├── layout.tsx    # Root layout
│   │   └── api/          # API routes (presigned URL generation)
│   ├── components/       # React components
│   │   ├── FileUpload/   # Drag-drop upload
│   │   ├── PageSelector/ # Page range/individual selection
│   │   ├── ThumbnailGrid/# PDF page previews
│   │   └── ProcessingStatus/ # Job progress display
│   ├── lib/              # Utility functions
│   │   ├── api-client.ts # Backend API wrapper
│   │   ├── pdf-utils.ts  # pdf.js helpers
│   │   └── page-parser.ts# Page range parsing
│   └── types/            # TypeScript type definitions
├── public/               # Static assets
├── tests/
│   ├── unit/             # Vitest unit tests
│   └── e2e/              # Playwright E2E tests
├── package.json
├── next.config.js
├── tailwind.config.js
└── tsconfig.json
```

**Structure Decision**: Web application with separate frontend and backend directories. The existing Python backend (`src/`) remains unchanged. A new `frontend/` directory contains the Next.js application. This separation allows independent deployment (frontend to Vercel, backend stays on current infrastructure) and clear ownership boundaries.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

No violations - constitution is not yet configured.
