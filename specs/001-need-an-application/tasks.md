# Tasks: PDF Drawing to Image Converter for YOLO Training

**Input**: Design documents from `/specs/001-need-an-application/`
**Prerequisites**: plan.md (required), research.md, data-model.md, contracts/

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → If not found: ERROR "No implementation plan found"
   → Extract: tech stack, libraries, structure
2. Load optional design documents:
   → data-model.md: Extract entities → model tasks
   → contracts/: Each file → contract test task
   → research.md: Extract decisions → setup tasks
3. Generate tasks by category:
   → Setup: project init, dependencies, linting
   → Tests: contract tests, integration tests
   → Core: models, services, CLI commands
   → Integration: DB, middleware, logging
   → Polish: unit tests, performance, docs
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001, T002...)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All contracts have tests?
   → All entities have models?
   → All endpoints implemented?
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Paths shown below assume single project structure from plan.md

## Phase 3.1: Setup
- [ ] T001 Create project structure per implementation plan (src/models/, src/services/, src/cli/, src/lib/, tests/)
- [ ] T002 Initialize Python project with requirements.txt (FastAPI, pdf2image, Pillow, Click, httpx, python-multipart, pytest, SQLAlchemy)
- [ ] T003 [P] Create .env.example with Procore OAuth credentials and app settings
- [ ] T004 [P] Configure pytest.ini and setup.py for testing
- [ ] T005 [P] Create __init__.py files in all package directories

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (API Endpoints)
- [ ] T006 [P] Contract test POST /upload in tests/contract/test_upload_endpoint.py
- [ ] T007 [P] Contract test GET /procore/auth in tests/contract/test_procore_auth.py
- [ ] T008 [P] Contract test GET /procore/callback in tests/contract/test_procore_callback.py
- [ ] T009 [P] Contract test GET /procore/drawings in tests/contract/test_procore_drawings.py
- [ ] T010 [P] Contract test POST /convert in tests/contract/test_convert_endpoint.py
- [ ] T011 [P] Contract test GET /status/{job_id} in tests/contract/test_status_endpoint.py
- [ ] T012 [P] Contract test GET /download/{job_id} in tests/contract/test_download_endpoint.py
- [ ] T013 [P] Contract test DELETE /documents/{document_id} in tests/contract/test_delete_document.py

### Integration Tests (User Workflows)
- [ ] T014 [P] Integration test PDF upload and conversion in tests/integration/test_pdf_conversion.py
- [ ] T015 [P] Integration test image tiling with overlap in tests/integration/test_image_tiling.py
- [ ] T016 [P] Integration test Procore OAuth flow in tests/integration/test_procore_integration.py
- [ ] T017 [P] Integration test M-series filtering from Procore in tests/integration/test_m_series_filter.py
- [ ] T018 [P] Integration test ZIP file generation in tests/integration/test_zip_generation.py
- [ ] T019 [P] Integration test job status tracking in tests/integration/test_job_tracking.py

## Phase 3.3: Core Implementation (ONLY after tests are failing)

### Data Models
- [ ] T020 [P] DrawingSource model in src/models/drawing.py (id, type, procore_project_id, metadata)
- [ ] T021 [P] PDFDocument model in src/models/drawing.py (id, source_id, filename, page_count, status)
- [ ] T022 [P] ConvertedImage model in src/models/image.py (id, document_id, page_number, file_path, dpi)
- [ ] T023 [P] ImageTile model in src/models/image.py (id, image_id, tile_index, x_position, y_position)
- [ ] T024 [P] ConversionJob model in src/models/job.py (id, status, total_documents, progress)
- [ ] T025 [P] Database schema and migrations in src/models/database.py (SQLite setup)

### Services
- [ ] T026 [P] PDF processor service in src/services/pdf_processor.py (convert_pdf_to_images at 600 DPI)
- [ ] T027 [P] Image tiler service in src/services/image_tiler.py (tile_image with 1920x1920 and 250px overlap)
- [ ] T028 [P] Procore client service in src/services/procore_client.py (OAuth, fetch drawings, filter M-series)
- [ ] T029 [P] Job manager service in src/services/job_manager.py (create job, update status, track progress)
- [ ] T030 [P] Storage service in src/services/storage.py (save files, create directories, manage paths)
- [ ] T031 [P] ZIP generator service in src/services/zip_generator.py (create ZIP archives with compression)

### CLI Commands
- [ ] T032 CLI main entry point in src/cli/main.py (Click application setup)
- [ ] T033 CLI init-db command in src/cli/main.py (initialize SQLite database)
- [ ] T034 CLI convert command in src/cli/main.py (convert single PDF)
- [ ] T035 CLI procore-auth command in src/cli/main.py (OAuth authentication)
- [ ] T036 CLI procore-list command in src/cli/main.py (list M-series drawings)
- [ ] T037 CLI procore-convert command in src/cli/main.py (batch convert from Procore)
- [ ] T038 CLI serve command in src/cli/main.py (start FastAPI server)

