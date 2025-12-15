# Quickstart: Browse History Feature

**Feature**: 005-browse-history
**Branch**: `005-browse-history`

## Prerequisites

- Backend running on port 3001
- Frontend running on port 3000
- At least one completed upload/conversion job (for testing)

## Quick Test

1. **Start the backend**:
   ```bash
   python -m src.cli.main serve --port 3001
   ```

2. **Start the frontend**:
   ```bash
   cd frontend && npm run dev
   ```

3. **Upload a test PDF** (if no existing jobs):
   - Navigate to http://localhost:3000
   - Upload a PDF and process a few pages

4. **Access History**:
   - Click the "History" tab in the navigation
   - View list of past uploads
   - Click an entry to see processed pages
   - Click a page to see generated tiles

## Key Files to Implement

### Backend (Priority Order)

1. **`src/api/jobs.py`** - Extend existing endpoints:
   - `GET /api/jobs` - List jobs by IDs
   - `GET /api/jobs/{id}/pages` - Get page info
   - `GET /api/jobs/{id}/pages/{num}/tiles` - Get tile URLs
   - `GET /api/jobs/{id}/pdf-url` - Get PDF presigned URL

2. **`src/services/job_service.py`** - Add service functions:
   - `get_jobs_by_ids()`
   - `get_job_pages()`
   - `get_page_tiles()`

### Frontend (Priority Order)

1. **`src/lib/history-storage.ts`** - localStorage wrapper
2. **`src/types/history.ts`** - TypeScript types
3. **`src/hooks/useHistory.ts`** - History management hook
4. **`src/components/Navigation/`** - Tab navigation
5. **`src/app/history/page.tsx`** - History list page
6. **`src/components/HistoryList/`** - History list component
7. **`src/app/history/[jobId]/page.tsx`** - Job detail/pages page
8. **`src/components/PageGrid/`** - Page thumbnails grid
9. **`src/app/history/[jobId]/[pageNum]/page.tsx`** - Tile grid page
10. **`src/components/TileGrid/`** - Tile grid component

## API Contract Reference

See `contracts/history-api.yaml` for full OpenAPI specification.

### Quick Reference

| Endpoint | Purpose |
|----------|---------|
| `GET /api/jobs?ids=1,2,3` | Batch fetch jobs for sync |
| `GET /api/jobs/{id}` | Get job details (existing, enhanced) |
| `GET /api/jobs/{id}/pages` | List processed pages |
| `GET /api/jobs/{id}/pages/{num}/tiles` | Get tile URLs |
| `GET /api/jobs/{id}/pdf-url` | Get PDF URL for thumbnails |
| `GET /api/jobs/{id}/download` | Download ZIP (existing) |

## Testing

### Backend Tests
```bash
# Run all tests
pytest

# Run history-specific tests
pytest tests/contract/test_history_api.py
pytest tests/unit/test_job_service.py -k history
```

### Frontend Tests
```bash
cd frontend

# Unit tests
npm run test

# E2E tests (requires backend)
npm run test:e2e -- --grep history
```

## localStorage Schema

```javascript
// Key: 'blueprint-imager-history'
// Value: JSON array
[
  {
    "jobId": 42,
    "uploadId": 15,
    "fileName": "floor-plans.pdf",
    "uploadedAt": "2025-12-13T10:30:00Z",
    "pageCount": 25,
    "selectedPages": [1, 2, 3, 4, 5],
    "status": "completed",
    "lastSyncedAt": "2025-12-13T10:35:00Z",
    "settings": { "dpi": 600, "tileSize": 1920, "overlap": 250 }
  }
]
```

## Common Development Tasks

### Add entry to history (after upload completes)
```typescript
import { addHistoryEntry } from '@/lib/history-storage';

addHistoryEntry({
  jobId: response.jobId,
  uploadId: response.uploadId,
  fileName: file.name,
  // ...
});
```

### Sync history with server
```typescript
import { useHistory } from '@/hooks/useHistory';

const { entries, syncWithServer, isLoading } = useHistory();

// On component mount
useEffect(() => {
  syncWithServer();
}, []);
```

### Delete history entry
```typescript
import { deleteHistoryEntry } from '@/lib/history-storage';

deleteHistoryEntry(jobId);  // Removes from localStorage only
```

## Performance Targets

| Operation | Target |
|-----------|--------|
| History list load | < 2 seconds |
| Page thumbnails | < 3 seconds (100 pages) |
| Tile grid | < 3 seconds (200 tiles) |

## Troubleshooting

### History not showing entries
- Check localStorage in browser DevTools
- Verify key: `blueprint-imager-history`
- Check for JSON parse errors in console

### Thumbnails not loading
- Verify original PDF exists in S3
- Check PDF presigned URL endpoint returns valid URL
- Ensure pdfjs-dist worker is properly configured

### Tiles returning 403
- Presigned URLs expire after 1 hour
- Refresh tile grid to get new URLs
- Check S3 bucket permissions
