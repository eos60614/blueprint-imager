# Research: Area Selection for Tiling

**Feature Branch**: `006-feature-that-will`
**Date**: 2025-12-19

## Executive Summary

The Blueprint Imager codebase has a well-architected system for PDF to image tiling. The image tiler uses a grid-based approach (1920x1920 tiles, 250px overlap, 1670px stride) with consistent row/column indexing. Tile selection infrastructure already exists in the Roboflow upload feature. The main additions needed are:

1. Canvas-based visual selection interface on page preview
2. Mathematical conversion from drawn rectangles to tile grid coordinates
3. State management for area selections per page
4. Backend endpoint to filter tile generation by region
5. Paginated page preview (max 2 pages at a time)

## Key Files and Components

### Backend

| Component | File | Purpose |
|-----------|------|---------|
| ImageTiler | `src/services/image_tiler.py` | Tile generation algorithm |
| PDFProcessor | `src/services/pdf_processor.py` | PDF to image conversion at 600 DPI |
| Convert API | `src/api/convert.py` | `/api/convert/pages` endpoint |
| Jobs API | `src/api/jobs.py` | Job status and tile retrieval |
| Job Model | `src/models/job.py` | Job data structure |
| JobPage Model | `src/models/job_page.py` | Per-page processing status |

### Frontend

| Component | File | Purpose |
|-----------|------|---------|
| ThumbnailGrid | `frontend/src/components/ThumbnailGrid/` | Page thumbnail display |
| PagePreview | `frontend/src/components/PagePreview/` | Full page PDF rendering |
| TileGrid | `frontend/src/components/TileGrid/` | Tile display with selection mode |
| SelectionContext | `frontend/src/contexts/SelectionContext.tsx` | Page selection state |
| ProcessingContext | `frontend/src/contexts/ProcessingContext.tsx` | Job processing state |

## Existing Data Structures

### Tile Coordinates

```python
# From ImageTiler.tile_image() - src/services/image_tiler.py:92-102
{
    'file_path': str,      # Full path to saved tile
    'tile_index': int,     # Sequential index
    'row': int,            # 0-indexed row in grid
    'column': int,         # 0-indexed column in grid
    'x': int,              # Pixel X coordinate (top-left)
    'y': int,              # Pixel Y coordinate (top-left)
    'width': int,          # 1920 or less at edges
    'height': int,         # 1920 or less at edges
    'is_blank': bool       # True if >= 95% white
}
```

### Tile Selection (Roboflow)

```typescript
// From frontend/src/types/roboflow.ts:5-9
interface TileSelection {
    pageNum: number;  // 1-indexed
    row: number;      // 0-indexed
    col: number;      // 0-indexed
}
```

### Convert Request

```python
# From src/api/convert.py:26-61
class ConvertPagesRequest(BaseModel):
    uploadId: int
    selectedPages: List[int]   # 1-indexed page numbers
    dpi: int = 600             # 72-2400 range
    tileSize: int = 1920       # 256-4096 range
    overlap: int = 250         # Non-negative
```

## Tiling Algorithm

**Location**: `src/services/image_tiler.py:61-76`

```python
# Grid calculation
stride = tile_size - overlap  # 1920 - 250 = 1670
cols = math.ceil((width - overlap) / stride)
rows = math.ceil((height - overlap) / stride)

# Tile coordinates
for row in range(rows):
    for col in range(cols):
        x = col * stride  # Column position
        y = row * stride  # Row position
        # Clamp to image boundaries
        x = min(x, width - tile_size)
        y = min(y, height - tile_size)
```

## Coordinate Systems

| System | Origin | Units | Used In |
|--------|--------|-------|---------|
| PDF Viewport | Top-left (0,0) | Pixels at render scale | PagePreview canvas |
| Grid | Row 0, Col 0 | Row/col indices | Tile metadata, TileSelection |
| Pixel | Top-left (0,0) | 600 DPI pixels | ImageTiler, PDF rendering |

### Conversion Formulas

```
# Grid to Pixel (at native DPI)
x_pixel = col * stride
y_pixel = row * stride

# Pixel to Grid (approximate - tiles overlap)
col = floor(x_pixel / stride)
row = floor(y_pixel / stride)

# Viewport to Pixel (with scale factor)
x_pixel = x_viewport * (native_width / display_width)
y_pixel = y_viewport * (native_height / display_height)
```

## Existing Selection Patterns

### TileGrid Selection Mode

The TileGrid component (`frontend/src/components/TileGrid/index.tsx`) already supports tile selection:

- Uses `Set<string>` with `"row-col"` keys
- `selectionMode` prop enables checkboxes
- `selectionToTileSelections()` converts to API format
- Integrated with Roboflow upload

### Page Selection

SelectionContext manages page-level selection:
- Range parsing: "1-5,10,15-20"
- Array tracking: `selectedPages: number[]`
- Toggle individual pages

## What Needs to Be Built

### 1. Area Selection Component (Frontend)

New component for drawing rectangle on PDF preview:
- Canvas overlay on PagePreview
- Mouse down/drag/up handlers
- Rectangle rendering with visual feedback
- Coordinate capture relative to PDF dimensions

### 2. Area State Management (Frontend)

New context or extension:
```typescript
interface PageAreaSelection {
    pageNum: number;
    x: number;      // PDF-relative pixels
    y: number;
    width: number;
    height: number;
}
```

### 3. Area-to-Tiles Calculation (Backend)

Function to determine tiles intersecting with area:
```python
def get_tiles_for_area(
    page_width: int,
    page_height: int,
    area: Rect,
    tile_size: int = 1920,
    overlap: int = 250
) -> List[Tuple[int, int]]:  # (row, col) pairs
```

### 4. API Extension

Extend `/api/convert/pages` request:
```python
class AreaSelection(BaseModel):
    pageNum: int
    x: int
    y: int
    width: int
    height: int

class ConvertPagesRequest(BaseModel):
    # ... existing fields
    areaSelections: Optional[List[AreaSelection]] = None
```

### 5. Paginated Preview (Frontend)

New pagination component:
- Display max 2 pages at a time
- Previous/Next navigation
- Preserve area selections across navigation
- Track current page range

## Simplified Flow

**Key Change**: No blank tile detection needed. User selection determines which tiles are generated.

```
User draws selection → Generate ONLY those tiles → Upload to S3 → Send to Roboflow
```

- No intermediate storage of all tiles
- No blank tile filtering (user is the filter)
- Direct path from selection to Roboflow upload

## Constraints

1. **Page dimensions vary** - Each page may have different dimensions
2. **DPI affects coordinates** - User can set DPI 72-2400
3. **Scale factor** - Display scale differs from native PDF dimensions
4. **Tile overlap** - Adjacent tiles share 250px content
5. **Edge tiles** - May be smaller than 1920x1920

## Integration Points

1. **PagePreview component** - Add canvas overlay for area drawing
2. **SelectionContext** - Extend or create AreaSelectionContext
3. **ConvertPagesRequest** - Add optional areaSelections field
4. **process_pages_job()** - Filter tiles to those intersecting areas
5. **ThumbnailGrid** - Add pagination (2 pages max)
