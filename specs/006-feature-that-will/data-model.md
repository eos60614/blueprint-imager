# Data Model: Area Selection for Tiling

**Feature Branch**: `006-feature-that-will`
**Date**: 2025-12-19

**Key Simplification**: No blank tile detection. User selection determines which tiles are generated.

**Flow**: User selects area → Generate ONLY those tiles → Upload to S3 → Send to Roboflow

## New Types

### Frontend Types

```typescript
// frontend/src/types/area-selection.ts

/**
 * Represents a rectangular area selection on a PDF page.
 * Coordinates are relative to the PDF page at native resolution (600 DPI).
 */
export interface AreaSelection {
  pageNum: number;   // 1-indexed page number
  x: number;         // Left edge in pixels (native DPI)
  y: number;         // Top edge in pixels (native DPI)
  width: number;     // Width in pixels (native DPI)
  height: number;    // Height in pixels (native DPI)
}

/**
 * State for managing area selections across pages.
 */
export interface AreaSelectionState {
  selections: Map<number, AreaSelection>;  // pageNum -> selection
  activePageNum: number | null;            // Currently drawing on this page
}

/**
 * Pagination state for page preview.
 */
export interface PagePreviewPagination {
  currentStartPage: number;  // 1-indexed, first page being displayed
  pagesPerView: 2;           // Always 2 (constant)
  totalPages: number;
}

/**
 * Estimated tile count for an area selection.
 */
export interface TileEstimate {
  pageNum: number;
  rows: number;
  cols: number;
  total: number;
}
```

### Backend Types

```python
# src/models/area_selection.py
from dataclasses import dataclass
from typing import Optional, List, Tuple

@dataclass
class AreaSelection:
    """Rectangular area selection on a PDF page."""
    page_num: int      # 1-indexed
    x: int             # Left edge in pixels (native DPI)
    y: int             # Top edge in pixels (native DPI)
    width: int         # Width in pixels
    height: int        # Height in pixels

    def to_dict(self) -> dict:
        return {
            'pageNum': self.page_num,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AreaSelection':
        return cls(
            page_num=data['pageNum'],
            x=data['x'],
            y=data['y'],
            width=data['width'],
            height=data['height']
        )
```

## API Request/Response Changes

### Extended ConvertPagesRequest

```python
# src/api/convert.py - Extended request model

class AreaSelectionInput(BaseModel):
    pageNum: int = Field(..., ge=1, description="1-indexed page number")
    x: int = Field(..., ge=0, description="Left edge in native DPI pixels")
    y: int = Field(..., ge=0, description="Top edge in native DPI pixels")
    width: int = Field(..., gt=0, description="Width in pixels")
    height: int = Field(..., gt=0, description="Height in pixels")

class ConvertPagesRequest(BaseModel):
    uploadId: int
    selectedPages: List[int]
    dpi: int = Field(600, ge=72, le=2400)
    tileSize: int = Field(1920, ge=256, le=4096)
    overlap: int = Field(250, ge=0)
    # NEW: Optional area selections per page
    areaSelections: Optional[List[AreaSelectionInput]] = None

    class Config:
        json_schema_extra = {
            "example": {
                "uploadId": 1,
                "selectedPages": [1, 2, 3],
                "dpi": 600,
                "tileSize": 1920,
                "overlap": 250,
                "areaSelections": [
                    {"pageNum": 1, "x": 1000, "y": 500, "width": 3000, "height": 2000}
                ]
            }
        }
```

### New Tile Estimate Endpoint

```python
# src/api/convert.py - New endpoint

class TileEstimateRequest(BaseModel):
    pageWidth: int = Field(..., gt=0)
    pageHeight: int = Field(..., gt=0)
    areaSelection: Optional[AreaSelectionInput] = None
    tileSize: int = Field(1920, ge=256, le=4096)
    overlap: int = Field(250, ge=0)

class TileEstimateResponse(BaseModel):
    rows: int
    cols: int
    total: int
    # Tiles that would be generated
    tileCoordinates: List[dict]  # [{row, col, x, y}]
```

## State Management

### AreaSelectionContext

```typescript
// frontend/src/contexts/AreaSelectionContext.tsx

interface AreaSelectionContextType {
  // State
  selections: Map<number, AreaSelection>;

  // Actions
  setSelection: (pageNum: number, selection: AreaSelection) => void;
  clearSelection: (pageNum: number) => void;
  clearAllSelections: () => void;
  getSelection: (pageNum: number) => AreaSelection | undefined;
  hasSelection: (pageNum: number) => boolean;

  // Derived
  getAllSelections: () => AreaSelection[];
}
```

### PagePreviewPaginationContext

