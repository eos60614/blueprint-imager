# Tasks: Area Selection for Tiling

**Input**: Design documents from `/specs/006-feature-that-will/`
**Prerequisites**: plan.md, spec.md, data-model.md, contracts/, quickstart.md

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1-US5)
- Include exact file paths in descriptions

## Path Conventions

- **Backend**: `src/` at repository root
- **Frontend**: `frontend/src/`
- **Tests**: `tests/` (backend), `frontend/tests/` (frontend)

---

## Phase 1: Foundational (Backend Core)

**Purpose**: Core backend services that ALL user stories depend on

**CRITICAL**: No frontend work can integrate properly until these are complete

- [x] T001 [P] [CORE] Create AreaSelection model in `src/models/area_selection.py` with pageNum, x, y, width, height fields and to_dict/from_dict methods per data-model.md
- [x] T002 [P] [CORE] Create TileCoord dataclass in `src/services/tile_calculator.py` with row, col, x, y fields
- [x] T003 [CORE] Implement `calculate_tiles_for_area()` function in `src/services/tile_calculator.py` using stride formula (tile_size - overlap), returning list of TileCoord for tiles intersecting with area
- [x] T004 [CORE] Add unit tests for tile_calculator in `tests/unit/test_tile_calculator.py` covering: small area (1 tile), full page, edge cases, area at page boundary

**Checkpoint**: Backend can calculate which tiles intersect with any given area

---

## Phase 2: User Story 1+2 - Draw Rectangle & Tile Selected Area (Priority: P1) - MVP

**Goal**: User can draw a selection rectangle and backend generates only tiles for that area

**Independent Test**: Upload PDF, draw rectangle, convert, verify fewer tiles generated

### Backend Implementation (US2)

- [x] T005 [US2] Add AreaSelectionInput Pydantic model to `src/api/convert.py` per contracts/convert-api.md
- [x] T006 [US2] Extend ConvertPagesRequest in `src/api/convert.py` with optional `areaSelections: List[AreaSelectionInput]` field
- [x] T007 [US2] Add validation in `src/api/convert.py`: each areaSelection.pageNum must be in selectedPages, bounds validation
- [x] T008 [US2] Modify `process_pages_job()` in `src/api/convert.py` to pass area selections to image tiler
- [x] T009 [US2] Modify `ImageTiler.tile_image()` in `src/services/image_tiler.py` to accept optional area filter and generate ONLY tiles that intersect (use tile_calculator)

### Frontend Foundation (US1)

- [x] T010 [P] [US1] Create TypeScript types in `frontend/src/types/area-selection.ts`: AreaSelection, AreaSelectionState, PagePreviewPagination, TileEstimate per data-model.md
- [x] T011 [P] [US1] Implement coordinate utilities in `frontend/src/lib/coordinate-utils.ts`: displayToNative(), nativeToDisplay() with PageDimensions interface
- [x] T012 [US1] Create AreaSelectionContext in `frontend/src/contexts/AreaSelectionContext.tsx` with Map<pageNum, AreaSelection>, setSelection, clearSelection, clearAllSelections, getSelection, hasSelection, getAllSelections

### Frontend UI (US1)

- [x] T013 [US1] Create AreaSelector component in `frontend/src/components/AreaSelector/index.tsx`:
  - Canvas overlay positioned over PDF preview
  - Mouse event handlers (down, move, up)
  - Draw rectangle during drag with semi-transparent fill
  - Convert display coords to native on mouse up using coordinate-utils
  - Visual border and corner handles
  - Props: pageNum, pageDimensions, onSelectionChange

### Integration (US1+US2)

- [x] T014 [US1] Update `frontend/src/lib/api-client.ts` to include areaSelections in convert API call
- [x] T015 [US1] Wire AreaSelectionProvider into main app component tree
- [x] T016 [US1] Integrate AreaSelector overlay with existing PagePreview component

**Checkpoint**: MVP complete - User can draw selection, backend tiles only that area

---

## Phase 3: User Story 5 - Paginated Page Preview (Priority: P1)

**Goal**: Show max 2 pages at a time with navigation

**Independent Test**: Upload 5+ page PDF, verify only 2 pages shown with prev/next controls

- [x] T017 [US5] Create PaginatedPagePreview component in `frontend/src/components/PaginatedPagePreview/index.tsx`:
  - State: currentStartPage, totalPages
  - Render 2 PagePreview components with AreaSelector overlays
  - Previous/Next buttons
  - Page indicator (e.g., "Pages 3-4 of 10")
  - Props: pdfUrl, totalPages, onPageChange
  - NOTE: Implemented as AreaSelectionSection in page.tsx with PagePreviewWithSelector

- [x] T018 [US5] Add pagination state to AreaSelectionContext to preserve selections when navigating
  - NOTE: Selections stored in Map<pageNum, AreaSelection>, preserved during navigation

- [x] T019 [US5] Replace current page preview usage with PaginatedPagePreview where area selection is needed
  - NOTE: AreaSelectionSection shows PagePreviewWithSelector for selected pages

