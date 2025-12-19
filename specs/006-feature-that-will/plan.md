# Implementation Plan: Area Selection for Tiling

**Branch**: `006-feature-that-will` | **Date**: 2025-12-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/006-feature-that-will/spec.md`

## Summary

Enable users to draw a rectangle on PDF page previews to select specific areas for tiling. The backend generates ONLY tiles that intersect with the selected region (no blank detection needed - user selection is the filter). Page previews are paginated (max 2 pages at a time) for responsive interaction.

**Simplified Flow**: User selects area → Generate only those tiles → Upload to S3 → Send to Roboflow (no intermediate storage of unused tiles)

## Technical Context

**Language/Version**: Python 3.11+ (Backend), TypeScript 5.x (Frontend)
**Primary Dependencies**: FastAPI, Next.js 14 (App Router), pdfjs-dist, Pillow
**Storage**: SQLite (jobs/uploads), AWS S3 (PDFs/tiles), Component state (selections)
**Testing**: pytest (backend), Vitest + Playwright (frontend)
**Target Platform**: Web browser (desktop), Linux server
**Project Type**: Web application (backend + frontend)
**Performance Goals**: Selection drawing at 60fps, tile estimation < 100ms
**Constraints**: Max 2 pages in preview, selections are ephemeral (not persisted)
**Scale/Scope**: Single user, typical PDFs 1-50 pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] No new external dependencies required
- [x] Uses existing patterns (Context API, FastAPI endpoints)
- [x] Backward compatible (existing API works without areaSelections)
- [x] No database schema changes

## Project Structure

### Documentation (this feature)

```text
specs/006-feature-that-will/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 research output
├── data-model.md        # Data model definitions
├── quickstart.md        # Development quickstart
├── contracts/
│   ├── convert-api.md   # Extended convert endpoint
│   └── tile-estimate-api.md  # New estimate endpoint
└── tasks.md             # Task breakdown (Phase 2)
```

### Source Code (repository root)

```text
# Backend (Python)
src/
├── models/
│   └── area_selection.py       # NEW: AreaSelection dataclass
├── services/
│   ├── image_tiler.py          # EXISTING: Tile generation
│   ├── pdf_processor.py        # EXISTING: PDF conversion
│   └── tile_calculator.py      # NEW: Area-to-tiles calculation
├── api/
│   └── convert.py              # MODIFIED: Add areaSelections param
└── tests/
    └── unit/
        └── test_tile_calculator.py  # NEW: Unit tests

# Frontend (TypeScript/React)
frontend/
├── src/
│   ├── components/
│   │   ├── AreaSelector/       # NEW: Rectangle drawing overlay
│   │   │   └── index.tsx
│   │   ├── PaginatedPagePreview/  # NEW: 2-page paginated view
│   │   │   └── index.tsx
│   │   ├── TileEstimateDisplay/   # NEW: Show tile count
│   │   │   └── index.tsx
│   │   └── ThumbnailGrid/      # MODIFIED: Pagination integration
│   ├── contexts/
│   │   └── AreaSelectionContext.tsx  # NEW: Selection state
│   ├── lib/
│   │   └── coordinate-utils.ts  # NEW: Coordinate transforms
│   └── types/
│       └── area-selection.ts    # NEW: TypeScript types
└── tests/
    └── unit/
        └── coordinate-utils.test.ts  # NEW: Unit tests
