# Tasks: PDF Upload Frontend with Page Selection

**Input**: Design documents from `/specs/002-i-want-to/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/openapi.yaml

**Tests**: Not explicitly requested in spec - test tasks are not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/` at repository root (existing Python/FastAPI)
- **Frontend**: `frontend/` at repository root (new Next.js)
- **Tests**: `tests/` for backend, `frontend/tests/` for frontend

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization for frontend and backend extensions

- [x] T001 Create frontend directory structure per plan.md in frontend/
- [x] T002 Initialize Next.js 14 project with TypeScript in frontend/
- [x] T003 [P] Configure Tailwind CSS in frontend/tailwind.config.js
- [x] T004 [P] Configure TypeScript in frontend/tsconfig.json
- [x] T005 [P] Create Next.js configuration in frontend/next.config.js
- [x] T006 [P] Add frontend dependencies (pdfjs-dist, react-dropzone, swr, @aws-sdk/client-s3) to frontend/package.json
- [x] T007 [P] Create environment configuration files frontend/.env.local.example and backend .env.example updates
- [x] T008 [P] Add boto3 dependency to backend requirements.txt

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Backend Foundations

- [x] T009 Create S3 service client in src/services/s3_client.py with presigned URL generation
- [x] T010 Create database migrations for uploads table in src/models/upload.py
- [x] T011 Extend jobs table with source, upload_id, selected_pages columns in src/models/job.py
- [x] T012 Create job_pages table model in src/models/job_page.py
- [x] T013 Update database initialization in src/cli/main.py for new tables
- [x] T014 Configure CORS middleware for frontend domains in src/api/main.py

### Frontend Foundations

- [x] T015 [P] Create root layout with Tailwind in frontend/src/app/layout.tsx
- [x] T016 [P] Create TypeScript types for API models in frontend/src/types/api.ts
- [x] T017 [P] Create TypeScript types for frontend state in frontend/src/types/state.ts
- [x] T018 Create API client wrapper in frontend/src/lib/api-client.ts
- [x] T019 Create environment configuration in frontend/src/lib/config.ts

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - File Upload (Priority: P1) MVP

**Goal**: Users can select and upload PDF files directly to S3 with progress tracking

**Independent Test**: Upload a PDF file, verify it appears in S3 bucket with correct key

### Backend Implementation for US1

- [x] T020 [US1] Implement POST /api/upload/presign endpoint in src/api/upload.py
- [x] T021 [US1] Add file validation (PDF type, 100MB limit) in src/api/upload.py
- [x] T022 [US1] Implement POST /api/upload/complete endpoint in src/api/upload.py
- [x] T023 [US1] Add PDF page count extraction using pdf2image in src/services/pdf_processor.py
- [x] T024 [US1] Register upload routes in src/api/main.py

### Frontend Implementation for US1

- [x] T025 [P] [US1] Create FileUpload component with react-dropzone in frontend/src/components/FileUpload/FileUpload.tsx
- [x] T026 [P] [US1] Create FileUpload styles in frontend/src/components/FileUpload/FileUpload.module.css
- [x] T027 [US1] Implement S3 direct upload with progress tracking in frontend/src/lib/s3-upload.ts
- [x] T028 [US1] Create upload progress bar component in frontend/src/components/FileUpload/ProgressBar.tsx
- [x] T029 [US1] Add file type validation (PDF only) in frontend/src/lib/validators.ts
- [x] T030 [US1] Add file size validation (100MB max) in frontend/src/lib/validators.ts
- [x] T031 [US1] Create upload state context in frontend/src/contexts/UploadContext.tsx
- [x] T032 [US1] Integrate FileUpload into main page in frontend/src/app/page.tsx
- [x] T033 [US1] Add error display for upload failures in frontend/src/components/FileUpload/ErrorMessage.tsx

**Checkpoint**: File upload flow complete - can upload PDFs to S3 and get page count

---

## Phase 4: User Story 2 - Page Selection (Priority: P2)

**Goal**: Users can view PDF thumbnails and select pages via ranges or individual numbers

**Independent Test**: After upload, view all page thumbnails, enter "1-5, 8, 12" and verify correct pages are highlighted

