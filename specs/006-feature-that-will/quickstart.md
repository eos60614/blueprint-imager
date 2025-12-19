# Quickstart: Area Selection for Tiling

**Feature Branch**: `006-feature-that-will`
**Date**: 2025-12-19

## Overview

This feature allows users to draw a rectangle on the PDF page preview to select a specific area for tiling. Only tiles that intersect with the selected area will be generated.

## User Workflow

1. Upload a PDF file
2. View page previews (paginated, 2 pages at a time)
3. Draw a rectangle on any page to select the area to tile
4. Start conversion - ONLY tiles covering the selected area are generated (no blank detection)
5. Select tiles to upload to Roboflow
6. Tiles uploaded to S3 → sent to Roboflow

**Simplified Flow**: User selects area → Generate only those tiles → Upload to S3 → Send to Roboflow (no intermediate storage of unused tiles)

## Key Components

### Frontend

| Component | Purpose |
|-----------|---------|
| `AreaSelector` | Canvas overlay for drawing selection rectangle |
| `PaginatedPagePreview` | Shows 2 pages at a time with navigation |
| `AreaSelectionContext` | Manages selection state per page |
| `TileEstimateDisplay` | Shows estimated tile count for selection |

### Backend

| Component | Purpose |
|-----------|---------|
| `tile_calculator.py` | Calculates tiles intersecting with area |
| `POST /api/convert/pages` | Extended to accept areaSelections |
| `POST /api/convert/estimate-tiles` | Returns tile count estimate |

## Development Setup

```bash
# Backend
cd /home/nirav/projects/blueprint-imager
python -m src.cli.main serve --port 3001

# Frontend
cd frontend
npm run dev
```

## Testing the Feature

### Manual Testing

1. Start backend and frontend servers
2. Navigate to http://localhost:3000
3. Upload a multi-page PDF
4. On the page preview:
   - Pages shown 2 at a time
   - Click and drag to draw a selection rectangle
   - Rectangle should be visible with visual feedback
   - Tile estimate should update
5. Click "Convert"
6. Verify job completes with fewer tiles than full-page conversion

### API Testing

```bash
# Full page conversion (existing behavior)
curl -X POST http://localhost:3001/api/convert/pages \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": 1,
    "selectedPages": [1],
    "dpi": 600,
    "tileSize": 1920,
    "overlap": 250
  }'

# Area selection conversion
curl -X POST http://localhost:3001/api/convert/pages \
  -H "Content-Type: application/json" \
  -d '{
    "uploadId": 1,
    "selectedPages": [1],
    "dpi": 600,
    "tileSize": 1920,
    "overlap": 250,
    "areaSelections": [
      {"pageNum": 1, "x": 1000, "y": 500, "width": 3000, "height": 2000}
    ]
  }'

# Tile estimate
curl -X POST http://localhost:3001/api/convert/estimate-tiles \
  -H "Content-Type: application/json" \
  -d '{
    "pageWidth": 7200,
    "pageHeight": 9300,
    "areaSelection": {"x": 1000, "y": 500, "width": 3000, "height": 2000}
  }'
```

## File Structure

```
# New Frontend Files
frontend/src/
├── components/
│   ├── AreaSelector/
│   │   └── index.tsx           # Rectangle drawing canvas
│   └── PaginatedPagePreview/
│       └── index.tsx           # 2-page paginated view
├── contexts/
│   └── AreaSelectionContext.tsx
├── lib/
│   └── coordinate-utils.ts     # Display ↔ native conversion
└── types/
    └── area-selection.ts

# New Backend Files
src/
├── models/
│   └── area_selection.py
└── services/
    └── tile_calculator.py

# Modified Files
src/api/convert.py              # Add areaSelections param
frontend/src/components/ThumbnailGrid/  # Add pagination
```

## Verification Checklist

- [ ] Rectangle can be drawn on page preview
- [ ] Selection persists when navigating between pages
- [ ] Clear selection returns to full-page mode
- [ ] Tile estimate updates on selection change
- [ ] API accepts areaSelections parameter
- [ ] Conversion generates ONLY tiles for selected area (no extra tiles)
- [ ] Full-page conversion works without areaSelections (backward compatible)
- [ ] Page preview shows max 2 pages with pagination controls
- [ ] No blank tile detection in this flow (user selection is the filter)
- [ ] Direct upload path: generate → S3 → Roboflow
