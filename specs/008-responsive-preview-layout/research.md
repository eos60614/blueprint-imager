# Research: Responsive Preview Layout for Large Format PDFs

**Feature**: 008-responsive-preview-layout
**Date**: 2026-01-19

## Research Questions

### 1. Optimal Container Width Strategy for Large Format Drawings

**Decision**: Use fluid container with maximum cap at 1920px
**Rationale**:
- Current `max-w-5xl` (1024px) wastes 47% of screen space on a 1920px monitor
- Full-width layout (`max-w-full`) causes readability issues on ultrawide monitors (text lines become too long)
- A cap at 1920px matches the primary target resolution mentioned in the spec
- This provides ~87% space utilization on 1920px screens while remaining functional on larger displays

**Alternatives Considered**:
| Option | Pros | Cons |
|--------|------|------|
| `max-w-full` | Maximum space usage | Unusable on ultrawide (3440px) displays, text readability suffers |
| `max-w-7xl` (1280px) | Safe increment | Only 25% improvement, still wastes space |
| `max-w-[1920px]` | Matches primary use case | May need custom Tailwind config |
| `container-queries` | Future-proof | Poor browser support, complex implementation |

### 2. Drawing List Thumbnail Implementation

**Decision**: Add inline thumbnail column using existing preview endpoint at 72 DPI
**Rationale**:
- The backend already provides `/api/procore/drawings/{id}/preview?dpi=72` endpoint
- 72 DPI is appropriate for thumbnails (matches spec assumption)
- Lazy loading with IntersectionObserver prevents bandwidth issues
- Thumbnail column should be 80-120px wide (sufficient for drawing identification)

**Implementation Pattern**:
```tsx
// Thumbnail component with lazy loading
const DrawingThumbnail = ({ drawingId, hasFile }) => {
  const [isVisible, setIsVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Use IntersectionObserver for lazy loading
  // Fetch preview only when visible and hasFile is true
};
```

**Alternatives Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Client-side PDF rendering | Full control, no backend changes | Heavy CPU usage, large bundle size |
| Pre-generated thumbnails (S3) | Fast loading | Requires backend changes, storage cost |
| Server-side thumbnails | Existing endpoint available | Per-request generation, but cached |

### 3. Tile Preview Panel Sizing Strategy

**Decision**: Use viewport-relative height with minimum constraint
**Rationale**:
- Current fixed 300px height is insufficient for 40x32 inch drawings
- `calc(50vh - 8rem)` provides roughly half viewport height minus headers
- Minimum height of 400px ensures usability on smaller screens
- Maximum height of 800px prevents excessive space consumption on 4K displays

**CSS Implementation**:
```css
.preview-container {
  height: clamp(400px, calc(50vh - 8rem), 800px);
  overflow: auto;
}
```

**Alternatives Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Fixed 600px | Simple, predictable | Doesn't adapt to screen |
| Full viewport height | Maximum preview | No room for controls |
| Aspect ratio based | Matches drawing | Unpredictable layout shifts |

### 4. Responsive Breakpoint Strategy

**Decision**: Leverage existing Tailwind defaults with xl (1280px) and 2xl (1536px) breakpoints
**Rationale**:
- Tailwind's default breakpoints cover the required range (768px - 2560px)
- No custom configuration needed
- `xl` breakpoint is appropriate for switching to expanded layout
- `2xl` can be used for ultrawide optimizations

**Breakpoint Usage Plan**:
| Breakpoint | Width | Layout Behavior |
|------------|-------|-----------------|
| Base | 0-767px | Single column, stacked content |
| md | 768px | Two-column grid for settings/preview |
| lg | 1024px | Expanded container, larger thumbnails |
| xl | 1280px | Wide container (max-w-screen-xl) |
| 2xl | 1536px | Maximum container (1920px cap) |

### 5. Hover-to-Enlarge Interaction Pattern

**Decision**: Use CSS transform with positioned overlay
**Rationale**:
- CSS transforms are hardware-accelerated (smooth animation)
- Overlay positioning keeps thumbnail in context
- Click-through prevents blocking row selection
- 300ms transition provides comfortable visual feedback

**Implementation Pattern**:
```tsx
<div className="relative group">
  <img className="w-20 h-auto" />
  <div className="absolute hidden group-hover:block z-50
                  -top-4 left-full ml-2 p-2 bg-white shadow-xl rounded-lg">
    <img className="w-64 h-auto" />
  </div>
</div>
```

**Alternatives Considered**:
| Option | Pros | Cons |
|--------|------|------|
| Modal dialog | Large preview, full details | Requires click, interrupts flow |
| Tooltip component | Consistent with other UI | Less space for preview |
| CSS scale transform | Minimal code | Can overlap other content |

### 6. Loading State Handling

**Decision**: Use skeleton placeholders with shimmer animation
**Rationale**:
- Skeleton loading reduces perceived wait time
- Shimmer animation indicates activity
- Maintains layout stability (no content shifts)
- Consistent with modern UI patterns

**Skeleton Pattern**:
```tsx
const ThumbnailSkeleton = () => (
  <div className="w-20 h-16 bg-gray-200 rounded animate-pulse" />
);
```

### 7. Fallback for Missing Previews

**Decision**: Display consistent "No Preview" placeholder with icon
**Rationale**:
- Explicit visual indication (not blank space)
- Icon reinforces meaning at a glance
- Disabled state communicates non-actionable
- Matches existing "No File" badge styling

**Placeholder Pattern**:
```tsx
const NoPreviewPlaceholder = () => (
  <div className="w-20 h-16 bg-gray-100 rounded flex items-center justify-center">
    <DocumentIcon className="w-6 h-6 text-gray-400" />
  </div>
);
```

## Technology Decisions Summary

| Area | Decision | Justification |
|------|----------|---------------|
| Container width | max-w-[1920px] with fluid below | Balances space usage and readability |
| Thumbnails | Inline column with lazy loading | Uses existing API, good performance |
| Preview panel | clamp(400px, 50vh-8rem, 800px) | Responsive to viewport |
| Breakpoints | Tailwind defaults (xl, 2xl) | No custom config needed |
| Hover preview | CSS transform + positioned overlay | Hardware accelerated, accessible |
| Loading states | Skeleton with shimmer | Modern UX pattern |
| No-preview fallback | Icon placeholder | Clear visual communication |

## Performance Considerations

1. **Thumbnail lazy loading**: IntersectionObserver ensures only visible thumbnails are loaded
2. **Image sizing**: 72 DPI thumbnails are appropriately sized (~150KB max per image)
3. **CSS animations**: All transitions use transform/opacity for GPU acceleration
4. **DOM efficiency**: Reuse existing table structure, add column rather than replacing
5. **Network**: Consider HTTP/2 multiplexing for parallel thumbnail requests

## Accessibility Considerations

1. **Alt text**: All thumbnails will have descriptive alt text including drawing number
2. **Keyboard navigation**: Hover preview should also work on focus
3. **Screen readers**: Loading states announced via aria-live regions
4. **Color contrast**: Ensure skeleton/placeholder colors meet WCAG AA
5. **Motion**: Respect `prefers-reduced-motion` for animations
