# Quickstart: Responsive Preview Layout Implementation

**Feature**: 008-responsive-preview-layout
**Date**: 2026-01-19

## Prerequisites

- Node.js 18+
- npm or yarn
- Backend API running at `http://localhost:3001`

## Development Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies (if not already done)
npm install

# Start development server
npm run dev
```

Frontend runs at `http://localhost:3000`.

## Implementation Order

### Phase 1: Layout Foundation

1. **Create useWindowSize hook** (`frontend/src/hooks/useWindowSize.ts`)
   - Track window dimensions with debouncing
   - Calculate current breakpoint
   - Provide layout configuration based on breakpoint

2. **Update Tailwind configuration** (optional)
   - Add custom max-width if needed: `max-w-[1920px]`
   - No changes required if using inline styles

### Phase 2: Container Expansion

3. **Update BrowsePage layout** (`frontend/src/app/browse/page.tsx`)
   - Replace `max-w-5xl` with responsive container
   - Apply breakpoint-based max-width classes

4. **Update Navigation component** (`frontend/src/components/Navigation/index.tsx`)
   - Match container width to page layout

### Phase 3: Preview Panel Enhancements

5. **Enhance TileLayoutPreview** (`frontend/src/components/TileLayoutPreview/TileLayoutPreview.tsx`)
   - Replace fixed 300px height with clamp()
   - Add fullWidth prop support
   - Improve preview scaling

### Phase 4: Thumbnail Integration

6. **Create DrawingThumbnail component** (`frontend/src/components/DrawingThumbnail/`)
   - Implement lazy loading with IntersectionObserver
   - Add hover-to-enlarge functionality
   - Handle loading/error states

7. **Update DrawingList component** (`frontend/src/components/DrawingList/DrawingList.tsx`)
   - Add thumbnail column
   - Integrate DrawingThumbnail component
   - Maintain responsive table behavior

### Phase 5: Polish & Testing

8. **Add accessibility improvements**
   - Alt text for thumbnails
   - Keyboard-accessible hover preview
   - Reduced motion support

9. **Add unit tests**
   - useWindowSize hook tests
   - DrawingThumbnail component tests
   - Layout breakpoint tests

10. **Add E2E tests**
    - Responsive layout verification
    - Thumbnail loading verification

## Key Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/app/browse/page.tsx` | Container width, layout grid |
| `frontend/src/components/TileLayoutPreview/TileLayoutPreview.tsx` | Dynamic height |
| `frontend/src/components/DrawingList/DrawingList.tsx` | Add thumbnail column |
| `frontend/src/components/Navigation/index.tsx` | Match container width |
| `frontend/tailwind.config.js` | Custom max-width (optional) |

## New Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/hooks/useWindowSize.ts` | Window size tracking |
| `frontend/src/components/DrawingThumbnail/index.tsx` | Thumbnail component |
| `frontend/src/components/DrawingThumbnail/HoverPreview.tsx` | Enlarged preview overlay |
| `frontend/src/types/layout.ts` | Layout type definitions |

## Testing Commands

```bash
# Run unit tests
npm run test

# Run E2E tests (requires backend running)
npm run test:e2e

# Run specific test file
npm run test -- src/hooks/useWindowSize.test.ts

# Test with coverage
npm run test:coverage
```

## Manual Testing Checklist

### Layout Verification

- [ ] Open browse page at 1920px width - content uses >80% horizontal space
- [ ] Open browse page at 2560px width - content capped at reasonable max
- [ ] Resize browser to 1280px - layout remains usable
- [ ] Resize browser to 768px - single column layout, no horizontal scroll
- [ ] Preview panel height adjusts with window height

### Thumbnail Verification

- [ ] Thumbnails appear in drawing list for drawings with files
- [ ] "No Preview" placeholder for drawings without files
- [ ] Thumbnails lazy load as user scrolls
- [ ] Loading skeleton shown while thumbnail fetches
- [ ] Hover shows enlarged preview
- [ ] Enlarged preview accessible via keyboard (Tab + Enter)

### Performance Verification

- [ ] Page load under 3 seconds with visible thumbnails
- [ ] Smooth scrolling through drawing list
- [ ] No layout jank on window resize
- [ ] Console shows no errors or warnings

## Common Issues

### Thumbnails Not Loading

1. Check backend is running at `http://localhost:3001`
2. Check browser console for CORS errors
3. Verify drawing has `hasFile: true`

### Layout Not Responsive

1. Check breakpoint classes are applied correctly
2. Verify no conflicting CSS (check DevTools)
3. Ensure container uses correct max-width classes

### Hover Preview Not Showing

1. Check z-index is sufficient (should be z-50 or higher)
2. Verify positioned container has `position: relative`
3. Check for overflow: hidden on parent elements
