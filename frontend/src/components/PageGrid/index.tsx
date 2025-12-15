'use client';

import { useState } from 'react';
import type { PageInfo } from '@/types/history';
import { PageThumbnail } from './PageThumbnail';
import { PagePreview } from '@/components/PagePreview';

interface PageGridProps {
  pages: PageInfo[];
  pdfUrl: string | null;
  selectedPages: number[];
  onPageClick?: (pageNumber: number) => void;
  isLoading?: boolean;
  showTileInfo?: boolean;
}

export function PageGrid({
  pages,
  pdfUrl,
  selectedPages,
  onPageClick,
  isLoading = false,
  showTileInfo = true,
}: PageGridProps) {
  const [previewPage, setPreviewPage] = useState<number | null>(null);

  const handlePageClick = (pageNumber: number) => {
    if (onPageClick) {
      onPageClick(pageNumber);
    } else {
      // If no click handler provided, show preview
      setPreviewPage(pageNumber);
    }
  };

  const closePreview = () => {
    setPreviewPage(null);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <svg
          className="animate-spin h-8 w-8 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="text-center py-12 text-gray-500">
        PDF not available for thumbnail rendering.
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No processed pages found.
      </div>
    );
  }

  return (
    <>
      {/* Page info summary */}
      <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
        <span>
          {selectedPages.length} of {pages.length + (pages.length < selectedPages.length ? selectedPages.length - pages.length : 0)} page
          {pages.length !== 1 ? 's' : ''} processed
        </span>
        <span className="text-xs">Click a page to view tiles</span>
      </div>

      {/* Page grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {pages.map((page) => (
          <div key={page.pageNumber} className="space-y-2">
            <PageThumbnail
              pdfUrl={pdfUrl}
              pageNumber={page.pageNumber}
              width={180}
              onClick={() => handlePageClick(page.pageNumber)}
              isSelected={selectedPages.includes(page.pageNumber)}
            />
            {showTileInfo && (
              <div className="text-center text-xs text-gray-500">
                {page.tileCount} tile{page.tileCount !== 1 ? 's' : ''}{' '}
                <span className="text-gray-400">
                  ({page.gridSize.rows}x{page.gridSize.cols})
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Preview modal */}
      {previewPage !== null && (
        <PagePreview
          pdfUrl={pdfUrl}
          pageNumber={previewPage}
          onClose={closePreview}
        />
      )}
    </>
  );
}