**Checkpoint**: Pages display 2 at a time with navigation, selections preserved

---

## Phase 4: User Story 3 - Clear or Modify Selection (Priority: P2)

**Goal**: User can clear selection or redraw

**Independent Test**: Draw selection, click clear, verify full page mode restored

- [x] T020 [US3] Add "Clear Selection" button to AreaSelector component with clearSelection callback
  - NOTE: Already implemented in AreaSelector/index.tsx (lines 186-195)
- [x] T021 [US3] Implement redraw behavior: new mouse down clears existing selection and starts new one
  - NOTE: Already implemented - new drawing overwrites existing selection
- [x] T022 [US3] Add visual indicator showing "Full Page" vs "Selected Area" mode
  - NOTE: Already implemented in AreaSelector/index.tsx (lines 197-200)

**Checkpoint**: User can iterate on selections

---

## Phase 5: User Story 4 - Tile Estimate Display (Priority: P3)

**Goal**: Show estimated tile count before conversion

**Independent Test**: Draw selection, verify tile count displays

### Backend

- [x] T023 [US4] Add TileEstimateRequest and TileEstimateResponse models to `src/api/convert.py` per contracts/tile-estimate-api.md
- [x] T024 [US4] Implement `POST /api/convert/estimate-tiles` endpoint in `src/api/convert.py` using tile_calculator

### Frontend

- [x] T025 [US4] Add estimateTiles API call to `frontend/src/lib/api-client.ts`
- [x] T026 [US4] Create TileEstimateDisplay component in `frontend/src/components/TileEstimateDisplay/index.tsx`:
  - Call estimate-tiles API when selection changes
  - Debounce API calls (300ms)
  - Display "~X tiles will be generated"
  - Handle loading and error states

- [x] T027 [US4] Integrate TileEstimateDisplay near convert button in main workflow

**Checkpoint**: User sees tile count preview before converting

---

## Phase 6: Polish & Integration

**Purpose**: Final integration and validation

- [x] T028 [P] Verify backward compatibility: convert without areaSelections works as before
  - NOTE: areaSelections is Optional in ConvertPagesRequest, None case handled in process_pages_job
- [x] T029 [P] Add error handling for edge cases: tiny selection, selection at page edge
  - NOTE: Frontend checks min size (10x10 display pixels), backend validates via Pydantic, clamp_to_bounds handles page edges
- [ ] T030 Manual testing per quickstart.md verification checklist
  - NOTE: Ready for manual testing - all components implemented and build passing
- [x] T031 Update any existing integration tests affected by area selection
  - NOTE: No existing tests need updating - area selection is additive and backward compatible

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Foundational) ──blocks──> All other phases
                                      │
                                      ├──> Phase 2 (US1+US2 MVP)
                                      │         │
                                      │         └──> Phase 4 (US3 Clear/Modify)
                                      │
                                      ├──> Phase 3 (US5 Pagination)
                                      │
                                      └──> Phase 5 (US4 Tile Estimate)
                                                │
                                                └──> Phase 6 (Polish)
```

### Task Dependencies Within Phases

**Phase 1**:
- T001, T002 can run in parallel [P]
- T003 depends on T001, T002
- T004 depends on T003

**Phase 2**:
- T005-T009 (backend) are sequential (same file: convert.py)
- T010, T011 can run in parallel [P]
- T012 depends on T010
- T013 depends on T010, T011, T012
- T014-T016 depend on backend (T009) and frontend (T013) completion

**Phase 3-5**: Can run in parallel once Phase 2 is complete (different components)

### Parallel Opportunities

```bash
# Phase 1 parallel tasks:
T001 (AreaSelection model) + T002 (TileCoord dataclass)

# Phase 2 parallel tasks:
T010 (TypeScript types) + T011 (coordinate-utils)

# After Phase 2 completes, phases 3-5 can run in parallel:
Phase 3 (US5 Pagination) || Phase 4 (US3 Clear) || Phase 5 (US4 Estimate)

# Phase 6 parallel tasks:
T028 (backward compat) + T029 (error handling)
```

---

## Implementation Strategy

### MVP First (Phases 1-2 Only)

1. Complete Phase 1: Foundational
2. Complete Phase 2: US1 + US2
3. **STOP and VALIDATE**: Test area selection end-to-end
4. Deploy/demo if ready

### Full Feature Delivery

1. Complete MVP (Phases 1-2)
2. Add Phase 3 (Pagination) - improves UX for multi-page PDFs
3. Add Phase 4 (Clear/Modify) - enables iteration
4. Add Phase 5 (Tile Estimate) - adds preview
5. Phase 6 (Polish) - final validation

---

## Notes

- No blank tile detection in this flow - user selection is the filter
- Simplified flow: select → generate only those tiles → upload to S3 → Roboflow
- All coordinates in native DPI (600 DPI default), converted at UI boundary
- Selections are ephemeral (not persisted to database)
- Max 2 pages displayed at once for performance