```typescript
// Could be part of existing SelectionContext or new context

interface PagePreviewPaginationContextType {
  // State
  currentStartPage: number;
  totalPages: number;

  // Actions
  goToNext: () => void;
  goToPrevious: () => void;
  goToPage: (pageNum: number) => void;

  // Derived
  currentPages: number[];  // [currentStartPage, currentStartPage + 1] or less
  hasNext: boolean;
  hasPrevious: boolean;
}
```

## Database Changes

No database schema changes required. Area selections are:
- Ephemeral (not persisted between sessions)
- Passed directly in API request
- Not stored with job metadata

If persistence is later needed, extend `jobs` table:
```sql
-- Future enhancement (not in current scope)
ALTER TABLE jobs ADD COLUMN area_selections TEXT;  -- JSON array of AreaSelection
```

## Coordinate Transformation

### Display to Native Conversion

```typescript
// frontend/src/lib/coordinate-utils.ts

interface PageDimensions {
  nativeWidth: number;   // PDF width at target DPI (e.g., 600)
  nativeHeight: number;
  displayWidth: number;  // Rendered canvas width
  displayHeight: number;
}

/**
 * Convert display coordinates to native PDF coordinates.
 */
export function displayToNative(
  displayX: number,
  displayY: number,
  dimensions: PageDimensions
): { x: number; y: number } {
  const scaleX = dimensions.nativeWidth / dimensions.displayWidth;
  const scaleY = dimensions.nativeHeight / dimensions.displayHeight;
  return {
    x: Math.round(displayX * scaleX),
    y: Math.round(displayY * scaleY)
  };
}

/**
 * Convert native PDF coordinates to display coordinates.
 */
export function nativeToDisplay(
  nativeX: number,
  nativeY: number,
  dimensions: PageDimensions
): { x: number; y: number } {
  const scaleX = dimensions.displayWidth / dimensions.nativeWidth;
  const scaleY = dimensions.displayHeight / dimensions.nativeHeight;
  return {
    x: Math.round(nativeX * scaleX),
    y: Math.round(nativeY * scaleY)
  };
}
```

### Area to Tile Grid Conversion

```python
# src/services/tile_calculator.py

from typing import List, Tuple
from dataclasses import dataclass

@dataclass
class TileCoord:
    row: int
    col: int
    x: int  # pixel x of tile top-left
    y: int  # pixel y of tile top-left

def calculate_tiles_for_area(
    page_width: int,
    page_height: int,
    area_x: int,
    area_y: int,
    area_width: int,
    area_height: int,
    tile_size: int = 1920,
    overlap: int = 250
) -> List[TileCoord]:
    """
    Calculate which tiles intersect with the given area.
    Returns tiles that fully encompass the area.
    """
    stride = tile_size - overlap

    # Calculate full grid dimensions
    total_cols = math.ceil((page_width - overlap) / stride)
    total_rows = math.ceil((page_height - overlap) / stride)

    # Area boundaries
    area_right = area_x + area_width
    area_bottom = area_y + area_height

    # Find tiles that intersect
    tiles = []
    for row in range(total_rows):
        for col in range(total_cols):
            tile_x = col * stride
            tile_y = row * stride

            # Clamp to page boundaries (as ImageTiler does)
            tile_x = min(tile_x, page_width - tile_size)
            tile_y = min(tile_y, page_height - tile_size)
            tile_x = max(0, tile_x)
            tile_y = max(0, tile_y)

            tile_right = tile_x + tile_size
            tile_bottom = tile_y + tile_size

            # Check intersection (any overlap)
            if (tile_x < area_right and tile_right > area_x and
                tile_y < area_bottom and tile_bottom > area_y):
                tiles.append(TileCoord(row=row, col=col, x=tile_x, y=tile_y))

    return tiles
```

## Entity Relationships

```
Upload (1) ──────────── (*) Job
   │                        │
   │                        ├── selected_pages: List[int]
   │                        └── (API receives areaSelections)
   │
   └── page_count: int

AreaSelection (ephemeral, per-request)
   │
   ├── pageNum: int  ──→ references page in Upload
   └── x, y, width, height: int  ──→ defines region

TileCoord (calculated at runtime)
   │
   ├── row, col: int  ──→ grid position
   └── x, y: int  ──→ pixel position
```

## Validation Rules

1. **Area bounds**: `x >= 0`, `y >= 0`, `width > 0`, `height > 0`
2. **Area within page**: `x + width <= page_width`, `y + height <= page_height`
3. **Page number valid**: `1 <= pageNum <= upload.page_count`
4. **One selection per page**: Map keyed by pageNum (later selections replace earlier)
5. **Minimum area**: At least one tile must intersect (enforced by calculation)
