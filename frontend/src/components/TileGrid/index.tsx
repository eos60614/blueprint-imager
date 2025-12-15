'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { TileInfo, TileGridResponse } from '@/types/history';
import { TilePreview } from '@/components/TilePreview';

interface TileGridProps {
  tilesData: TileGridResponse | null;
  isLoading?: boolean;
  error?: string | null;
}

interface LazyTileProps {
  tile: TileInfo;
  onClick: () => void;
}

function LazyTile({ tile, onClick }: LazyTileProps) {
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

  return (
    <div
      ref={imgRef}
      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
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

      {/* Position indicator */}
      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded">
        {tile.row + 1},{tile.col + 1}
      </div>
    </div>
  );
}

export function TileGrid({ tilesData, isLoading = false, error = null }: TileGridProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);

  const tiles = tilesData?.tiles || [];
  const gridSize = tilesData?.gridSize || { rows: 0, cols: 0 };

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
    if (previewIndex !== null && previewIndex < tiles.length - 1) {
      setPreviewIndex(previewIndex + 1);
    }
  }, [previewIndex, tiles.length]);

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

  return (
    <>
      {/* Summary */}
      <div className="mb-4 flex items-center justify-between text-sm text-gray-500">
        <span>
          {tiles.length} tile{tiles.length !== 1 ? 's' : ''} ({gridSize.rows} rows x{' '}
          {gridSize.cols} columns)
        </span>
        <span className="text-xs">Click a tile to view full size</span>
      </div>

      {/* Tile grid */}
      <div
        className="grid gap-2"
        style={{
          gridTemplateColumns: `repeat(${Math.min(gridSize.cols, 8)}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((tile, index) => (
          <LazyTile
            key={`${tile.row}-${tile.col}`}
            tile={tile}
            onClick={() => handleTileClick(index)}
          />
        ))}
      </div>

      {/* Preview modal */}
      {previewIndex !== null && tiles[previewIndex] && (
        <TilePreview
          tile={tiles[previewIndex]}
          onClose={closePreview}
          onPrevious={goToPrevious}
          onNext={goToNext}
          hasPrevious={previewIndex > 0}
          hasNext={previewIndex < tiles.length - 1}
        />
      )}
    </>
  );
}