### API Endpoints
- [ ] T039 FastAPI app setup in src/api/main.py (app initialization, middleware)
- [ ] T040 POST /upload endpoint in src/api/endpoints/upload.py
- [ ] T041 GET /procore/auth endpoint in src/api/endpoints/procore.py
- [ ] T042 GET /procore/callback endpoint in src/api/endpoints/procore.py
- [ ] T043 GET /procore/drawings endpoint in src/api/endpoints/procore.py
- [ ] T044 POST /convert endpoint in src/api/endpoints/convert.py
- [ ] T045 GET /status/{job_id} endpoint in src/api/endpoints/status.py
- [ ] T046 GET /download/{job_id} endpoint in src/api/endpoints/download.py
- [ ] T047 DELETE /documents/{document_id} endpoint in src/api/endpoints/documents.py

## Phase 3.4: Integration
- [ ] T048 Connect all services to SQLite database
- [ ] T049 Add structured JSON logging in src/lib/logging.py
- [ ] T050 Add error handling middleware in src/api/middleware.py
- [ ] T051 Add CORS configuration in src/api/main.py
- [ ] T052 Add file size validation (MAX_FILE_SIZE_MB from .env)
- [ ] T053 Add progress tracking for long-running operations
- [ ] T054 Add cleanup for temporary files

## Phase 3.5: Polish
- [ ] T055 [P] Unit tests for PDF processor in tests/unit/test_pdf_processor.py
- [ ] T056 [P] Unit tests for image tiler in tests/unit/test_image_tiler.py
- [ ] T057 [P] Unit tests for models validation in tests/unit/test_models.py
- [ ] T058 [P] Unit tests for ZIP generator in tests/unit/test_zip_generator.py
- [ ] T059 Performance test for large PDF processing (100+ pages)
- [ ] T060 [P] Create API documentation in docs/api.md
- [ ] T061 [P] Create deployment guide in docs/deployment.md
- [ ] T062 Run quickstart.md validation checklist
- [ ] T063 Add sample PDF fixtures in tests/fixtures/

## Dependencies
- Setup (T001-T005) must complete first
- Tests (T006-T019) before implementation (T020-T047)
- Models (T020-T025) before services (T026-T031)
- Services before endpoints (T039-T047)
- CLI commands (T032-T038) can parallel with API endpoints
- Integration (T048-T054) after core implementation
- Polish (T055-T063) last

## Parallel Execution Examples

### Launch all contract tests together:
```
Task: "Contract test POST /upload in tests/contract/test_upload_endpoint.py"
Task: "Contract test GET /procore/auth in tests/contract/test_procore_auth.py"
Task: "Contract test GET /procore/callback in tests/contract/test_procore_callback.py"
Task: "Contract test GET /procore/drawings in tests/contract/test_procore_drawings.py"
Task: "Contract test POST /convert in tests/contract/test_convert_endpoint.py"
Task: "Contract test GET /status/{job_id} in tests/contract/test_status_endpoint.py"
Task: "Contract test GET /download/{job_id} in tests/contract/test_download_endpoint.py"
Task: "Contract test DELETE /documents/{document_id} in tests/contract/test_delete_document.py"
```

### Launch all models together:
```
Task: "DrawingSource model in src/models/drawing.py"
Task: "PDFDocument model in src/models/drawing.py"
Task: "ConvertedImage model in src/models/image.py"
Task: "ImageTile model in src/models/image.py"
Task: "ConversionJob model in src/models/job.py"
Task: "Database schema in src/models/database.py"
```

### Launch all services together:
```
Task: "PDF processor service in src/services/pdf_processor.py"
Task: "Image tiler service in src/services/image_tiler.py"
Task: "Procore client service in src/services/procore_client.py"
Task: "Job manager service in src/services/job_manager.py"
Task: "Storage service in src/services/storage.py"
Task: "ZIP generator service in src/services/zip_generator.py"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify tests fail before implementing
- Commit after each task with descriptive message
- Use 600 DPI for all PDF conversions
- Maintain 1920×1920 tile size with 250px overlap
- All images must be PNG RGB format

## Validation Checklist
*GATE: Checked before execution*

- [x] All contracts have corresponding tests (T006-T013)
- [x] All entities have model tasks (T020-T024)
- [x] All tests come before implementation
- [x] Parallel tasks truly independent
- [x] Each task specifies exact file path
- [x] No task modifies same file as another [P] task
- [x] All API endpoints from OpenAPI spec covered
- [x] All user stories have integration tests

---
*Generated from design documents on 2025-09-12*