'use client';

import { useState, useEffect, useRef } from 'react';
import { estimateTiles } from '@/lib/api-client';
import type { TileEstimateResponse } from '@/types/area-selection';
import type { AreaSelection } from '@/types/area-selection';
import type { ConversionSettings } from '@/types/api';

interface TileEstimateDisplayProps {
  selectedPages: number[];
  areaSelections: AreaSelection[];
  settings: ConversionSettings;
  // Page dimensions at native DPI - needed for tile calculation
  // If not provided, uses default full HD 600 DPI estimate
  pageDimensions?: { width: number; height: number };
}

interface PageEstimate {
  pageNum: number;
  total: number;
  rows: number;
  cols: number;
  hasAreaSelection: boolean;
}

export function TileEstimateDisplay({
  selectedPages,
  areaSelections,
  settings,
  pageDimensions,
}: TileEstimateDisplayProps) {
  const [estimates, setEstimates] = useState<PageEstimate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Create a lookup for area selections by page
  const areaSelectionsByPage = new Map<number, AreaSelection>();
  areaSelections.forEach((sel) => {
    areaSelectionsByPage.set(sel.pageNum, sel);
  });

  // Fetch estimates when inputs change (debounced)
  useEffect(() => {
    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Don't fetch if no pages selected
    if (selectedPages.length === 0) {
      setEstimates([]);
      setError(null);
      return;
    }

    // Debounce the API call
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const pageEstimates: PageEstimate[] = [];

        // Fetch estimate for each selected page
        for (const pageNum of selectedPages) {
          const areaSelection = areaSelectionsByPage.get(pageNum);

          // Use default dimensions if not provided
          // Typical 8.5x11 inch page at 600 DPI = 5100x6600 pixels
          const defaultWidth = pageDimensions?.width || 5100;
          const defaultHeight = pageDimensions?.height || 6600;

          const request = {
            pageWidth: defaultWidth,
            pageHeight: defaultHeight,
            tileSize: settings.tileSize,
            overlap: settings.overlap,
            ...(areaSelection && {
              areaSelection: {
                x: areaSelection.x,
                y: areaSelection.y,
                width: areaSelection.width,
                height: areaSelection.height,
              },
            }),
          };

          const response = await estimateTiles(request);
          pageEstimates.push({
            pageNum,
            total: response.total,
            rows: response.rows,
            cols: response.cols,
            hasAreaSelection: !!areaSelection,
          });
        }

        setEstimates(pageEstimates);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to estimate tiles');
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [selectedPages, areaSelections, settings, pageDimensions]);

  // Calculate totals
  const totalTiles = estimates.reduce((sum, e) => sum + e.total, 0);
  const pagesWithSelection = estimates.filter((e) => e.hasAreaSelection).length;

  if (selectedPages.length === 0) {
    return null;
  }

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
            />
          </svg>
          <span className="text-blue-800 font-medium">
            {isLoading ? (
              'Calculating...'
            ) : error ? (
              <span className="text-red-600">{error}</span>
            ) : (
              <>~{totalTiles} tiles will be generated</>
            )}
          </span>
        </div>

        {!isLoading && !error && pagesWithSelection > 0 && (
          <span className="text-blue-600 text-xs">
            {pagesWithSelection} page{pagesWithSelection !== 1 ? 's' : ''} with area selection
          </span>
        )}
      </div>

      {/* Detailed breakdown for multiple pages */}
      {!isLoading && !error && estimates.length > 1 && (
        <div className="mt-2 pt-2 border-t border-blue-200">
          <div className="text-xs text-blue-600 grid grid-cols-2 sm:grid-cols-3 gap-1">
            {estimates.map((e) => (
              <div key={e.pageNum} className="flex items-center gap-1">
                <span>Page {e.pageNum}:</span>
                <span className="font-medium">{e.total}</span>
                {e.hasAreaSelection && (
                  <span className="text-blue-400" title="Area selection">
                    *
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
