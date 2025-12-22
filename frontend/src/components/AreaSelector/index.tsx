'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import type { AreaSelection, PageDimensions } from '@/types/area-selection';
import {
  displayRectToNativeSelection,
  nativeSelectionToDisplayRect,
  normalizeRect,
  clampRect,
} from '@/lib/coordinate-utils';

interface AreaSelectorProps {
  pageNum: number;
  pageDimensions: PageDimensions;
  selection?: AreaSelection;
  onSelectionChange: (selection: AreaSelection | null) => void;
  disabled?: boolean;
}

export function AreaSelector({
  pageNum,
  pageDimensions,
  selection,
  onSelectionChange,
  disabled = false,
}: AreaSelectorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  // Convert existing selection to display coordinates for rendering
  const displayRect = selection
    ? nativeSelectionToDisplayRect(selection, pageDimensions)
    : null;

  // Draw the selection rectangle
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Determine which rect to draw
    const rectToDraw = isDrawing ? currentRect : displayRect;
    if (!rectToDraw) return;

    // Draw semi-transparent fill
    ctx.fillStyle = 'rgba(59, 130, 246, 0.2)'; // Blue with 20% opacity
    ctx.fillRect(rectToDraw.x, rectToDraw.y, rectToDraw.width, rectToDraw.height);

    // Draw border
    ctx.strokeStyle = 'rgb(59, 130, 246)'; // Blue
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(rectToDraw.x, rectToDraw.y, rectToDraw.width, rectToDraw.height);

    // Draw corner handles (only when not drawing and has selection)
    if (!isDrawing && displayRect) {
      const handleSize = 8;
      ctx.fillStyle = 'rgb(59, 130, 246)';

      // Corners
      const corners = [
        { x: displayRect.x, y: displayRect.y }, // Top-left
        { x: displayRect.x + displayRect.width, y: displayRect.y }, // Top-right
        { x: displayRect.x, y: displayRect.y + displayRect.height }, // Bottom-left
        { x: displayRect.x + displayRect.width, y: displayRect.y + displayRect.height }, // Bottom-right
      ];

      corners.forEach((corner) => {
        ctx.fillRect(
          corner.x - handleSize / 2,
          corner.y - handleSize / 2,
          handleSize,
          handleSize
        );
      });
    }
  }, [isDrawing, currentRect, displayRect]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Resize canvas to match display dimensions
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = pageDimensions.displayWidth;
      canvas.height = pageDimensions.displayHeight;
      draw();
    }
  }, [pageDimensions.displayWidth, pageDimensions.displayHeight, draw]);

  const getMousePosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (disabled) return;

    const pos = getMousePosition(e);
    setIsDrawing(true);
    setStartPoint(pos);
    setCurrentRect({ x: pos.x, y: pos.y, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || disabled) return;

    const pos = getMousePosition(e);
    const normalized = normalizeRect(startPoint.x, startPoint.y, pos.x, pos.y);
    const clamped = clampRect(
      normalized,
      pageDimensions.displayWidth,
      pageDimensions.displayHeight
    );
    setCurrentRect(clamped);
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentRect || disabled) {
      setIsDrawing(false);
      setStartPoint(null);
      return;
    }

    // Only create selection if it has meaningful size
    if (currentRect.width > 10 && currentRect.height > 10) {
      const nativeSelection = displayRectToNativeSelection(
        currentRect,
        pageNum,
        pageDimensions
      );
      onSelectionChange(nativeSelection);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentRect(null);
  };

  const handleMouseLeave = () => {
    if (isDrawing) {
      handleMouseUp();
    }
  };

  const handleClearSelection = () => {
    onSelectionChange(null);
  };

  return (
    <div
      className="absolute inset-0"
      style={{
        width: pageDimensions.displayWidth,
        height: pageDimensions.displayHeight,
      }}
    >
      <canvas
        ref={canvasRef}
        className={`absolute inset-0 ${disabled ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        style={{
          width: pageDimensions.displayWidth,
          height: pageDimensions.displayHeight,
        }}
      />

      {/* Clear button - show when there's a selection */}
      {selection && !isDrawing && (
        <button
          onClick={handleClearSelection}
          className="absolute top-2 right-2 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          title="Clear selection"
        >
          Clear
        </button>
      )}

      {/* Selection mode indicator */}
      <div className="absolute bottom-2 left-2 px-2 py-1 text-xs bg-black/50 text-white rounded">
        {selection ? 'Selected Area' : 'Full Page'}
      </div>
    </div>
  );
}
