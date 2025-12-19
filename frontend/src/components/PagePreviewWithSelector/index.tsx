'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import { AreaSelector } from '@/components/AreaSelector';
import { useAreaSelection } from '@/contexts/AreaSelectionContext';
import type { PageDimensions, AreaSelection } from '@/types/area-selection';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

// Default DPI for native coordinate calculation (matches backend)
const NATIVE_DPI = 600;
// PDF.js uses 72 DPI as base
const PDF_BASE_DPI = 72;

interface PagePreviewWithSelectorProps {
  pdfUrl: string;
  pageNumber: number;
  maxWidth?: number;
  maxHeight?: number;
  disabled?: boolean;
}

export function PagePreviewWithSelector({
  pdfUrl,
  pageNumber,
  maxWidth = 600,
  maxHeight = 800,
  disabled = false,
}: PagePreviewWithSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageDimensions, setPageDimensions] = useState<PageDimensions | null>(null);

  const { getSelection, setSelection, clearSelection } = useAreaSelection();
  const selection = getSelection(pageNumber);

  const handleSelectionChange = useCallback(
    (newSelection: AreaSelection | null) => {
      if (newSelection) {
        setSelection(pageNumber, newSelection);
      } else {
        clearSelection(pageNumber);
      }
    },
    [pageNumber, setSelection, clearSelection]
  );

  // Render page
  useEffect(() => {
    if (!pdfUrl || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        if (pageNumber > pdf.numPages) {
          setError(`Page ${pageNumber} not found`);
          return;
        }

        const page = await pdf.getPage(pageNumber);

        if (cancelled) return;

        // Get base viewport (at PDF's 72 DPI)
        const baseViewport = page.getViewport({ scale: 1 });

        // Calculate native dimensions at 600 DPI
        const nativeWidth = Math.round(baseViewport.width * (NATIVE_DPI / PDF_BASE_DPI));
        const nativeHeight = Math.round(baseViewport.height * (NATIVE_DPI / PDF_BASE_DPI));

        // Calculate display scale to fit within maxWidth/maxHeight
        const scaleX = maxWidth / baseViewport.width;
        const scaleY = maxHeight / baseViewport.height;
        const displayScale = Math.min(scaleX, scaleY);

        const scaledViewport = page.getViewport({ scale: displayScale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        setPageDimensions({
          nativeWidth,
          nativeHeight,
          displayWidth: scaledViewport.width,
          displayHeight: scaledViewport.height,
        });

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load page');
          setIsLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber, maxWidth, maxHeight]);

  return (
    <div className="inline-block bg-white rounded-lg shadow-md overflow-hidden">
      {/* Page number header */}
      <div className="bg-gray-100 px-4 py-2 border-b border-gray-200">
        <span className="text-sm font-medium text-gray-700">
          Page {pageNumber}
        </span>
        {selection && (
          <span className="ml-2 text-xs text-blue-600">
            (Area selected)
          </span>
        )}
      </div>

      {/* Content container - relative for overlay positioning */}
      <div
        ref={containerRef}
        className="relative"
        style={{
          width: pageDimensions?.displayWidth || 'auto',
          height: pageDimensions?.displayHeight || 'auto',
          minWidth: 200,
          minHeight: 200,
        }}
      >
        {/* PDF Canvas */}
        <canvas
          ref={canvasRef}
          className={`block ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        />

        {/* Area Selector Overlay - only show when page is loaded */}
        {!isLoading && !error && pageDimensions && (
          <AreaSelector
            pageNum={pageNumber}
            pageDimensions={pageDimensions}
            selection={selection}
            onSelectionChange={handleSelectionChange}
            disabled={disabled}
          />
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <svg
              className="animate-spin h-8 w-8 text-blue-500"
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
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-600 p-4 text-center">
            {error}
          </div>
        )}
      </div>

      {/* Selection info footer */}
      {!isLoading && !error && (
        <div className="bg-gray-50 px-4 py-2 border-t border-gray-200 text-xs text-gray-500">
          {disabled ? (
            <span>Selection disabled</span>
          ) : selection ? (
            <span>
              Selection: {selection.width}x{selection.height}px at ({selection.x}, {selection.y})
            </span>
          ) : (
            <span>Draw a rectangle to select an area, or convert full page</span>
          )}
        </div>
      )}
    </div>
  );
}
