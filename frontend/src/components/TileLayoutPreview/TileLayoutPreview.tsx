'use client';

import { useState, useEffect, useMemo } from 'react';
import { config } from '@/lib/config';

interface TileLayoutPreviewProps {
  drawingId: number | null;
  dpi: number;
  tileSize: number;
  overlap: number;
  noTiles: boolean;
  fullWidth?: boolean;
  previewHeight?: string;
}

interface Dimensions {
  width: number;
  height: number;
  dpi: number;
}

interface TileRect {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
}

export function TileLayoutPreview({
  drawingId,
  dpi,
  tileSize,
  overlap,
  noTiles,
  fullWidth = false,
  previewHeight = '300px',
}: TileLayoutPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewDimensions, setPreviewDimensions] = useState<{ width: number; height: number } | null>(null);
  const [targetDimensions, setTargetDimensions] = useState<Dimensions | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch preview image and dimensions when drawing changes
  useEffect(() => {
    if (!drawingId) {
      setPreviewUrl(null);
      setPreviewDimensions(null);
      setTargetDimensions(null);
      return;
    }

    const fetchPreview = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch preview image (low-res)
        const previewResponse = await fetch(
          `${config.apiUrl}/api/procore/drawings/${drawingId}/preview?dpi=72`
        );

        if (!previewResponse.ok) {
          throw new Error('Failed to load preview');
        }

        // Get dimensions from headers
        const previewWidth = parseInt(previewResponse.headers.get('X-Preview-Width') || '0');
        const previewHeight = parseInt(previewResponse.headers.get('X-Preview-Height') || '0');

        const blob = await previewResponse.blob();
        const url = URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewDimensions({ width: previewWidth, height: previewHeight });

        // Fetch target dimensions at selected DPI
        const dimResponse = await fetch(
          `${config.apiUrl}/api/procore/drawings/${drawingId}/dimensions?dpi=${dpi}`
        );

        if (dimResponse.ok) {
          const dims = await dimResponse.json();
          setTargetDimensions(dims);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreview();

    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [drawingId]);

  // Refetch dimensions when DPI changes
  useEffect(() => {
    if (!drawingId) return;

    const fetchDimensions = async () => {
      try {
        const response = await fetch(
          `${config.apiUrl}/api/procore/drawings/${drawingId}/dimensions?dpi=${dpi}`
        );
        if (response.ok) {
          const dims = await response.json();
          setTargetDimensions(dims);
        }
      } catch {
        // Silently fail - dimensions are optional
      }
    };

    fetchDimensions();
  }, [drawingId, dpi]);

  // Calculate tile grid
  const tiles = useMemo((): TileRect[] => {
    if (!targetDimensions || noTiles) return [];

    const { width, height } = targetDimensions;
    const stride = tileSize - overlap;

    if (stride <= 0) return [];

    const result: TileRect[] = [];

    // Calculate number of tiles
    const numCols = Math.ceil((width - overlap) / stride);
    const numRows = Math.ceil((height - overlap) / stride);

    for (let row = 0; row < numRows; row++) {
      for (let col = 0; col < numCols; col++) {
        const x = col * stride;
        const y = row * stride;
        const tileWidth = Math.min(tileSize, width - x);
        const tileHeight = Math.min(tileSize, height - y);

        result.push({
          x,
          y,
          width: tileWidth,
          height: tileHeight,
          row,
          col,
        });
      }
    }

    return result;
  }, [targetDimensions, tileSize, overlap, noTiles]);

  // Calculate scale factor for preview
  const scaleFactor = useMemo(() => {
    if (!targetDimensions || !previewDimensions) return 1;
    return previewDimensions.width / targetDimensions.width;
  }, [targetDimensions, previewDimensions]);

  // No drawing selected
  if (!drawingId) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-500">
          Select a drawing to preview tile layout
        </p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-sm text-gray-500">Loading preview...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // Preview with overlay
  return (
    <div className={`space-y-2 ${fullWidth ? 'w-full' : ''}`}>
      <div className="relative bg-gray-100 border border-gray-200 rounded-lg overflow-hidden">
        {previewUrl && previewDimensions && (
          <div className="relative" style={{ maxHeight: previewHeight, overflow: 'auto' }}>
            <img
              src={previewUrl}
              alt="Drawing preview"
              className="max-w-full h-auto"
              style={{ display: 'block' }}
            />

            {/* Tile overlay SVG */}
            {!noTiles && tiles.length > 0 && (
              <svg
                className="absolute top-0 left-0 pointer-events-none"
                width={previewDimensions.width}
                height={previewDimensions.height}
                viewBox={`0 0 ${previewDimensions.width} ${previewDimensions.height}`}
              >
                {/* Render tiles with semi-transparent fills */}
                {tiles.map((tile, idx) => {
                  const scaledX = tile.x * scaleFactor;
                  const scaledY = tile.y * scaleFactor;
                  const scaledWidth = tile.width * scaleFactor;
                  const scaledHeight = tile.height * scaleFactor;

                  // Alternate colors for visibility
                  const isEven = (tile.row + tile.col) % 2 === 0;

                  return (
                    <rect
                      key={idx}
                      x={scaledX}
                      y={scaledY}
                      width={scaledWidth}
                      height={scaledHeight}
                      fill={isEven ? 'rgba(59, 130, 246, 0.15)' : 'rgba(16, 185, 129, 0.15)'}
                      stroke={isEven ? 'rgba(59, 130, 246, 0.6)' : 'rgba(16, 185, 129, 0.6)'}
                      strokeWidth="1"
                    />
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </div>

      {/* Info section */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div>
          {targetDimensions && (
            <span>
              Output: {targetDimensions.width} x {targetDimensions.height}px @ {dpi} DPI
            </span>
          )}
        </div>
        <div>
          {noTiles ? (
            <span className="text-blue-600 font-medium">1 full image</span>
          ) : (
            <span className="text-blue-600 font-medium">
              {tiles.length} tile{tiles.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
