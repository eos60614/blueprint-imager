# Implementation Plan: PDF Drawing to Image Converter for YOLO Training

**Branch**: `001-need-an-application` | **Date**: 2025-09-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-need-an-application/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → If not found: ERROR "No feature spec at {path}"
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Detect Project Type from context (web=frontend+backend, mobile=app+api)
   → Set Structure Decision based on project type
3. Evaluate Constitution Check section below
   → If violations exist: Document in Complexity Tracking
   → If no justification possible: ERROR "Simplify approach first"
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → If NEEDS CLARIFICATION remain: ERROR "Resolve unknowns"
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, agent-specific template file (e.g., `CLAUDE.md` for Claude Code, `.github/copilot-instructions.md` for GitHub Copilot, or `GEMINI.md` for Gemini CLI).
6. Re-evaluate Constitution Check section
   → If new violations: Refactor design, return to Phase 1
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Build a Python-based application that converts PDF mechanical drawings (M-series from Procore and manual uploads) into tiled PNG images optimized for YOLO training. The system will rasterize PDFs at 600 DPI, generate 1920×1920 pixel tiles with 13% overlap, integrate with Procore via OAuth, and provide bulk ZIP downloads of processed images.

## Technical Context
**Language/Version**: Python 3.11+  
**Primary Dependencies**: pdf2image, Pillow, FastAPI, httpx, python-multipart  
**Storage**: Local filesystem for images, SQLite for job tracking  
**Testing**: pytest with real PDF fixtures  
**Target Platform**: Linux server (Ubuntu 22.04+)  
**Project Type**: single - CLI tool with optional API  
**Performance Goals**: Quality over speed, overnight batch processing acceptable  
**Constraints**: 600 DPI quality must be maintained, no resize blur  
**Scale/Scope**: Handle hundreds of PDFs, thousands of pages per batch

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (single Python application)
- Using framework directly? Yes (FastAPI for API, Click for CLI)
- Single data model? Yes (unified models for all components)
- Avoiding patterns? Yes (no unnecessary abstractions)

**Architecture**:
- EVERY feature as library? Yes - pdf_processor, procore_client, image_tiler
- Libraries listed: 
  - pdf_processor: PDF to PNG conversion at 600 DPI
  - image_tiler: Create 1920×1920 tiles with overlap
  - procore_client: OAuth and API integration
  - job_manager: Track conversion jobs and status
- CLI per library: Each library exposes CLI commands
- Library docs: llms.txt format planned? Yes

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? Yes
- Git commits show tests before implementation? Yes
- Order: Contract→Integration→E2E→Unit strictly followed? Yes
- Real dependencies used? Yes (real PDFs, real image processing)
- Integration tests for: new libraries, contract changes, shared schemas? Yes
- FORBIDDEN: Implementation before test, skipping RED phase - Understood

**Observability**:
- Structured logging included? Yes (JSON format)
- Frontend logs → backend? N/A (no frontend initially)
- Error context sufficient? Yes (file paths, page numbers, error details)

**Versioning**:
- Version number assigned? 0.1.0
- BUILD increments on every change? Yes
- Breaking changes handled? Yes (versioned API endpoints)

## Project Structure

### Documentation (this feature)
```
specs/001-need-an-application/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Option 1: Single project (DEFAULT)
src/
├── models/
│   ├── __init__.py
│   ├── drawing.py       # Drawing source, PDF document models
│   ├── image.py         # Converted image, tile models
│   └── job.py           # Conversion job tracking
├── services/
│   ├── __init__.py
│   ├── pdf_processor.py # PDF to PNG conversion
│   ├── image_tiler.py   # Tiling with overlap
│   ├── procore_client.py # OAuth and API
│   └── job_manager.py   # Job orchestration
├── cli/
│   ├── __init__.py
│   └── main.py          # CLI commands
└── lib/
    ├── __init__.py
    └── utils.py         # Shared utilities

tests/
├── contract/
│   └── test_api_contracts.py
├── integration/
│   ├── test_pdf_conversion.py
│   ├── test_image_tiling.py
│   └── test_procore_integration.py
└── unit/
    └── test_models.py
```

**Structure Decision**: Option 1 (Single project) - This is a focused tool, not a multi-tier web application

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - PDF processing libraries for 600 DPI conversion
   - Procore API documentation and OAuth flow
   - Image tiling algorithms with overlap
   - YOLO training image requirements
   - ZIP file generation for bulk downloads

2. **Generate and dispatch research agents**:
   ```
   Task: "Research PDF to image conversion at 600 DPI in Python"
   Task: "Find Procore API documentation for drawing access"
   Task: "Research image tiling with overlap for ML training"
   Task: "Find YOLO image format requirements and best practices"
   Task: "Research efficient ZIP file generation for large image sets"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: pdf2image with poppler backend
   - Rationale: Handles 600 DPI, maintains quality
   - Alternatives considered: PyMuPDF, Wand

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - DrawingSource: origin, metadata
   - PDFDocument: file path, page count, status
   - ConvertedImage: source, page, format specs
   - ImageTile: position, overlap, parent image
   - ConversionJob: status, documents, outputs

2. **Generate API contracts** from functional requirements:
   - POST /upload - Upload PDF for conversion
   - GET /procore/drawings - List M-series drawings
   - POST /convert/{job_id} - Start conversion job
   - GET /status/{job_id} - Check job status
   - GET /download/{job_id} - Download ZIP of results
   - Output OpenAPI schema to `/contracts/`

3. **Generate contract tests** from contracts:
   - test_upload_endpoint.py
   - test_procore_endpoints.py
   - test_conversion_endpoints.py
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - Upload PDF and convert to tiles
   - Fetch M-series from Procore and process
   - Download bulk ZIP of converted images

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude`
   - Add Python 3.11, FastAPI, pdf2image
   - Update recent changes
   - Output to CLAUDE.md

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs
- Each contract → contract test task [P]
- Each entity → model creation task [P]
- Each service → implementation task
- Integration tests for each workflow

**Ordering Strategy**:
- TDD order: Tests before implementation
- Dependency order: Models → Services → CLI/API
- Mark [P] for parallel execution

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*No violations - keeping it simple with direct implementations*

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*