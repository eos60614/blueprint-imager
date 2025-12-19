# API Contract: Convert Endpoint (Extended)

**Endpoint**: `POST /api/convert/pages`
**Change Type**: Backward-compatible extension

## Request

### Schema

```typescript
interface ConvertPagesRequest {
  uploadId: number;                    // Required: reference to uploaded PDF
  selectedPages: number[];             // Required: 1-indexed page numbers
  dpi?: number;                        // Optional: 72-2400, default 600
  tileSize?: number;                   // Optional: 256-4096, default 1920
  overlap?: number;                    // Optional: >= 0, default 250

  // NEW: Optional area selections
  areaSelections?: AreaSelectionInput[];
}

interface AreaSelectionInput {
  pageNum: number;   // 1-indexed, must be in selectedPages
  x: number;         // >= 0, left edge in native DPI pixels
  y: number;         // >= 0, top edge in native DPI pixels
  width: number;     // > 0
  height: number;    // > 0
}
```

### Example: Full Page (backward compatible)

```json
{
  "uploadId": 123,
  "selectedPages": [1, 2, 3],
  "dpi": 600,
  "tileSize": 1920,
  "overlap": 250
}
```

### Example: With Area Selection

```json
{
  "uploadId": 123,
  "selectedPages": [1, 2, 3],
  "dpi": 600,
  "tileSize": 1920,
  "overlap": 250,
  "areaSelections": [
    {
      "pageNum": 1,
      "x": 1000,
      "y": 500,
      "width": 5000,
      "height": 4000
    },
    {
      "pageNum": 3,
      "x": 0,
      "y": 0,
      "width": 3000,
      "height": 3000
    }
  ]
}
```

## Response

No changes to response schema.

```typescript
interface ConvertPagesResponse {
  jobId: number;
  status: "processing";
  totalPages: number;
}
```

### Example Response

```json
{
  "jobId": 456,
  "status": "processing",
  "totalPages": 3
}
```

## Validation Rules

1. **uploadId**: Must reference existing upload with status "ready"
2. **selectedPages**: All page numbers must be valid (1 to page_count)
3. **areaSelections** (if provided):
   - Each `pageNum` must be in `selectedPages`
   - `x >= 0`, `y >= 0`
   - `width > 0`, `height > 0`
   - Area should be within page bounds (warning if exceeds, clamped to bounds)
   - Maximum one selection per page (last one wins if duplicates)

## Behavior

### Without areaSelections (or null/empty)
- Tiles entire page as before
- Backward compatible with existing clients

### With areaSelections
- For pages with area selection: Generate only tiles that intersect the area
- For pages without area selection (in selectedPages but not in areaSelections): Tile entire page
- Tile grid calculation uses same algorithm (stride = tileSize - overlap)
- Tiles fully encompass the selected area (may include more tiles than strictly needed)

## Error Responses

### 400 Bad Request - Invalid area

```json
{
  "detail": "Invalid area selection for page 1: x + width exceeds page width"
}
```

### 400 Bad Request - Page not selected

```json
{
  "detail": "Area selection references page 5 which is not in selectedPages"
}
```

### 404 Not Found - Upload not found

```json
{
  "detail": "Upload with id 123 not found"
}
```
