# Implementation Plan: Responsive Preview Layout for Large Format PDFs

**Branch**: `008-responsive-preview-layout` | **Date**: 2026-01-19 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/008-responsive-preview-layout/spec.md`

## Summary

Redesign the frontend layout to maximize screen space utilization for large format PDF previews (40x32 inch drawings). Current fixed-width container (max-w-5xl = 1024px) wastes significant space on wide monitors. Implementation involves expanding container widths, adding responsive breakpoints for large screens, enlarging tile preview panels, and introducing drawing thumbnails in the browse list.

## Technical Context

**Language/Version**: TypeScript 5.x
**Primary Dependencies**: Next.js 14 (App Router), Tailwind CSS, React, SWR
**Storage**: N/A (frontend-only feature)
**Testing**: Vitest (unit), Playwright (E2E)
**Target Platform**: Web browsers, desktop-first (1920px+ primary, 768px minimum)
**Project Type**: Web application (frontend)
**Performance Goals**: Page load under 3 seconds with thumbnails, smooth layout transitions (no visible jank)
**Constraints**: Must support 768px minimum width, lazy loading for thumbnails to avoid bandwidth issues
**Scale/Scope**: Browse page layout, TileLayoutPreview component, ProcessingSettings component, Navigation component

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

The constitution file contains placeholder content without specific project principles defined. Since no concrete gates or constraints are specified in the constitution, this check passes by default. The implementation will follow standard best practices:

| Gate | Status | Notes |
|------|--------|-------|
| No concrete principles defined | PASS | Constitution is template-only, no violations possible |
| Standard practices | PASS | Using existing tech stack (Tailwind, React, Next.js) |
| No new dependencies | PASS | Leveraging existing Tailwind responsive utilities |

### Post-Design Re-evaluation (2026-01-19)

Design review complete. Additional validation:

| Criterion | Status | Justification |
|-----------|--------|---------------|
| Frontend-only scope | PASS | No backend changes, uses existing API endpoints |
| Existing patterns | PASS | Follows existing component structure (ThumbnailGrid, etc.) |
| Performance considerations | PASS | Lazy loading prevents bandwidth issues |
| Accessibility | PASS | Plan includes alt text, keyboard nav, reduced motion |
| Testing coverage | PASS | Unit + E2E tests planned in quickstart.md |
| Minimal complexity | PASS | CSS-first approach, no complex state management |

## Project Structure

### Documentation (this feature)

```text
specs/008-responsive-preview-layout/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (minimal - frontend-only)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Web application structure (frontend-focused feature)
frontend/
├── src/
│   ├── app/
│   │   └── browse/page.tsx       # Main browse page layout
│   ├── components/
│   │   ├── TileLayoutPreview/    # Preview panel (resize/expand)
│   │   ├── ProcessingSettings/   # Settings grid layout
│   │   ├── Navigation/           # Navigation bar
│   │   └── DrawingThumbnail/     # NEW: Thumbnail component
│   └── hooks/
│       └── useWindowSize.ts      # NEW: Responsive hook
├── tailwind.config.js            # Breakpoint configuration
└── tests/
    ├── unit/                     # Component tests
    └── e2e/                      # Layout E2E tests
```

**Structure Decision**: This is a frontend-only feature modifying existing components and adding minimal new components. No backend changes required.

## Complexity Tracking

> No constitution violations to justify. Using existing technology stack and patterns.

| Component | Current State | Proposed Change |
|-----------|---------------|-----------------|
| Container width | max-w-5xl (1024px) | Expand to max-w-7xl or full-width with max |
| Preview height | Fixed 300px | Dynamic based on viewport |
| Drawing list | No thumbnails | Add inline thumbnail previews |
| Breakpoints | sm/md/lg only | Add xl/2xl for large screens |