**Depends on**: US1 (needs uploaded PDF and page count)

### Frontend Implementation for US2

- [x] T034 [P] [US2] Create page range parser utility in frontend/src/lib/page-parser.ts
- [x] T035 [P] [US2] Create page range parser tests in frontend/tests/unit/page-parser.test.ts
- [x] T036 [US2] Create pdf.js initialization and worker setup in frontend/src/lib/pdf-utils.ts
- [x] T037 [US2] Create thumbnail renderer using pdf.js canvas in frontend/src/lib/pdf-utils.ts
- [x] T038 [P] [US2] Create ThumbnailGrid component in frontend/src/components/ThumbnailGrid/ThumbnailGrid.tsx
- [x] T039 [P] [US2] Create individual Thumbnail component in frontend/src/components/ThumbnailGrid/Thumbnail.tsx
- [x] T040 [US2] Add lazy loading for thumbnails (load visible pages first) in frontend/src/components/ThumbnailGrid/ThumbnailGrid.tsx
- [x] T041 [P] [US2] Create PageSelector input component in frontend/src/components/PageSelector/PageSelector.tsx
- [x] T042 [US2] Add validation error display for invalid ranges in frontend/src/components/PageSelector/ValidationError.tsx
- [x] T043 [US2] Create page selection state context in frontend/src/contexts/SelectionContext.tsx
- [x] T044 [US2] Add visual highlighting of selected pages in ThumbnailGrid in frontend/src/components/ThumbnailGrid/Thumbnail.tsx
- [x] T045 [US2] Integrate PageSelector and ThumbnailGrid into main page in frontend/src/app/page.tsx
- [x] T046 [US2] Add page selection syntax help text in frontend/src/components/PageSelector/HelpText.tsx

**Checkpoint**: Page selection complete - can view thumbnails and select pages with validation

---

## Phase 5: User Story 3 - Processing & Download (Priority: P3)

**Goal**: Users can submit selected pages for conversion and download results as ZIP

**Independent Test**: Submit selected pages, wait for processing, download ZIP containing correct tiles

**Depends on**: US1 (upload), US2 (page selection)

### Backend Implementation for US3

- [x] T047 [US3] Implement POST /api/convert/pages endpoint in src/api/convert.py
- [x] T048 [US3] Add page selection validation in src/api/convert.py
- [x] T049 [US3] Create job with selected pages in src/services/job_service.py
- [x] T050 [US3] Implement per-page processing with status updates in src/services/pdf_processor.py
- [x] T051 [US3] Upload tiles to S3 output folder in src/services/s3_client.py
- [x] T052 [US3] Implement GET /api/jobs/{jobId} status endpoint in src/api/jobs.py
- [x] T053 [US3] Calculate progress percentage from job_pages in src/services/job_service.py
- [x] T054 [US3] Implement ZIP generation from S3 tiles in src/api/jobs.py
- [x] T055 [US3] Implement GET /api/jobs/{jobId}/download endpoint in src/api/jobs.py
- [x] T056 [US3] Generate presigned download URL for ZIP in src/services/s3_client.py
- [x] T057 [US3] Register convert and jobs routes in src/api/main.py

### Frontend Implementation for US3

- [x] T058 [P] [US3] Create ProcessingStatus component in frontend/src/components/ProcessingStatus/ProcessingStatus.tsx
- [x] T059 [P] [US3] Create progress indicator with percentage in frontend/src/components/ProcessingStatus/ProgressIndicator.tsx
- [x] T060 [US3] Implement job status polling using SWR in frontend/src/hooks/useJobStatus.ts
- [x] T061 [US3] Create submit button with disabled state in frontend/src/components/SubmitButton/SubmitButton.tsx
- [x] T062 [US3] Create download button component in frontend/src/components/DownloadButton/DownloadButton.tsx
- [x] T063 [US3] Add error display for processing failures in frontend/src/components/ProcessingStatus/ErrorDisplay.tsx
- [x] T064 [US3] Create processing state context in frontend/src/contexts/ProcessingContext.tsx
- [x] T065 [US3] Integrate processing flow into main page in frontend/src/app/page.tsx

