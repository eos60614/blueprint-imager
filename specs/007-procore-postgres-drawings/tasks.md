# Tasks: Procore-PostgreSQL Drawings Integration

**Input**: Design documents from `/specs/007-procore-postgres-drawings/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/procore-browse-api.yaml

**Tests**: Not explicitly requested in specification - test tasks omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app structure**: `src/` (backend at repo root), `frontend/src/` (frontend)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and environment configuration

- [x] T001 Add Procore database environment variables to src/config.py (PROCORE_DB_HOST, PROCORE_DB_PORT, PROCORE_DB_NAME, PROCORE_DB_USER, PROCORE_DB_PASSWORD, PROCORE_S3_BUCKET)
- [x] T002 [P] Update .env.example with new Procore database and S3 configuration variables
- [x] T003 [P] Add psycopg2-binary to requirements.txt if not present

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T004 Create ProcoreDBClient with connection pooling in src/services/procore_db_client.py (ThreadedConnectionPool, read-only enforcement, context manager for cursor)
- [x] T005 Create ProcoreProject dataclass model in src/models/procore_drawing.py
- [x] T006 Create ProcoreDrawing dataclass model in src/models/procore_drawing.py (with has_file property, display_name property, from_row classmethod)
- [x] T007 Create ProcoreDrawingList dataclass for paginated responses in src/models/procore_drawing.py
- [x] T008 [P] Create Pydantic request/response models (ProjectResponse, ListProjectsResponse, DrawingResponse, ListDrawingsResponse) in src/api/procore_browse.py
- [x] T009 [P] Create TypeScript types (ProcoreProject, ProcoreDrawing, ListProjectsResponse, ListDrawingsResponse) in frontend/src/types/procore.ts
- [x] T010 Register procore_browse router in src/api/__init__.py or main application entry point

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Browse M-Series Drawings from Database (Priority: P1) 🎯 MVP

**Goal**: Enable users to view and filter M-series (mechanical) drawings from the PostgreSQL database with project context

**Independent Test**: Query drawings where `discipline = 'M'` and verify they display in a list with drawing number, title, and project name

### Implementation for User Story 1

- [x] T011 [US1] Implement list_projects() method in ProcoreDBClient to query active projects in src/services/procore_db_client.py
- [x] T012 [US1] Implement list_drawings() method in ProcoreDBClient with pagination, project_id filter, and search in src/services/procore_db_client.py
- [x] T013 [US1] Implement GET /api/procore/projects endpoint in src/api/procore_browse.py
- [x] T014 [US1] Implement GET /api/procore/drawings endpoint with query params (project_id, search, page, limit) in src/api/procore_browse.py
- [x] T015 [US1] Implement GET /api/procore/drawings/{drawing_id} endpoint for single drawing details in src/api/procore_browse.py
- [x] T016 [P] [US1] Create useDrawings SWR hook in frontend/src/hooks/useDrawings.ts
- [x] T017 [P] [US1] Create useProjects SWR hook in frontend/src/hooks/useProjects.ts
- [x] T018 [US1] Create DrawingList component in frontend/src/components/DrawingList/DrawingList.tsx (displays drawing number, title, project name, revision, file availability)
- [x] T019 [US1] Create DrawingFilters component in frontend/src/components/DrawingFilters/DrawingFilters.tsx (project dropdown, search input)
- [x] T020 [US1] Create /browse page in frontend/src/app/browse/page.tsx integrating DrawingFilters and DrawingList with pagination
- [x] T021 [US1] Add error handling for database connection failures with 503 status and user-friendly messages in src/api/procore_browse.py
- [x] T022 [US1] Add navigation link to /browse in frontend header/navigation component

**Checkpoint**: At this point, User Story 1 should be fully functional - users can browse and filter M-series drawings from the database

---

## Phase 4: User Story 2 - Download Drawing Files for Processing (Priority: P2)

**Goal**: Enable retrieval of drawing PDF files from S3 (referenced by s3_key in drawing_revisions) for processing

**Independent Test**: Select a drawing revision with valid s3_key and verify the PDF file downloads successfully from S3

### Implementation for User Story 2

- [x] T023 [US2] Implement get_drawing_with_s3_key() method in ProcoreDBClient to retrieve drawing with s3_key in src/services/procore_db_client.py
- [x] T024 [US2] Extend S3Client usage to support PROCORE_S3_BUCKET for downloading Procore drawing files in src/services/s3_client.py (verify bucket_name parameter works)
- [x] T025 [US2] Implement validate_drawings_have_files() function to check all selected drawings have s3_key in src/services/procore_db_client.py
- [x] T026 [US2] Add visual indicator for drawings without files (null s3_key) in DrawingList component frontend/src/components/DrawingList/DrawingList.tsx
- [x] T027 [US2] Disable selection of drawings without files in the UI frontend/src/components/DrawingList/DrawingList.tsx

**Checkpoint**: At this point, User Stories 1 AND 2 should both work - users can browse drawings AND the system can identify which have downloadable files

---

## Phase 5: User Story 3 - Process Drawings Through Tile Pipeline (Priority: P3)

**Goal**: Enable users to send selected drawings to the existing conversion pipeline (600 DPI, 1920x1920 tiles) and download results

**Independent Test**: Select drawings from browse interface, initiate conversion, and verify tiles are generated and downloadable as ZIP

### Implementation for User Story 3

- [x] T028 [US3] Create ProcessDrawingsRequest and ProcessDrawingsResponse Pydantic models in src/api/procore_browse.py
- [x] T029 [US3] Add procore_drawing_ids and procore_s3_keys columns to jobs table (JSON columns for batch tracking)
- [x] T030 [US3] Implement create_procore_job() function in src/services/job_service.py to create jobs with source='procore'
- [x] T031 [US3] Implement process_procore_drawings() background task in src/services/job_service.py (download from Procore S3, process through existing tile pipeline)
- [x] T032 [US3] Implement POST /api/procore/process endpoint in src/api/procore_browse.py (validate 1-10 drawings, all have s3_key, create job)
- [x] T033 [P] [US3] Create ProcessDrawingsRequest TypeScript type in frontend/src/types/procore.ts
- [x] T034 [P] [US3] Create ProcessDrawingsResponse TypeScript type in frontend/src/types/procore.ts
- [x] T035 [US3] Create DrawingProcessButton component in frontend/src/components/DrawingProcessButton/DrawingProcessButton.tsx (batch selection, process trigger)
- [x] T036 [US3] Add drawing selection state management to /browse page frontend/src/app/browse/page.tsx
- [x] T037 [US3] Integrate ProcessingStatus component for job progress display on /browse page frontend/src/app/browse/page.tsx
- [x] T038 [US3] Integrate DownloadButton component for ZIP download on /browse page frontend/src/app/browse/page.tsx
- [x] T039 [US3] Add validation error messages for batch limits (max 10) and missing files in frontend/src/components/DrawingProcessButton/DrawingProcessButton.tsx

**Checkpoint**: All user stories should now be independently functional - users can browse, filter, select, process, and download tiles

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T040 [P] Add connection retry with exponential backoff to ProcoreDBClient in src/services/procore_db_client.py
- [x] T041 [P] Add logging for Procore database queries and S3 downloads in src/services/procore_db_client.py
- [x] T042 [P] Add loading states and skeleton UI to DrawingList component frontend/src/components/DrawingList/DrawingList.tsx
- [x] T043 [P] Add empty state UI when no drawings match filters frontend/src/components/DrawingList/DrawingList.tsx
- [x] T044 Run quickstart.md validation - verify all API endpoints work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Builds on US1 components but can be tested independently
- **User Story 3 (P3)**: Depends on US1 (browse) and US2 (file availability) for full integration, but core backend processing can start after Foundational

### Within Each User Story

- Backend before frontend (data models → services → API → hooks → components → pages)
- Core implementation before error handling
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel (T002, T003)
- All Foundational tasks marked [P] can run in parallel (T008, T009)
- Frontend hooks for US1 can run in parallel (T016, T017)
- TypeScript types for US3 can run in parallel (T033, T034)
- All Polish tasks marked [P] can run in parallel (T040, T041, T042, T043)

---

## Parallel Example: User Story 1 Frontend

```bash
# Launch frontend hooks for User Story 1 together:
Task: "Create useDrawings SWR hook in frontend/src/hooks/useDrawings.ts"
Task: "Create useProjects SWR hook in frontend/src/hooks/useProjects.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001-T003)
2. Complete Phase 2: Foundational (T004-T010) - CRITICAL
3. Complete Phase 3: User Story 1 (T011-T022)
4. **STOP and VALIDATE**: Users can browse and filter M-series drawings from the database
5. Deploy/demo if ready - this is a working MVP

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (file availability visible)
4. Add User Story 3 → Test independently → Deploy/Demo (full processing workflow)
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 backend (T011-T015, T021)
   - Developer B: User Story 1 frontend (T016-T020, T022)
