# Feature Specification: Area Selection for Tiling

**Feature Branch**: `006-feature-that-will`
**Created**: 2025-12-19
**Status**: Draft
**Input**: User description: "feature that will allow user to pick area which they want to be tiled. user can draw a rectangle on the page preview. and the system will only tile that area (or closest approximation. So if user selects and area it okay if a few more tiles need to be created to fully encompas the area. does not need to be exact"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Draw Rectangle to Select Tiling Area (Priority: P1)

As a user, I want to draw a rectangle on the PDF page preview to define the specific area I want tiled, so I can focus processing on only the relevant portion of the drawing (e.g., a specific detail, section, or component) rather than tiling the entire page.

**Why this priority**: This is the core functionality of the feature. Without the ability to draw a selection rectangle, the feature has no value. This enables users to save processing time and reduce output file count by targeting only the area they need.

**Independent Test**: Can be fully tested by uploading a PDF, viewing a page preview, drawing a rectangle on the preview, and verifying the rectangle is displayed correctly with drag handles. Delivers immediate visual feedback that selection works.

**Acceptance Scenarios**:

1. **Given** I am viewing a PDF page preview, **When** I click and drag on the preview, **Then** a visible rectangle is drawn following my mouse movement
2. **Given** I have drawn a selection rectangle, **When** I release the mouse button, **Then** the rectangle remains visible with its coordinates captured
3. **Given** I have drawn a selection rectangle, **When** I hover over the rectangle, **Then** I see resize handles or the ability to adjust the selection

---

### User Story 2 - Tile Only Selected Area (Priority: P1)

As a user, I want the system to tile only the area I selected (or the closest tile-aligned approximation), so that my output contains only the tiles covering my region of interest.

**Why this priority**: This is equally critical as Story 1 - without backend support for region-based tiling, the selection rectangle has no effect. Together with Story 1, this forms the minimum viable feature.

**Independent Test**: Can be tested by providing coordinates to the API and verifying only tiles that intersect with the specified region are generated. The output tile count should be significantly less than full-page tiling for a small selection.

**Acceptance Scenarios**:

1. **Given** I have selected a rectangular region on a page, **When** I start the conversion job, **Then** the system generates only tiles that overlap with my selection
2. **Given** a selection that doesn't align perfectly with tile boundaries, **When** the job runs, **Then** the system generates tiles that fully encompass the selected area (may include slightly more area to align with tile grid)
3. **Given** I selected a small region, **When** conversion completes, **Then** I receive only the tiles for my selected area (no unused tiles generated)

---

### User Story 3 - Clear or Modify Selection (Priority: P2)

As a user, I want to clear my selection or draw a new one, so I can correct mistakes or change my mind about which area to tile.

**Why this priority**: Usability enhancement that allows users to iterate on their selection. The feature is usable without this, but the experience is frustrating if mistakes can't be corrected.

**Independent Test**: Can be tested by drawing a selection, clicking a "Clear" button, and verifying the selection disappears and full-page mode is restored.

**Acceptance Scenarios**:

1. **Given** I have drawn a selection rectangle, **When** I click "Clear Selection" or a similar control, **Then** the rectangle is removed and the full page is marked for tiling
2. **Given** I have drawn a selection rectangle, **When** I draw a new rectangle, **Then** the previous selection is replaced with the new one

---

### User Story 4 - Visual Feedback on Tile Coverage (Priority: P3)

As a user, I want to see a visual indication of how many tiles will be generated for my selection, so I can understand the scope of the output before starting the conversion.

**Why this priority**: Nice-to-have enhancement that improves user confidence but is not required for core functionality.

**Independent Test**: Can be tested by drawing a selection and verifying the UI displays an estimated tile count (e.g., "~6 tiles will be generated").

**Acceptance Scenarios**:

1. **Given** I have drawn a selection rectangle, **When** the selection is finalized, **Then** the UI displays an estimated tile count for that region
2. **Given** I resize or redraw my selection, **When** the selection changes, **Then** the estimated tile count updates accordingly

---

### User Story 5 - Paginated Page Preview (Priority: P1)

As a user, I want to see at most 2 page previews at a time with pagination controls, so I can quickly navigate between pages and make selections without waiting for all pages to load.

**Why this priority**: Essential for usability - showing too many large previews would slow down the interface and make selection awkward. Limiting to 2 pages keeps the UI responsive and focused.

**Independent Test**: Can be tested by uploading a multi-page PDF and verifying only 2 pages are shown at once with next/previous controls.

**Acceptance Scenarios**:

1. **Given** I have uploaded a PDF with more than 2 pages, **When** I view the page preview, **Then** I see at most 2 pages displayed with pagination controls
2. **Given** I am viewing pages 1-2, **When** I click "Next", **Then** I see pages 3-4 (or remaining pages)
3. **Given** I have made a selection on page 1, **When** I navigate to pages 3-4 and return, **Then** my selection on page 1 is preserved

---

### Edge Cases

- What happens when the user selects an extremely small area (smaller than one tile)? System should generate at least one tile covering that area.
- What happens when the user selects the entire page? System should behave identically to no selection (full page tiling).
- What happens when the user selects an area outside the page bounds? Selection should be constrained to page boundaries.
- How does system handle selection when page is zoomed in the preview? Coordinates must be mapped correctly from display resolution to actual PDF resolution.
- What happens if user starts conversion without drawing a selection? Full page is tiled as before (backwards compatible).
- Each page maintains its own selection, preserved across pagination navigation.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow users to draw a rectangle on the page preview by clicking and dragging
- **FR-002**: System MUST display the selection rectangle visually on the page preview after drawing
- **FR-003**: System MUST allow users to clear their selection to return to full-page tiling mode
- **FR-004**: System MUST capture selection coordinates relative to the actual PDF page dimensions (not display pixels)
- **FR-005**: System MUST pass selection coordinates to the backend conversion API
- **FR-006**: Backend MUST generate ONLY the tiles that intersect with the selected region (no extra tiles)
- **FR-007**: System MUST tile the full page when no selection is provided (backwards compatibility)
- **FR-008**: Selection rectangle MUST be constrained to the page boundaries
- **FR-009**: System SHOULD display estimated tile count for the selected region
- **FR-010**: System MUST display at most 2 page previews at a time with pagination controls
- **FR-011**: System MUST preserve selections when navigating between paginated page views
- **FR-012**: Blank tile detection is NOT used - user selection determines which tiles are generated
- **FR-013**: Generated tiles go directly to Roboflow upload flow (user selects → generate → upload to S3 → send to Roboflow)

### Key Entities

- **Selection**: Represents a rectangular region on a page defined by coordinates (x, y, width, height) relative to the PDF page at native resolution. Associated with a specific page of an upload.
- **Tile Region**: The calculated set of tiles that intersect with a Selection, determined by the tile grid (1920x1920 with 250px overlap/1670px stride).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can draw a selection rectangle on a page preview within 2 seconds of interaction
- **SC-002**: Selected area results in proportionally fewer tiles (e.g., selecting 25% of page area produces approximately 25% of full-page tile count)
- **SC-003**: Full-page conversions (no selection) produce identical results to current behavior
- **SC-004**: Users can complete a selection-based conversion workflow without additional documentation or support
