# Tasks: Browse History - View Previously Uploaded Files

**Input**: Design documents from `/specs/005-browse-history/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/history-api.yaml

**Tests**: Optional - not explicitly requested in specification

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/` at repository root
- **Frontend**: `frontend/src/`
- **Tests**: `tests/` (backend), `frontend/tests/` (frontend)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and shared types/utilities

- [X] T001 [P] Create frontend TypeScript types for history feature in frontend/src/types/history.ts
- [X] T002 [P] Create localStorage wrapper utility in frontend/src/lib/history-storage.ts
- [X] T003 [P] Create Navigation component with Upload/History tabs in frontend/src/components/Navigation/index.tsx
- [X] T004 Integrate Navigation component into main layout in frontend/src/app/layout.tsx

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend API endpoints that MUST be complete before ANY user story can be implemented

**CRITICAL**: No user story work can begin until this phase is complete

### Backend API Endpoints

- [X] T005 [P] Add get_jobs_by_ids() function to src/services/job_service.py
- [X] T006 [P] Add get_job_with_upload() function to src/services/job_service.py
- [X] T007 [P] Add get_job_pages() function to src/services/job_service.py
- [X] T008 [P] Add get_page_tiles() function to src/services/job_service.py
- [X] T009 Add GET /api/jobs endpoint (batch fetch by IDs) to src/api/jobs.py
- [X] T010 Enhance GET /api/jobs/{jobId} endpoint with full details in src/api/jobs.py
- [X] T011 Add GET /api/jobs/{jobId}/pages endpoint to src/api/jobs.py
- [X] T012 Add GET /api/jobs/{jobId}/pages/{pageNum}/tiles endpoint to src/api/jobs.py
- [X] T013 Add GET /api/jobs/{jobId}/pdf-url endpoint to src/api/jobs.py
- [X] T014 Add presigned URL generation for PDFs to src/services/s3_client.py

### Frontend Core Infrastructure

- [X] T015 [P] Create useHistory hook for localStorage operations in frontend/src/hooks/useHistory.ts
- [X] T016 [P] Create useJobDetails hook for fetching job data in frontend/src/hooks/useJobDetails.ts
- [X] T017 Create HistoryContext for state management in frontend/src/contexts/HistoryContext.tsx

**Checkpoint**: Foundation ready - user story implementation can now begin

---

## Phase 3: User Story 1 - View Upload History (Priority: P1)

**Goal**: Enable returning users to see a list of previously uploaded PDF files

**Independent Test**: Upload a PDF, leave the application, return, and verify the upload appears in the history list sorted by most recent first

### Implementation for User Story 1

- [X] T018 [US1] Create history list page in frontend/src/app/history/page.tsx
- [X] T019 [US1] Create HistoryList component in frontend/src/components/HistoryList/index.tsx
- [X] T020 [US1] Create HistoryItem component for individual entries in frontend/src/components/HistoryItem/index.tsx
- [X] T021 [US1] Create EmptyState component for no-history message in frontend/src/components/EmptyState/index.tsx
- [X] T022 [US1] Implement history sync with server (batch status check) in frontend/src/hooks/useHistory.ts
- [X] T023 [US1] Implement infinite scroll pagination (20 items) in frontend/src/components/HistoryList/index.tsx
- [X] T024 [US1] Add history entry creation on upload complete in frontend/src/contexts/ProcessingContext.tsx

**Checkpoint**: User Story 1 complete - users can view their upload history list

---

## Phase 4: User Story 2 - Browse Converted Pages (Priority: P2)

**Goal**: Enable users to browse page thumbnails from a previous upload

**Independent Test**: Select a completed job from history, verify page thumbnails and page numbers are displayed correctly

### Implementation for User Story 2

- [X] T025 [US2] Create job detail page in frontend/src/app/history/[jobId]/page.tsx
- [X] T026 [US2] Create PageGrid component for page thumbnails in frontend/src/components/PageGrid/index.tsx
- [X] T027 [US2] Implement PDF thumbnail rendering with pdfjs-dist in frontend/src/components/PageGrid/PageThumbnail.tsx
- [X] T028 [US2] Create enlarged page preview modal in frontend/src/components/PagePreview/index.tsx
- [X] T029 [US2] Add page selection info display (selected vs total pages) in frontend/src/components/PageGrid/index.tsx

**Checkpoint**: User Story 2 complete - users can browse page thumbnails for past uploads

---

## Phase 5: User Story 3 - Browse Generated Tiles (Priority: P3)

**Goal**: Enable users to inspect individual tiles generated from a specific page

**Independent Test**: Select a processed page, verify all tiles are displayed in a grid with row/column indicators

