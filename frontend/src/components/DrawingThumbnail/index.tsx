'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { config } from '@/lib/config';
import { HoverPreview } from './HoverPreview';
import type { DrawingThumbnailProps, DrawingThumbnailState } from '@/types/procore';

const SIZE_MAP = {
  sm: { width: 60, height: 48 },
  md: { width: 80, height: 64 },
  lg: { width: 120, height: 96 },
} as const;

export function DrawingThumbnail({
  drawingId,
  hasFile,
  drawingNumber,
  onHover,
  size = 'md',
}: DrawingThumbnailProps) {
  const [state, setState] = useState<DrawingThumbnailState>({
    drawingId,
    status: 'idle',
    imageUrl: null,
    error: null,
  });
  const [showPreview, setShowPreview] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const dimensions = SIZE_MAP[size];

  // Lazy loading with IntersectionObserver
  useEffect(() => {
    if (!hasFile || state.status !== 'idle') return;

    const element = containerRef.current;
    if (!element) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          // Start loading when visible
          setState((prev) => ({ ...prev, status: 'loading' }));
          observerRef.current?.disconnect();
        }
      },
      {
        rootMargin: '200px', // Load 200px before entering viewport
        threshold: 0,
      }
    );

    observerRef.current.observe(element);

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasFile, state.status]);

  // Fetch thumbnail when status changes to loading
  useEffect(() => {
    if (state.status !== 'loading') return;

    const fetchThumbnail = async () => {
      try {
        const response = await fetch(
          `${config.apiUrl}/api/procore/drawings/${drawingId}/preview?dpi=72`
        );

        if (!response.ok) {
          throw new Error('Failed to load thumbnail');
        }

        const width = parseInt(response.headers.get('X-Preview-Width') || '0');
        const height = parseInt(response.headers.get('X-Preview-Height') || '0');
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);

        setState((prev) => ({
          ...prev,
          status: 'loaded',
          imageUrl: url,
          width,
          height,
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: 'Failed to load',
        }));
      }
    };

    fetchThumbnail();
  }, [state.status, drawingId]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (state.imageUrl) {
        URL.revokeObjectURL(state.imageUrl);
      }
    };
  }, [state.imageUrl]);

  const handleMouseEnter = useCallback(() => {
    if (state.status === 'loaded' && state.imageUrl) {
      setShowPreview(true);
      onHover?.(drawingId);
    }
  }, [state.status, state.imageUrl, drawingId, onHover]);

  const handleMouseLeave = useCallback(() => {
    setShowPreview(false);
    onHover?.(null);
  }, [onHover]);

  const handleFocus = useCallback(() => {
    if (state.status === 'loaded' && state.imageUrl) {
      setShowPreview(true);
      onHover?.(drawingId);
    }
  }, [state.status, state.imageUrl, drawingId, onHover]);

  const handleBlur = useCallback(() => {
    setShowPreview(false);
    onHover?.(null);
  }, [onHover]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (state.status === 'loaded' && state.imageUrl) {
          setShowPreview((prev) => !prev);
        }
      }
    },
    [state.status, state.imageUrl]
  );

  // No file placeholder
  if (!hasFile) {
    return (
      <div
        className="bg-gray-100 rounded flex items-center justify-center text-gray-400"
        style={{ width: dimensions.width, height: dimensions.height }}
        aria-label={`No preview available for drawing ${drawingNumber}`}
      >
        <svg
          className="w-6 h-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
    );
  }

  // Loading skeleton
  if (state.status === 'idle' || state.status === 'loading') {
    return (
      <div
        ref={containerRef}
        className="bg-gray-200 rounded animate-pulse"
        style={{ width: dimensions.width, height: dimensions.height }}
        aria-label={`Loading thumbnail for drawing ${drawingNumber}`}
        aria-busy="true"
      />
    );
  }

  // Error state
  if (state.status === 'error') {
    return (
      <div
        className="bg-red-50 border border-red-200 rounded flex items-center justify-center text-red-400"
        style={{ width: dimensions.width, height: dimensions.height }}
        aria-label={`Failed to load preview for drawing ${drawingNumber}`}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
    );
  }

  // Loaded thumbnail with hover preview
  return (
    <div
      ref={containerRef}
      className="relative group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Thumbnail of drawing ${drawingNumber}. Press Enter or Space to toggle enlarged preview.`}
      aria-expanded={showPreview}
    >
      <img
        src={state.imageUrl!}
        alt={`Thumbnail of drawing ${drawingNumber}`}
        className="rounded border border-gray-200 object-cover cursor-pointer transition-transform duration-150 motion-reduce:transition-none group-hover:scale-105 motion-reduce:group-hover:scale-100 group-focus:scale-105 motion-reduce:group-focus:scale-100 group-focus:ring-2 group-focus:ring-blue-500"
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
      />

      {state.imageUrl && (
        <HoverPreview
          imageUrl={state.imageUrl}
          drawingNumber={drawingNumber}
          isVisible={showPreview}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}

export { HoverPreview };
