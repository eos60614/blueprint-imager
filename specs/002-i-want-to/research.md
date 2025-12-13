# Research: PDF Upload Frontend with Page Selection

**Branch**: `002-i-want-to` | **Date**: 2025-12-12

## Research Areas

### 1. Direct S3 Upload Strategy (Avoiding Vercel Limits)

**Decision**: Use AWS S3 presigned URLs for direct browser-to-S3 uploads

**Rationale**:
- Vercel has strict limits: 4.5MB body size for serverless functions, 10s execution timeout on edge
- PDFs up to 100MB need to bypass Vercel entirely
- Presigned URLs allow the browser to upload directly to S3 with temporary credentials
- No server-side processing of the file stream needed

**Implementation Pattern**:
1. Frontend requests presigned URL from Next.js API route
2. Next.js API route calls AWS SDK to generate presigned PUT URL (expires in 15 minutes)
3. Frontend uploads file directly to S3 using presigned URL
4. Frontend notifies backend of upload completion with S3 key

**Alternatives Considered**:
- Chunked upload through Vercel: Still limited by function timeout for reassembly
- Using Vercel Blob Storage: Limited to 500MB total free tier, not suitable for image storage
- Cloudflare R2: Viable but adds another service; AWS S3 is more familiar

### 2. PDF Thumbnail Generation

**Decision**: Use pdf.js (pdfjs-dist) for client-side PDF rendering

**Rationale**:
- No server round-trips needed for thumbnails
- pdf.js is battle-tested (used by Firefox)
- Works entirely in the browser using canvas rendering
- Can render individual pages on demand

**Implementation Pattern**:
1. Load PDF into pdf.js after upload confirmation
2. Render each page to a canvas at low resolution (150 DPI)
3. Convert canvas to thumbnail image
4. Display in grid for page selection

**Alternatives Considered**:
- Server-side thumbnail generation: Adds latency, requires backend changes
- Using pdf-thumbnail npm package: Wrapper around pdf.js, adds unnecessary abstraction
- Sharp on Vercel Edge: Not supported in edge runtime

### 3. Page Range Parsing

**Decision**: Custom parser with regex + validation

**Rationale**:
- Simple grammar: ranges (1-10), individuals (3, 7), combinations (1-5, 8, 12-15)
- No existing library handles this exact format well
- Easy to validate against known page count
- Clear error messages for invalid input

**Implementation Pattern**:
```typescript
parsePageSelection("1-5, 8, 12-15", totalPages: 50)
// Returns: [1, 2, 3, 4, 5, 8, 12, 13, 14, 15]
// Throws on invalid input with specific error message
```

**Alternatives Considered**:
- Using existing range-parser packages: Most are for HTTP range headers, not page selection
- Free-form input with AI parsing: Over-engineering for this use case

### 4. Frontend Framework

**Decision**: Next.js 14 with App Router

**Rationale**:
- First-class Vercel deployment support
- App Router provides better layouts and loading states
- Built-in API routes for presigned URL generation
- Server components reduce client-side JavaScript
- TypeScript support out of the box

**Alternatives Considered**:
- Vite + React: No built-in API routes, would need separate backend for presigned URLs
- Remix: Good but less mature Vercel integration
- Plain React SPA: Would need separate backend for presigned URL generation

### 5. Backend API Changes Required

**Decision**: Extend existing FastAPI backend with new endpoints

**New Endpoints Needed**:
1. `POST /api/upload/presign` - Generate presigned S3 URL for PDF upload
2. `POST /api/upload/complete` - Confirm upload and get page count
3. `POST /api/convert/pages` - Convert specific pages (not whole PDF)
4. `GET /api/jobs/{id}/thumbnails` - Get thumbnail URLs (if server-generated)

**Rationale**:
- Existing `/convert` endpoint converts entire PDF, not selected pages
- Need new endpoint that accepts page list parameter
- S3 integration is new capability for the backend

**Alternatives Considered**:
- Modifying existing `/convert` endpoint: Would break existing CLI behavior
- All processing in Vercel: Not possible due to compute limits and Python dependencies

### 6. State Management

**Decision**: React hooks + Context API (with option to add Zustand if needed)

**Rationale**:
- Application has limited state complexity
- Main states: upload progress, page selection, processing status
- Context sufficient for sharing state between components
- Zustand as fallback if prop drilling becomes unwieldy

**State Structure**:
```typescript
interface AppState {
  file: File | null;
  s3Key: string | null;
  pageCount: number;
  selectedPages: number[];
  jobId: string | null;
  jobStatus: 'idle' | 'uploading' | 'processing' | 'complete' | 'error';
  error: string | null;
}
```

### 7. AWS S3 Configuration

**Decision**: Single S3 bucket with prefix-based organization

**Bucket Structure**:
```
blueprint-imager-uploads/
├── uploads/{uuid}/           # Original PDFs
│   └── document.pdf
└── output/{job_id}/          # Generated tiles
    └── tiles/
        └── *.png
```

**Security**:
- Presigned URLs expire in 15 minutes
- Bucket policy restricts direct access
- CORS configured for frontend domain
- Server-side encryption enabled (SSE-S3)

### 8. Error Handling Strategy

**Decision**: Graceful degradation with clear user feedback

**Categories**:
1. **Upload errors**: Network failure, file too large, invalid file type
2. **Validation errors**: Invalid page range, pages exceed document
3. **Processing errors**: Backend conversion failure
4. **System errors**: S3 unavailable, backend unreachable

**User Experience**:
- Each error shows specific, actionable message
- Upload failures allow retry without re-selecting file
- Processing failures show partial progress if applicable

## Open Questions Resolved

### From Spec

| Question | Resolution |
|----------|------------|
| Save/edit selections before submitting? | No - single session workflow. User can modify selection until submit. |
| History of previous uploads? | No - anonymous, no persistence between sessions. |

## Dependencies Summary

### Frontend (new)
- next: ^14.0.0
- react: ^18.2.0
- react-dom: ^18.2.0
- pdfjs-dist: ^4.0.0
- react-dropzone: ^14.0.0
- tailwindcss: ^3.4.0
- @aws-sdk/client-s3: ^3.400.0 (for presigned URLs)
- @aws-sdk/s3-request-presigner: ^3.400.0
- swr: ^2.2.0

### Backend (additions to existing)
- boto3: ^1.34.0 (AWS SDK for Python)

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| pdf.js fails on complex PDFs | Low | Medium | Fallback to server-side thumbnails |
| S3 presigned URL expires during upload | Low | Low | Generate new URL on retry |
| Large PDF (100MB) slow to render thumbnails | Medium | Medium | Lazy load thumbnails, show loading state |
| Vercel cold start affects UX | Low | Low | Use edge runtime where possible |
