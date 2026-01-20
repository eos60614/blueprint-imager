# API Dependencies: Responsive Preview Layout

**Feature**: 008-responsive-preview-layout
**Date**: 2026-01-19

## Overview

This is a frontend-only feature. No new API endpoints are required. This document describes the existing API endpoints that the feature depends on.

## Existing Endpoints Used

### GET /api/procore/drawings/{id}/preview

**Purpose**: Fetch a low-resolution preview image for a drawing thumbnail.

**Usage in Feature**: DrawingThumbnail component will call this endpoint with `dpi=72` for each visible drawing in the list.

**Request**:
```
GET /api/procore/drawings/{drawingId}/preview?dpi=72
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| drawingId | path (int) | Yes | The drawing ID from ProcoreDrawing.id |
| dpi | query (int) | No | Resolution for preview (default: 72) |

**Response**:
- **200 OK**: Binary image data (PNG)
  - Headers:
    - `Content-Type: image/png`
    - `X-Preview-Width: {width in pixels}`
    - `X-Preview-Height: {height in pixels}`
- **404 Not Found**: Drawing not found or no file available
- **500 Internal Server Error**: Processing error

**Rate Limiting Considerations**:
- Thumbnails are loaded lazily (only when scrolled into view)
- Typical usage: 10-50 concurrent requests when user scrolls through list
- Existing backend caching should handle load adequately

### GET /api/procore/drawings/{id}/dimensions

**Purpose**: Get the dimensions of a drawing at a specific DPI.

**Usage in Feature**: Already used by TileLayoutPreview for tile calculations. No changes needed.

**Request**:
```
GET /api/procore/drawings/{drawingId}/dimensions?dpi={dpi}
```

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| drawingId | path (int) | Yes | The drawing ID |
| dpi | query (int) | Yes | Resolution for dimension calculation |

**Response**:
- **200 OK**: JSON
  ```json
  {
    "width": 28800,
    "height": 23040,
    "dpi": 600
  }
  ```
- **404 Not Found**: Drawing not found
- **500 Internal Server Error**: Processing error

## No New Endpoints Required

The existing API surface is sufficient for this feature:
1. Thumbnail images use existing preview endpoint at 72 DPI
2. Tile calculations use existing dimensions endpoint
3. All responsive layout logic is client-side CSS/JavaScript

## Performance Contract

### Thumbnail Loading

| Metric | Requirement | Current Status |
|--------|-------------|----------------|
| Initial viewport thumbnails | < 2s total | Existing endpoint |
| Individual thumbnail | < 500ms | Existing endpoint |
| Lazy load trigger | 200px before viewport | Client implementation |

### Layout Responsiveness

| Metric | Requirement | Notes |
|--------|-------------|-------|
| Resize handling | < 16ms (60fps) | CSS-only transitions |
| Breakpoint switch | No visible jank | CSS transitions |
| Window resize debounce | 100ms | Prevents excessive re-renders |

## Browser Compatibility

The feature uses standard browser APIs:
- IntersectionObserver for lazy loading (IE11+ with polyfill)
- ResizeObserver for window size tracking (Chrome 64+, Firefox 69+, Safari 13.1+)
- CSS clamp() function (Chrome 79+, Firefox 75+, Safari 13.1+)

Note: If older browser support is needed, fallback implementations can be provided.