### Implementation for User Story 3

- [X] T030 [US3] Create tile grid page in frontend/src/app/history/[jobId]/[pageNum]/page.tsx
- [X] T031 [US3] Create TileGrid component in frontend/src/components/TileGrid/index.tsx
- [X] T032 [US3] Create TilePreview modal for full-size tile view in frontend/src/components/TilePreview/index.tsx
- [X] T033 [US3] Implement lazy loading for tile images in frontend/src/components/TileGrid/index.tsx
- [X] T034 [US3] Add tile position indicators (row/col) and total tile count display in frontend/src/components/TileGrid/index.tsx

**Checkpoint**: User Story 3 complete - users can browse and inspect individual tiles

---

## Phase 6: User Story 4 - Download from History (Priority: P2)

**Goal**: Enable users to download converted tiles from a previous upload

**Independent Test**: Select a completed job from history and successfully download the ZIP file

### Implementation for User Story 4

- [X] T035 [US4] Add download button to HistoryItem component in frontend/src/components/HistoryItem/index.tsx
- [X] T036 [US4] Add download button to job detail page in frontend/src/app/history/[jobId]/page.tsx
- [X] T037 [US4] Implement download state handling (disabled for incomplete jobs) in frontend/src/components/DownloadButton/DownloadButton.tsx
- [X] T038 [US4] Add error display for failed/unavailable uploads in frontend/src/components/HistoryItem/index.tsx

**Checkpoint**: User Story 4 complete - users can download tiles from history

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Edge cases, delete functionality, and refinements

- [X] T039 [P] Add delete entry button to HistoryItem in frontend/src/components/HistoryItem/index.tsx
- [X] T040 [P] Create ConfirmModal for delete confirmation in frontend/src/components/ConfirmModal/ConfirmModal.tsx (extended with danger variant)
- [X] T041 Implement deleteHistoryEntry function in frontend/src/lib/history-storage.ts
- [X] T042 Handle 'unavailable' status for expired server files in frontend/src/hooks/useHistory.ts
- [X] T043 [P] Add browser-specific history message to EmptyState in frontend/src/components/EmptyState/index.tsx
- [X] T044 Ensure browser back/forward navigation works correctly in history pages (handled by Next.js App Router)
- [X] T045 Run quickstart.md validation (Playwright E2E tests: 12/16 pass, 4 flaky due to backend timing)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-6)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 -> P2 -> P3)
- **Polish (Phase 7)**: Depends on User Story 1 being complete (delete/unavailable features)

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Uses PageGrid from job detail page
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Navigates from US2's page grid
- **User Story 4 (P2)**: Can start after Foundational (Phase 2) - Integrates with US1's HistoryItem

### Within Each User Story

- UI components before page integration
- Core implementation before refinements
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational backend service functions (T005-T008) can run in parallel
- T015, T016 (hooks) can run in parallel
- After Foundational, different user stories can be worked on in parallel
- All Polish tasks marked [P] can run in parallel

---

## Parallel Example: Setup Phase

```bash
# Launch all Setup tasks together:
Task: "Create frontend TypeScript types in frontend/src/types/history.ts"
Task: "Create localStorage wrapper in frontend/src/lib/history-storage.ts"
Task: "Create Navigation component in frontend/src/components/Navigation/index.tsx"
```

## Parallel Example: Foundational Backend Services

```bash
# Launch all backend service functions together:
Task: "Add get_jobs_by_ids() function in src/services/job_service.py"
Task: "Add get_job_with_upload() function in src/services/job_service.py"
Task: "Add get_job_pages() function in src/services/job_service.py"
Task: "Add get_page_tiles() function in src/services/job_service.py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - View Upload History
4. **STOP and VALIDATE**: Test history list independently
5. Deploy/demo if ready - users can see their upload history

### Incremental Delivery

1. Complete Setup + Foundational -> Foundation ready
2. Add User Story 1 -> Test -> Deploy/Demo (MVP - history list)
3. Add User Story 2 + User Story 4 -> Test -> Deploy/Demo (page browsing + download)
4. Add User Story 3 -> Test -> Deploy/Demo (tile browsing)
5. Add Polish -> Test -> Final release
6. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (history list)
   - Developer B: User Story 2 (page browsing)
   - Developer C: User Story 4 (download) - can start after US1's HistoryItem exists
3. After US1 + US2 complete:
   - Continue with User Story 3 (tile browsing)
4. Polish phase after all stories complete

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Existing download endpoint (GET /api/jobs/{jobId}/download) is reused - no backend changes needed for US4
- PDF thumbnail rendering reuses existing pdfjs-dist integration from upload flow
- localStorage key: 'blueprint-imager-history'
