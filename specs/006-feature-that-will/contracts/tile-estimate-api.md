# API Contract: Tile Estimate Endpoint

**Endpoint**: `POST /api/convert/estimate-tiles`
**Type**: New endpoint

## Purpose

Calculate the estimated number of tiles that would be generated for a given page/area without starting a conversion job. Used by the frontend to show tile count preview.

## Request

### Schema

```typescript
interface TileEstimateRequest {
  pageWidth: number;             // Required: page width in native DPI pixels
  pageHeight: number;            // Required: page height in native DPI pixels
  tileSize?: number;             // Optional: 256-4096, default 1920
  overlap?: number;              // Optional: >= 0, default 250

  // Optional: if provided, estimate for area only
  areaSelection?: {
    x: number;                   // >= 0
    y: number;                   // >= 0
    width: number;               // > 0
    height: number;              // > 0
  };
}
```

### Example: Full Page Estimate

```json
{
  "pageWidth": 7200,
  "pageHeight": 9300,
  "tileSize": 1920,
  "overlap": 250
}
```

### Example: Area Estimate

```json
{
  "pageWidth": 7200,
  "pageHeight": 9300,
  "tileSize": 1920,
  "overlap": 250,
  "areaSelection": {
    "x": 1000,
    "y": 500,
    "width": 4000,
    "height": 3000
  }
}
```

## Response

### Schema

```typescript
interface TileEstimateResponse {
  rows: number;           // Number of rows in tile grid
  cols: number;           // Number of columns in tile grid
  total: number;          // Total tile count
  tiles: TilePreview[];   // Preview of tile positions
}

interface TilePreview {
  row: number;            // 0-indexed
  col: number;            // 0-indexed
  x: number;              // Pixel x of tile top-left
  y: number;              // Pixel y of tile top-left
}
```

### Example: Full Page Response

```json
{
  "rows": 5,
  "cols": 4,
  "total": 20,
  "tiles": [
    {"row": 0, "col": 0, "x": 0, "y": 0},
    {"row": 0, "col": 1, "x": 1670, "y": 0},
    {"row": 0, "col": 2, "x": 3340, "y": 0},
    {"row": 0, "col": 3, "x": 5010, "y": 0},
    {"row": 1, "col": 0, "x": 0, "y": 1670}
  ]
}
```

### Example: Area Response (fewer tiles)

```json
{
  "rows": 2,
  "cols": 3,
  "total": 6,
  "tiles": [
    {"row": 0, "col": 0, "x": 0, "y": 0},
    {"row": 0, "col": 1, "x": 1670, "y": 0},
    {"row": 0, "col": 2, "x": 3340, "y": 0},
    {"row": 1, "col": 0, "x": 0, "y": 1670},
    {"row": 1, "col": 1, "x": 1670, "y": 1670},
    {"row": 1, "col": 2, "x": 3340, "y": 1670}
  ]
}
```

## Validation Rules

1. **pageWidth**: > 0
2. **pageHeight**: > 0
3. **tileSize**: 256 <= value <= 4096
4. **overlap**: >= 0, < tileSize
5. **areaSelection** (if provided):
   - `x >= 0`, `y >= 0`
   - `width > 0`, `height > 0`
   - Area is clamped to page bounds (no error, just constrained)

## Error Responses

### 400 Bad Request - Invalid dimensions

```json
{
  "detail": "pageWidth must be greater than 0"
}
```

### 400 Bad Request - Invalid tile settings

```json
{
  "detail": "overlap must be less than tileSize"
}
```

## Notes

- This endpoint does not require an upload or job
- Used purely for client-side preview calculations
- Lightweight calculation, no file processing
- Frontend can cache results by input parameters
