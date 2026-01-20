# Data Model: Responsive Preview Layout

**Feature**: 008-responsive-preview-layout
**Date**: 2026-01-19

## Overview

This is a frontend-only feature. The data model consists of TypeScript interfaces for component state and props. No database schema changes are required.

## New TypeScript Interfaces

### DrawingThumbnail Component State

```typescript
// Location: frontend/src/types/procore.ts (extend existing)

/**
 * State for a single drawing thumbnail in the browse list
 */
export interface DrawingThumbnailState {
  drawingId: number;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  imageUrl: string | null;
  error: string | null;
  width?: number;
  height?: number;
}

/**
 * Props for the DrawingThumbnail component
 */
export interface DrawingThumbnailProps {
  drawingId: number;
  hasFile: boolean;
  drawingNumber: string;  // For alt text
  onHover?: (drawingId: number | null) => void;
  size?: 'sm' | 'md' | 'lg';  // sm=60px, md=80px, lg=120px
}
```

### Enhanced Preview Panel State

```typescript
// Location: frontend/src/types/procore.ts (extend existing)

/**
 * Configuration for responsive preview panel sizing
 */
export interface PreviewPanelConfig {
  minHeight: number;   // Default: 400
  maxHeight: number;   // Default: 800
  viewportRatio: number;  // Default: 0.5 (50% of viewport)
}

/**
 * Extended props for TileLayoutPreview with responsive sizing
 */
export interface TileLayoutPreviewProps {
  drawingId: number | null;
  dpi: number;
  tileSize: number;
  overlap: number;
  noTiles: boolean;
  // New responsive props
  fullWidth?: boolean;    // Expand to container width
  config?: PreviewPanelConfig;
}
```

### Layout Context (New)

```typescript
// Location: frontend/src/types/layout.ts (new file)

/**
 * Breakpoint sizes matching Tailwind defaults
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Layout configuration state
 */
export interface LayoutConfig {
  containerMaxWidth: string;  // CSS max-width value
  previewPanelHeight: string; // CSS height value (e.g., 'clamp(400px, 50vh, 800px)')
  thumbnailSize: 'sm' | 'md' | 'lg';
  showThumbnailColumn: boolean;
}

/**
 * Responsive layout state managed by useWindowSize hook
 */
export interface ResponsiveLayoutState {
  windowWidth: number;
  windowHeight: number;
  currentBreakpoint: Breakpoint;
  layoutConfig: LayoutConfig;
}
```

## Extended Existing Interfaces

### ProcoreDrawing (extend)

```typescript
// Location: frontend/src/types/procore.ts

// Existing interface - no changes required
// The hasFile field is already present and sufficient for thumbnail logic
export interface ProcoreDrawing {
  id: number;
  drawingNumber: string;
  title: string | null;
  projectId: number;
  projectName: string;
  projectNumber: string | null;
  revisionNumber: string | null;
  fileSize: number | null;
  hasFile: boolean;  // Already exists - used for thumbnail logic
}
```

## State Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        BrowsePage                                │
│                                                                  │
│  ┌─────────────────┐       ┌─────────────────────────────────┐  │
│  │ useWindowSize() │──────>│ ResponsiveLayoutState           │  │
│  └─────────────────┘       │ - windowWidth, windowHeight     │  │
│                            │ - currentBreakpoint             │  │
│                            │ - layoutConfig                  │  │
│                            └───────────────┬─────────────────┘  │
│                                            │                     │
│          ┌─────────────────────────────────┼─────────────────┐  │
│          │                                 │                 │  │
│          ▼                                 ▼                 ▼  │
│  ┌───────────────┐   ┌────────────────────────┐   ┌─────────┐  │
│  │ DrawingList   │   │ TileLayoutPreview      │   │ Layout  │  │
│  │               │   │                        │   │ Classes │  │
│  │ thumbnailSize │   │ fullWidth              │   │         │  │
│  │ showThumbnail │   │ config.minHeight       │   │ max-w-  │  │
│  │ Column        │   │ config.maxHeight       │   │ px-     │  │
│  └───────┬───────┘   └────────────────────────┘   └─────────┘  │
│          │                                                       │
│          ▼                                                       │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ DrawingThumbnail (per row)                                │  │
│  │                                                            │  │
│  │  ┌────────────────────┐    ┌───────────────────────────┐  │  │
│  │  │ DrawingThumbnail   │    │ HoverPreview (portal)     │  │  │
│  │  │ State              │───>│                           │  │  │
│  │  │ - status           │    │ Enlarged preview shown    │  │  │
│  │  │ - imageUrl         │    │ on hover/focus            │  │  │
│  │  └────────────────────┘    └───────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Validation Rules

### DrawingThumbnail

| Field | Validation | Description |
|-------|------------|-------------|
| drawingId | Required, positive integer | Must match a valid drawing ID |
| hasFile | Required, boolean | Determines if thumbnail fetch is attempted |
| status | Enum validation | Only allowed states: idle, loading, loaded, error |

### LayoutConfig

| Field | Validation | Description |
|-------|------------|-------------|
| containerMaxWidth | Valid CSS value | e.g., '1920px', '100%', 'max-w-7xl' |
| previewPanelHeight | Valid CSS clamp() | e.g., 'clamp(400px, 50vh, 800px)' |
| thumbnailSize | Enum: sm, md, lg | Maps to pixel sizes |

## State Transitions

### Thumbnail Loading States

```
idle ──[enter viewport]──> loading ──[success]──> loaded
                             │
                             └─[error]──> error ──[retry]──> loading
```

### Responsive Layout Transitions

```
Window resize event
       │
       ▼
Calculate new breakpoint
       │
       ├── < 768px  ──> md breakpoint (mobile layout)
       ├── < 1024px ──> lg breakpoint (tablet layout)
       ├── < 1280px ──> xl breakpoint (desktop layout)
       └── >= 1280px ──> 2xl breakpoint (wide layout)
       │
       ▼
Update LayoutConfig based on breakpoint
       │
       ▼
Re-render affected components
```

## Component Hierarchy

```
BrowsePage
├── DrawingFilters
├── ProcessingSettingsPanel
├── TileLayoutPreview (responsive height)
├── DrawingProcessButton
└── DrawingList (responsive container)
    └── DrawingRow (per drawing)
        ├── SelectionCheckbox
        ├── DrawingThumbnail (NEW)
        │   └── HoverPreview (conditional)
        ├── DrawingInfo
        ├── ProjectInfo
        ├── RevisionInfo
        ├── FileSizeInfo
        └── StatusBadge
```

## No Backend Changes Required

This feature operates entirely on the frontend using:
1. Existing `/api/procore/drawings/{id}/preview` endpoint for thumbnails
2. Client-side viewport calculations for responsive layout
3. CSS-only solutions for layout transitions

No new database tables, API endpoints, or backend models are needed.