```

**Structure Decision**: Web application with separate backend (FastAPI) and frontend (Next.js). No changes to existing structure, only additions.

## Implementation Phases

### Phase 1: Backend - Tile Calculator

**Goal**: Calculate which tiles intersect with a given area.

**Files**:
- `src/services/tile_calculator.py` (new)
- `src/models/area_selection.py` (new)
- `tests/unit/test_tile_calculator.py` (new)

**Implementation**:
1. Create `AreaSelection` dataclass with pageNum, x, y, width, height
2. Create `calculate_tiles_for_area()` function using existing stride formula
3. Return list of (row, col) tuples for tiles that intersect
4. Unit tests for edge cases (small area, full page, edges)
5. No blank detection - user selection is the only filter

### Phase 2: Backend - API Extension

**Goal**: Extend `/api/convert/pages` to accept area selections and generate only selected tiles.

**Files**:
- `src/api/convert.py` (modify)
- `src/services/image_tiler.py` (modify)

**Implementation**:
1. Add `AreaSelectionInput` Pydantic model
2. Add optional `areaSelections` field to `ConvertPagesRequest`
3. Validate area selections (bounds, page numbers)
4. Modify `ImageTiler.tile_image()` to accept optional area filter
5. Generate ONLY tiles that intersect with selection (skip others entirely)
6. Remove blank tile detection from this flow

### Phase 3: Backend - Tile Estimate Endpoint

**Goal**: Provide tile count estimation without starting a job.

**Files**:
- `src/api/convert.py` (modify)

**Implementation**:
1. Add `POST /api/convert/estimate-tiles` endpoint
2. Accept page dimensions and optional area selection
3. Return rows, cols, total, and tile coordinates
4. No job creation, pure calculation

### Phase 4: Frontend - Types and Utilities

**Goal**: Define TypeScript types and coordinate utilities.

**Files**:
- `frontend/src/types/area-selection.ts` (new)
- `frontend/src/lib/coordinate-utils.ts` (new)
- `frontend/tests/unit/coordinate-utils.test.ts` (new)

**Implementation**:
1. Define `AreaSelection`, `AreaSelectionState` interfaces
2. Implement `displayToNative()` and `nativeToDisplay()` functions
3. Handle scale factor between canvas display and native PDF resolution
4. Unit tests for coordinate transformations

### Phase 5: Frontend - Area Selection Context

**Goal**: Manage selection state across pages.

**Files**:
- `frontend/src/contexts/AreaSelectionContext.tsx` (new)

**Implementation**:
1. Create context with Map<pageNum, AreaSelection>
2. Provide setSelection, clearSelection, clearAllSelections
3. Persist selections across pagination navigation
4. Integrate with existing context providers

### Phase 6: Frontend - Area Selector Component

**Goal**: Canvas overlay for drawing rectangles.

**Files**:
- `frontend/src/components/AreaSelector/index.tsx` (new)

**Implementation**:
1. Canvas overlay positioned over PDF preview
2. Mouse event handlers: down, move, up
3. Draw rectangle following cursor during drag
4. Convert display coordinates to native on release
5. Visual feedback (border, handles, semi-transparent fill)
6. Clear selection button

### Phase 7: Frontend - Paginated Page Preview

**Goal**: Show max 2 pages at a time with navigation.

**Files**:
- `frontend/src/components/PaginatedPagePreview/index.tsx` (new)
- `frontend/src/components/ThumbnailGrid/ThumbnailGrid.tsx` (modify)

**Implementation**:
1. Pagination state: currentStartPage, totalPages
2. Previous/Next buttons
3. Page indicator (e.g., "Pages 3-4 of 10")
4. Render 2 PagePreview components with AreaSelector overlays
5. Preserve selections when navigating

### Phase 8: Frontend - Tile Estimate Display

**Goal**: Show estimated tile count for current selection.

**Files**:
- `frontend/src/components/TileEstimateDisplay/index.tsx` (new)

**Implementation**:
1. Call `/api/convert/estimate-tiles` when selection changes
2. Debounce API calls during drawing
3. Display "~X tiles will be generated"
4. Show for both full page and area selection

### Phase 9: Integration

**Goal**: Wire everything together in the main workflow with simplified flow.

**Files**:
- `frontend/src/app/page.tsx` or relevant page (modify)
- `frontend/src/lib/api-client.ts` (modify)

**Implementation**:
1. Add AreaSelectionProvider to component tree
2. Update convert API call to include areaSelections
3. Show PaginatedPagePreview after file upload
4. Display TileEstimateDisplay near convert button
5. Simplified flow: User selects area → Generate only those tiles → Upload to S3 → Send to Roboflow
6. No intermediate storage of unused tiles - only selected area tiles are created

### Phase 10: Testing

**Goal**: Verify all functionality works end-to-end.

**Implementation**:
1. Backend unit tests for tile_calculator
2. Frontend unit tests for coordinate-utils
3. Integration test: upload PDF, draw selection, convert, verify fewer tiles
4. Manual testing of edge cases

## Complexity Tracking

No constitution violations. All implementations use existing patterns.

## Progress Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| Research | Complete | See research.md |
| Data Model | Complete | See data-model.md |
| Contracts | Complete | See contracts/ |
| Implementation | Pending | Run /tasks to generate task list |

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Coordinate precision across zoom levels | Use native DPI coordinates, convert at boundaries |
| Performance with large PDFs | Paginate to 2 pages, lazy load previews |
| Browser compatibility for canvas | Use standard Canvas 2D API, no experimental features |
| Backward compatibility | areaSelections is optional, existing behavior unchanged |