**Checkpoint**: Full workflow complete - can upload, select pages, process, and download

---

## Phase 6: User Story 4 - User Experience Polish (Priority: P4)

**Goal**: Clear instructions, confirmation dialogs, and polished UX

**Independent Test**: Complete full workflow as new user, verify all instructions are clear

**Depends on**: US1, US2, US3 (core workflow)

### Frontend Implementation for US4

- [x] T066 [P] [US4] Create instructions panel with page selection syntax help in frontend/src/components/Instructions/Instructions.tsx
- [x] T067 [US4] Add submission confirmation modal in frontend/src/components/ConfirmModal/ConfirmModal.tsx
- [x] T068 [US4] Add loading states to all interactive elements in frontend/src/components/
- [x] T069 [US4] Add keyboard navigation support (Enter to submit) in frontend/src/app/page.tsx
- [x] T070 [US4] Create responsive layout for desktop screens in frontend/src/app/page.tsx
- [x] T071 [US4] Add favicon and page title in frontend/src/app/layout.tsx

**Checkpoint**: Polished UX ready for deployment

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, validation, and deployment preparation

- [ ] T072 Run backend API health check validation per quickstart.md
- [x] T073 Run frontend validation checklist per quickstart.md (frontend builds successfully)
- [ ] T074 Test end-to-end workflow with sample PDF per quickstart.md
- [x] T075 [P] Configure Vercel deployment settings in frontend/vercel.json
- [x] T076 [P] Update CLAUDE.md with final development commands
- [ ] T077 Verify S3 CORS configuration for production domain

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (needs page count from uploaded PDF)
- **User Story 3 (P3)**: Depends on US1 (upload) and US2 (page selection)
- **User Story 4 (P4)**: Depends on US1, US2, US3 (needs core workflow complete)

### Within Each User Story

- Backend endpoints should be implemented before frontend integration
- Models before services
- Services before endpoints
- Core implementation before polish

### Parallel Opportunities

**Phase 1 (Setup):**
```
T003, T004, T005, T006, T007, T008 can all run in parallel
```

**Phase 2 (Foundational):**
```
Backend: T009 → T010, T011, T012 (parallel) → T013 → T014
Frontend: T015, T016, T017 (parallel) → T018 → T019
Backend and Frontend tracks can run in parallel
```

**Phase 3 (US1):**
```
Backend: T020 → T021 → T022 → T023 → T024
Frontend: T025, T026 (parallel) → T027 → T028 → T029, T030 (parallel) → T031 → T032 → T033
Backend endpoints must be ready before frontend integration (T032)
```

**Phase 4 (US2):**
```
T034, T035 (parallel) → T036 → T037
T038, T039 (parallel) → T040
T041, T042 (parallel) → T043 → T044 → T045 → T046
```

**Phase 5 (US3):**
```
Backend: T047 → T048 → T049 → T050 → T051 → T052 → T053 → T054 → T055 → T056 → T057
Frontend: T058, T059 (parallel) → T060 → T061 → T062 → T063 → T064 → T065
Backend endpoints must be ready before frontend polling (T060)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test file upload independently
5. Continue to US2 if MVP validated

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → File upload works (MVP!)
3. Add User Story 2 → Test independently → Page selection works
4. Add User Story 3 → Test independently → Full workflow works
5. Add User Story 4 → Test independently → Polished UX
6. Each story adds value without breaking previous stories

### Suggested MVP Scope

**MVP = User Story 1 (File Upload) only**
- Users can upload PDFs to S3
- Backend confirms upload and returns page count
- Foundation for all subsequent features

---

## Summary

| Category | Count |
|----------|-------|
| **Total Tasks** | 77 |
| **Phase 1 (Setup)** | 8 |
| **Phase 2 (Foundational)** | 11 |
| **Phase 3 (US1 - File Upload)** | 14 |
| **Phase 4 (US2 - Page Selection)** | 13 |
| **Phase 5 (US3 - Processing)** | 19 |
| **Phase 6 (US4 - UX Polish)** | 6 |
| **Phase 7 (Polish)** | 6 |
| **Parallelizable Tasks** | 32 |

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Backend and frontend tracks can often run in parallel within a phase
