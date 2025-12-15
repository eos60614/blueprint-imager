# Research: Browse History Feature

**Feature**: 005-browse-history
**Date**: 2025-12-13

## Overview

This document captures research decisions for implementing the browse history feature. No NEEDS CLARIFICATION items were identified in the Technical Context - the existing codebase provides clear patterns to follow.

---

## 1. Local Storage for History References

**Decision**: Use browser localStorage to store history entry references (job IDs, metadata)

**Rationale**:
- Anonymous users (no authentication) means no server-side user association
- localStorage persists across browser sessions until explicitly cleared
- Sufficient capacity for hundreds of history entries (~5MB limit, each entry <1KB)
- Simple to implement with existing browser APIs

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| IndexedDB | Overkill for simple key-value storage; localStorage sufficient |
| Session storage | Lost on browser close; poor UX for returning users |
| Cookies | Size limits (4KB), unnecessary server transmission |
| Server-side with IP tracking | Privacy concerns, unreliable (dynamic IPs), over-complex |

**Implementation Pattern**:
```typescript
// History entry stored in localStorage
interface HistoryEntry {
  jobId: number;
  uploadId: number;
  fileName: string;
  uploadedAt: string;  // ISO timestamp
  pageCount: number;
  selectedPages: number[];
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// Storage key: 'blueprint-imager-history'
// Value: JSON array of HistoryEntry objects
```

---

## 2. Thumbnail Rendering Strategy

**Decision**: Re-render thumbnails from original PDF using pdfjs-dist on client side

**Rationale**:
- Spec clarification confirmed: thumbnails re-rendered from PDF (not pre-cached)
- Original PDF must be retained in S3 for 30-day retention period
- Client-side rendering avoids server load for thumbnail generation
- Existing pdfjs-dist integration can be reused from upload flow

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Pre-generate thumbnails in S3 | Extra storage cost, complexity in cleanup |
| Server-side thumbnail API | Adds server load, latency for each thumbnail |
| Cache thumbnails indefinitely | Storage bloat, stale data issues |

**Implementation Pattern**:
- Fetch signed URL for PDF from backend
- Use pdfjs-dist to render page thumbnails at reduced scale (e.g., 200px width)
- Cache rendered thumbnails in component state during session

---

## 3. Tile Listing and Display

**Decision**: Add new API endpoint to list tiles for a job/page with presigned URLs

**Rationale**:
- Tiles already stored in S3 with predictable key pattern: `output/{jobId}/tiles/page_{pageNum}_tile_{row}_{col}.png`
- Backend can enumerate tiles and generate presigned URLs for direct browser access
- Lazy loading in frontend prevents memory issues with hundreds of tiles

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Direct S3 listing from frontend | Requires exposing AWS credentials |
| Download all tiles at once | Memory issues, poor UX for large pages |
| Generate tile manifest at job completion | Extra complexity, storage |

**Implementation Pattern**:
```python
# Backend endpoint: GET /api/jobs/{job_id}/pages/{page_num}/tiles
# Returns: List of tile objects with position and presigned URL
{
  "tiles": [
    {"row": 0, "col": 0, "url": "https://s3..."},
    {"row": 0, "col": 1, "url": "https://s3..."},
    ...
  ],
  "totalTiles": 42,
  "gridSize": {"rows": 6, "cols": 7}
}
```

---

## 4. Job Details API Extension

**Decision**: Extend existing jobs API with endpoints for detailed job information

**Rationale**:
- Existing `GET /api/jobs/{job_id}` returns status but lacks detail for history view
- New endpoint needed for page-level information (which pages processed, tile counts)
- Follows existing API patterns and FastAPI structure

**New Endpoints**:
| Endpoint | Purpose |
|----------|---------|
| `GET /api/jobs` | List jobs by IDs (for history sync) |
| `GET /api/jobs/{id}/pages` | Get processed pages with metadata |
| `GET /api/jobs/{id}/pages/{num}/tiles` | Get tile URLs for a page |
| `GET /api/jobs/{id}/pdf-url` | Get presigned URL for original PDF |

---

## 5. Navigation Pattern

**Decision**: Tab-based navigation with "Upload" and "History" tabs in main nav

**Rationale**:
- Spec clarification confirmed: dedicated History tab always visible
- Tab pattern is familiar, discoverable UX
- Matches existing single-page app structure with Next.js App Router

**Implementation Pattern**:
- Add `Navigation` component to main layout
- Use Next.js `Link` for client-side navigation
- Highlight active tab based on current route (`/` vs `/history/*`)

---

## 6. History Synchronization

**Decision**: Sync local history with server on history view load

**Rationale**:
- Local storage may have stale status (e.g., job completed while user away)
- Batch fetch job statuses on history page load
- Update local storage with current server state

**Implementation Pattern**:
```typescript
// On history page mount:
// 1. Load entries from localStorage
// 2. Extract jobIds
// 3. Call GET /api/jobs?ids=1,2,3,4,5
// 4. Update local entries with server status
// 5. Mark unavailable jobs (404) with 'unavailable' status
```

---

## 7. Pagination Strategy

**Decision**: Infinite scroll with 20-item pages for history list

**Rationale**:
- Edge case identified: users with 100+ uploads
- Infinite scroll is modern, smooth UX
- 20 items per page balances performance and usability

**Alternatives Considered**:
| Alternative | Rejected Because |
|-------------|------------------|
| Traditional pagination | More clicks, less fluid experience |
| Load all at once | Performance issues at scale |
| Virtual scrolling | Over-complex for list of simple items |

---

## 8. Delete Entry Implementation

**Decision**: Delete removes local history reference only; server files retained

**Rationale**:
- Spec clarification confirmed: local-only deletion
- Simplifies implementation (no server-side delete endpoint)
- Server cleanup handled by existing 30-day retention policy

**Implementation Pattern**:
```typescript
function deleteHistoryEntry(jobId: number): void {
  const entries = getHistory();
  const updated = entries.filter(e => e.jobId !== jobId);
  localStorage.setItem('blueprint-imager-history', JSON.stringify(updated));
}
```

---

## Summary of Key Decisions

| Topic | Decision |
|-------|----------|
| History storage | Browser localStorage |
| Thumbnails | Client-side PDF rendering via pdfjs-dist |
| Tile access | Backend presigned URLs per request |
| Navigation | Tab-based (Upload / History) |
| Sync strategy | Batch status check on page load |
| Pagination | Infinite scroll, 20 items |
| Deletion | Local reference only |
