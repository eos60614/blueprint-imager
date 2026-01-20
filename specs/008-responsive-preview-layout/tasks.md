# Tasks: Responsive Preview Layout for Large Format PDFs

**Input**: Design documents from `/specs/008-responsive-preview-layout/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: Not explicitly requested in the feature specification. Test tasks are not included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and type definitions

- [X] T001 Create layout type definitions in `frontend/src/types/layout.ts` (Breakpoint, LayoutConfig, ResponsiveLayoutState)
- [X] T002 Extend existing types with DrawingThumbnailState and DrawingThumbnailProps in `frontend/src/types/procore.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core hook that ALL user stories depend on for responsive behavior

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T003 Implement useWindowSize hook in `frontend/src/hooks/useWindowSize.ts` with debounced window tracking, breakpoint calculation, and layout config generation

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Maximize Preview Space on Large Screens (Priority: P1) 🎯 MVP

**Goal**: Expand content area to use available horizontal space on large screens (1920px+) and make tile preview panels larger

**Independent Test**: Load browse page on 1920px+ monitor and verify content expands to use at least 80% horizontal space

### Implementation for User Story 1

- [X] T004 [US1] Update container width in `frontend/src/app/browse/page.tsx` - replace max-w-5xl with responsive max-w-[1920px] using breakpoint classes
- [X] T005 [US1] Update Navigation component in `frontend/src/components/Navigation/index.tsx` to match new container width
- [X] T006 [US1] Update TileLayoutPreview height in `frontend/src/components/TileLayoutPreview/TileLayoutPreview.tsx` - replace fixed 300px with clamp(400px, calc(50vh - 8rem), 800px)
- [X] T007 [US1] Add fullWidth prop support to TileLayoutPreview component in `frontend/src/components/TileLayoutPreview/TileLayoutPreview.tsx`
- [X] T008 [US1] Update ProcessingSettings grid layout in `frontend/src/components/ProcessingSettings/ProcessingSettings.tsx` for wider containers

**Checkpoint**: At this point, User Story 1 should be fully functional - content expands on large screens

---

## Phase 4: User Story 2 - Larger Thumbnail Previews in Drawing List (Priority: P2)

**Goal**: Add visible thumbnail previews to the drawing list so users can identify drawings without selecting each one

**Independent Test**: Load browse page and verify each drawing row displays a visible thumbnail of the drawing content

### Implementation for User Story 2

- [X] T009 [P] [US2] Create DrawingThumbnail component structure with index file in `frontend/src/components/DrawingThumbnail/index.tsx`
- [X] T010 [P] [US2] Create HoverPreview subcomponent in `frontend/src/components/DrawingThumbnail/HoverPreview.tsx` for enlarged preview overlay
- [X] T011 [US2] Implement lazy loading with IntersectionObserver in DrawingThumbnail in `frontend/src/components/DrawingThumbnail/index.tsx`
- [X] T012 [US2] Add loading skeleton and error state handling in DrawingThumbnail in `frontend/src/components/DrawingThumbnail/index.tsx`
- [X] T013 [US2] Add "No Preview" placeholder for drawings without files in `frontend/src/components/DrawingThumbnail/index.tsx`
- [X] T014 [US2] Add thumbnail column to DrawingList table in `frontend/src/components/DrawingList/DrawingList.tsx`
- [X] T015 [US2] Integrate DrawingThumbnail component into DrawingList rows in `frontend/src/components/DrawingList/DrawingList.tsx`

**Checkpoint**: At this point, User Story 2 should be fully functional - thumbnails visible in drawing list

---

## Phase 5: User Story 3 - Responsive Layout Adaptation (Priority: P3)

**Goal**: Ensure layout adapts appropriately on different screen sizes (768px minimum) without breaking

**Independent Test**: Resize browser window and verify layout adapts smoothly without horizontal scrolling or content overflow

### Implementation for User Story 3

- [X] T016 [US3] Add responsive breakpoint classes for md (768px) layout in `frontend/src/app/browse/page.tsx`
- [X] T017 [US3] Add responsive breakpoint classes for lg (1024px) layout in `frontend/src/app/browse/page.tsx`
- [X] T018 [US3] Add responsive breakpoint classes for xl/2xl (1280px+) layout in `frontend/src/app/browse/page.tsx`
- [X] T019 [US3] Make thumbnail column responsive - hide on small screens in `frontend/src/components/DrawingList/DrawingList.tsx`
- [X] T020 [US3] Adjust TileLayoutPreview sizing for smaller viewports in `frontend/src/components/TileLayoutPreview/TileLayoutPreview.tsx`

**Checkpoint**: At this point, all user stories should work independently across all supported screen sizes

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [X] T021 [P] Add aria-label and alt text for all thumbnail images in `frontend/src/components/DrawingThumbnail/index.tsx`
- [X] T022 [P] Add keyboard accessibility (Tab + Enter) for hover preview in `frontend/src/components/DrawingThumbnail/HoverPreview.tsx`
- [X] T023 [P] Add prefers-reduced-motion support for all CSS transitions in affected components
- [X] T024 Verify WCAG AA color contrast for skeleton/placeholder colors in thumbnail component
- [X] T025 Run quickstart.md manual testing checklist to validate all acceptance criteria

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3, 4, 5)**: All depend on Foundational phase completion
  - User stories can proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - Independent of US1, uses existing API
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but tests independently

### Within Each User Story

- Layout changes before component-level changes
- Container updates before child component updates
- Core implementation before edge case handling

### Parallel Opportunities

- T001, T002 can run in parallel (different files)
- T009, T010 can run in parallel (different files, both in US2)
- T021, T022, T023 can run in parallel (different concerns)
- Once Foundational phase completes, US1, US2, US3 can theoretically start in parallel

---

## Parallel Example: User Story 2

```bash
# Launch component structure tasks together:
Task: "Create DrawingThumbnail component structure in frontend/src/components/DrawingThumbnail/index.tsx"
Task: "Create HoverPreview subcomponent in frontend/src/components/DrawingThumbnail/HoverPreview.tsx"

# After structure is in place, implement features sequentially
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (type definitions)
2. Complete Phase 2: Foundational (useWindowSize hook)
3. Complete Phase 3: User Story 1 (expanded layout)
4. **STOP and VALIDATE**: Test layout expansion independently
5. Deploy/demo if ready - users immediately get better space utilization

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo (thumbnails added)
4. Add User Story 3 → Test independently → Deploy/Demo (responsive complete)
5. Each story adds value without breaking previous stories

### Single Developer Strategy

1. Complete Setup + Foundational
2. Work through user stories in priority order (US1 → US2 → US3)
3. Polish phase at the end
4. Total: 25 tasks across 6 phases

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable
- This is a frontend-only feature - no backend changes required
- Uses existing `/api/procore/drawings/{id}/preview?dpi=72` endpoint for thumbnails
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
