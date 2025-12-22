'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TileInfo, TileGridResponse } from '@/types/history';
import type { TileSelection } from '@/types/roboflow';
import { TilePreview } from '@/components/TilePreview';

interface TileGridProps {
  tilesData: TileGridResponse | null;
  isLoading?: boolean;
  error?: string | null;
  selectionMode?: boolean;
  selectedTiles?: Set<string>;
  onSelectionChange?: (selected: Set<string>) => void;
  pageNum?: number;
}

interface LazyTileProps {
  tile: TileInfo;
  onClick: () => void;
  selectionMode?: boolean;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  isBlank?: boolean;
}

function LazyTile({ tile, onClick, selectionMode, isSelected, onToggleSelect, isBlank }: LazyTileProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection observer for lazy loading
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '100px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const handleClick = () => {
    if (selectionMode && onToggleSelect) {
      onToggleSelect();
    } else {
      onClick();
    }
  };

  return (
    <div
      ref={imgRef}
      className={`relative aspect-square bg-gray-100 rounded-lg overflow-hidden transition-all cursor-pointer hover:shadow-lg ${
        selectionMode && isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : ''
      }`}
      onClick={handleClick}
    >
      {isVisible && (
        <>
          <img
            src={tile.url}
            alt={`Tile at row ${tile.row + 1}, column ${tile.col + 1}`}
            className={`w-full h-full object-cover ${isLoaded && !hasError ? 'opacity-100' : 'opacity-0'} transition-opacity`}
            onLoad={() => setIsLoaded(true)}
            onError={() => setHasError(true)}
          />
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                className="animate-spin h-5 w-5 text-gray-400"
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
          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-500 text-xs p-2 text-center">
              Failed to load
            </div>
          )}
        </>
      )}

      {/* Selection checkbox */}
      {selectionMode && (
        <div className="absolute top-1 left-1">
          <div
            className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
              isSelected
                ? 'bg-blue-500 border-blue-500'
                : 'bg-white bg-opacity-80 border-gray-400'
            }`}
          >
            {isSelected && (
              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </div>
        </div>
      )}

      {/* Blank tile indicator */}
      {isBlank && (
        <div className="absolute top-1 left-1 bg-yellow-500 text-white text-xs font-bold px-1.5 py-0.5 rounded">
          BLANK
        </div>
      )}

      {/* Position indicator */}
      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded">
        {tile.row + 1},{tile.col + 1}
      </div>
    </div>
  );
}

// Helper to create tile key for selection tracking
function getTileKey(row: number, col: number): string {
  return `${row}-${col}`;
}

const TILES_PER_PAGE = 50;

export function TileGrid({
  tilesData,
  isLoading = false,
  error = null,
  selectionMode = false,
  selectedTiles = new Set(),
  onSelectionChange,
  pageNum,
}: TileGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const [hideBlankTiles, setHideBlankTiles] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const allTiles = tilesData?.tiles || [];
  const gridSize = tilesData?.gridSize || { rows: 0, cols: 0 };

  // Filter tiles based on hideBlankTiles setting
  const tiles = hideBlankTiles ? allTiles.filter((t) => !t.isBlank) : allTiles;

  // Pagination
  const totalPages = Math.ceil(tiles.length / TILES_PER_PAGE);
  const startIndex = (currentPage - 1) * TILES_PER_PAGE;
  const endIndex = startIndex + TILES_PER_PAGE;
  const paginatedTiles = tiles.slice(startIndex, endIndex);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [hideBlankTiles]);

  const handleTileClick = useCallback((index: number) => {
    setPreviewIndex(index);
  }, []);

  const closePreview = useCallback(() => {
    setPreviewIndex(null);
  }, []);

  const goToPrevious = useCallback(() => {
    if (previewIndex !== null && previewIndex > 0) {
      setPreviewIndex(previewIndex - 1);
    }
  }, [previewIndex]);

  const goToNext = useCallback(() => {
    if (previewIndex !== null && previewIndex < paginatedTiles.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  }, [previewIndex, paginatedTiles.length]);

  const handleToggleSelect = useCallback(
    (row: number, col: number) => {
      if (!onSelectionChange) return;
      const key = getTileKey(row, col);
      const newSelected = new Set(selectedTiles);
      if (newSelected.has(key)) {
        newSelected.delete(key);
      } else {
        newSelected.add(key);
      }
      onSelectionChange(newSelected);
    },
    [selectedTiles, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    if (!onSelectionChange) return;
    const allKeys = new Set(
      tiles.map((tile) => getTileKey(tile.row, tile.col))
    );
    onSelectionChange(allKeys);
  }, [tiles, onSelectionChange]);

  const handleDeselectAll = useCallback(() => {
    if (!onSelectionChange) return;
    onSelectionChange(new Set());
  }, [onSelectionChange]);

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

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (tiles.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No tiles found for this page.
      </div>
    );
  }

  // Count tiles for selection tracking
  const blankTileCount = allTiles.filter((t) => t.isBlank).length;
  const allSelected = tiles.length > 0 && selectedTiles.size === tiles.length;
  const someSelected = selectedTiles.size > 0 && selectedTiles.size < tiles.length;

  return (
    <>
      {/* Summary and selection controls */}
      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {allTiles.length} tile{allTiles.length !== 1 ? 's' : ''} ({gridSize.rows} rows x{' '}
              {gridSize.cols} columns)
              {blankTileCount > 0 && (
                <span className="text-yellow-600 ml-1">
                  ({blankTileCount} blank)
                </span>
              )}
            </span>
            {selectionMode && selectedTiles.size > 0 && (
              <span className="text-sm font-medium text-blue-600">
                {selectedTiles.size} selected
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Hide blank toggle */}
            {blankTileCount > 0 && (
              <button
                onClick={() => setHideBlankTiles(!hideBlankTiles)}
                className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
                  hideBlankTiles
                    ? 'bg-yellow-100 border-yellow-400 text-yellow-700'
                    : 'bg-gray-100 border-gray-300 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {hideBlankTiles ? 'Show Blank' : 'Hide Blank'}
              </button>
            )}
            {selectionMode ? (
              <>
                <button
                  onClick={handleSelectAll}
                  disabled={allSelected}
                  className="px-3 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  disabled={selectedTiles.size === 0}
                  className="px-3 py-1 text-xs font-medium text-gray-600 hover:text-gray-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  Deselect All
                </button>
              </>
            ) : (
              <span className="text-xs text-gray-400">Click a tile to view full size</span>
            )}
          </div>
        </div>

        {/* Pagination info */}
        {totalPages > 1 && (
          <div className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, tiles.length)} of {tiles.length} tiles
            {hideBlankTiles && ` (${blankTileCount} blank hidden)`}
          </div>
        )}
      </div>

      {/* Tile grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(gridSize.cols, 8)}, minmax(0, 1fr))`,
        }}
      >
        {paginatedTiles.map((tile, index) => (
          <LazyTile
            key={`${tile.row}-${tile.col}`}
            tile={tile}
            onClick={() => handleTileClick(index)}
            selectionMode={selectionMode}
            isSelected={selectedTiles.has(getTileKey(tile.row, tile.col))}
            onToggleSelect={() => handleToggleSelect(tile.row, tile.col)}
            isBlank={tile.isBlank}
          />
        ))}
      </div>

      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            First
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="px-4 py-1.5 text-sm text-gray-600">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last
          </button>
        </div>
      )}

      {/* Preview modal */}
      {previewIndex !== null && paginatedTiles[previewIndex] && (
        <TilePreview
          tile={paginatedTiles[previewIndex]}
          onClose={closePreview}
          onPrevious={goToPrevious}
          onNext={goToNext}
          hasPrevious={previewIndex > 0}
          hasNext={previewIndex < paginatedTiles.length - 1}
        />
      )}
    </>
  );
}

// Export helper for converting selection to TileSelection array
export function selectionToTileSelections(
  selectedTiles: Set<string>,
  pageNum: number
): TileSelection[] {
  return Array.from(selectedTiles).map((key) => {
    const [row, col] = key.split('-').map(Number);
    return { pageNum, row, col };
  });
}