3. After US1 complete:
   - Developer A: User Story 2 + 3 backend
   - Developer B: User Story 2 + 3 frontend

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- External PostgreSQL is READ-ONLY - no INSERT/UPDATE/DELETE
- Maximum 10 drawings per batch job (FR-012)
- Performance target: <2 seconds for browsing 1,000 drawings

---

## Summary

| Phase | Task Count | Description |
|-------|------------|-------------|
| Phase 1: Setup | 3 | Environment configuration |
| Phase 2: Foundational | 7 | Core infrastructure, models, types |
| Phase 3: User Story 1 | 12 | Browse M-series drawings (MVP) |
| Phase 4: User Story 2 | 5 | File availability and download |
| Phase 5: User Story 3 | 12 | Processing pipeline integration |
| Phase 6: Polish | 5 | Error handling, UX improvements |
| **Total** | **44** | |

### Independent Test Criteria

- **US1**: Display list of M-series drawings with project context, filtering works
- **US2**: Drawings with/without files are visually distinguished
- **US3**: Selected drawings process and tiles are downloadable as ZIP

### Suggested MVP Scope

**User Story 1 only** (20 tasks total including Setup + Foundational):
- Users can browse and filter M-series drawings from the Procore PostgreSQL database
- Project dropdown and search functionality
- Pagination for large result sets
