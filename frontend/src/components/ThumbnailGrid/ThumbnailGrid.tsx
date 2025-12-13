'use client';

import { useEffect, useState, useCallback } from 'react';
import { Thumbnail } from './Thumbnail';
import type { ThumbnailState } from '@/types/state';

interface ThumbnailGridProps {
  pageCount: number;
  thumbnails: Map<number, ThumbnailState>;
  selectedPages: number[];
  onThumbnailClick?: (pageNumber: number) => void;
  onLoadThumbnails?: (pageNumbers: number[]) => void;
}

export function ThumbnailGrid({
  pageCount,
  thumbnails,
  selectedPages,
  onThumbnailClick,
  onLoadThumbnails,
}: ThumbnailGridProps) {
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());

  // Generate array of page numbers
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1);

  // Lazy load thumbnails for visible pages
  useEffect(() => {
    if (!onLoadThumbnails) return;

    const pagesToLoad = pageNumbers.filter(
      (pageNum) =>
        visiblePages.has(pageNum) &&
        !thumbnails.has(pageNum)
    );

    if (pagesToLoad.length > 0) {
      onLoadThumbnails(pagesToLoad);
    }
  }, [visiblePages, thumbnails, pageNumbers, onLoadThumbnails]);

  // Intersection observer for lazy loading
  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      entries.forEach((entry) => {
        const pageNum = parseInt(entry.target.getAttribute('data-page') || '0', 10);
        if (pageNum > 0) {
          setVisiblePages((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) {
              next.add(pageNum);
            }
            return next;
          });
        }
      });
    },
    []
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleIntersection, {
      rootMargin: '100px',
      threshold: 0.1,
    });

    // Observe all thumbnail containers
    const elements = document.querySelectorAll('[data-page]');
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [handleIntersection, pageCount]);

  // Initially load first 12 pages
  useEffect(() => {
    const initialPages = pageNumbers.slice(0, 12);
    setVisiblePages(new Set(initialPages));
  }, [pageCount]);

  const selectedSet = new Set(selectedPages);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
      {pageNumbers.map((pageNum) => {
        const thumbnail = thumbnails.get(pageNum);
        return (
          <div key={pageNum} data-page={pageNum}>
            <Thumbnail
              pageNumber={pageNum}
              dataUrl={thumbnail?.dataUrl}
              isSelected={selectedSet.has(pageNum)}
              isLoading={!thumbnail?.loaded && visiblePages.has(pageNum)}
              onClick={() => onThumbnailClick?.(pageNum)}
            />
          </div>
        );
      })}
    </div>
  );
}
