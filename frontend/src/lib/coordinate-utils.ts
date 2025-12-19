/**
 * Coordinate Utilities for Area Selection
 *
 * Handles conversion between display coordinates (canvas pixels) and
 * native PDF coordinates (at target DPI like 600 DPI).
 */

import type { PageDimensions, AreaSelection } from "@/types/area-selection";

/**
 * Convert display coordinates to native PDF coordinates.
 *
 * @param displayX - X position on the display canvas
 * @param displayY - Y position on the display canvas
 * @param dimensions - Page dimension information
 * @returns Native coordinates (at target DPI)
 */
export function displayToNative(
  displayX: number,
  displayY: number,
  dimensions: PageDimensions
): { x: number; y: number } {
  const scaleX = dimensions.nativeWidth / dimensions.displayWidth;
  const scaleY = dimensions.nativeHeight / dimensions.displayHeight;
  return {
    x: Math.round(displayX * scaleX),
    y: Math.round(displayY * scaleY),
  };
}

/**
 * Convert native PDF coordinates to display coordinates.
 *
 * @param nativeX - X position at native DPI
 * @param nativeY - Y position at native DPI
 * @param dimensions - Page dimension information
 * @returns Display coordinates (canvas pixels)
 */
export function nativeToDisplay(
  nativeX: number,
  nativeY: number,
  dimensions: PageDimensions
): { x: number; y: number } {
  const scaleX = dimensions.displayWidth / dimensions.nativeWidth;
  const scaleY = dimensions.displayHeight / dimensions.nativeHeight;
  return {
    x: Math.round(nativeX * scaleX),
    y: Math.round(nativeY * scaleY),
  };
}

/**
 * Convert a display rectangle to a native AreaSelection.
 *
 * @param displayRect - Rectangle in display coordinates
 * @param pageNum - Page number (1-indexed)
 * @param dimensions - Page dimension information
 * @returns AreaSelection in native coordinates
 */
export function displayRectToNativeSelection(
  displayRect: { x: number; y: number; width: number; height: number },
  pageNum: number,
  dimensions: PageDimensions
): AreaSelection {
  const topLeft = displayToNative(displayRect.x, displayRect.y, dimensions);
  const bottomRight = displayToNative(
    displayRect.x + displayRect.width,
    displayRect.y + displayRect.height,
    dimensions
  );

  return {
    pageNum,
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * Convert a native AreaSelection to display rectangle.
 *
 * @param selection - AreaSelection in native coordinates
 * @param dimensions - Page dimension information
 * @returns Rectangle in display coordinates
 */
export function nativeSelectionToDisplayRect(
  selection: AreaSelection,
  dimensions: PageDimensions
): { x: number; y: number; width: number; height: number } {
  const topLeft = nativeToDisplay(selection.x, selection.y, dimensions);
  const bottomRight = nativeToDisplay(
    selection.x + selection.width,
    selection.y + selection.height,
    dimensions
  );

  return {
    x: topLeft.x,
    y: topLeft.y,
    width: bottomRight.x - topLeft.x,
    height: bottomRight.y - topLeft.y,
  };
}

/**
 * Clamp a rectangle to stay within bounds.
 *
 * @param rect - Rectangle to clamp
 * @param maxWidth - Maximum width (page width)
 * @param maxHeight - Maximum height (page height)
 * @returns Clamped rectangle
 */
export function clampRect(
  rect: { x: number; y: number; width: number; height: number },
  maxWidth: number,
  maxHeight: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, Math.min(rect.x, maxWidth - 1));
  const y = Math.max(0, Math.min(rect.y, maxHeight - 1));
  const width = Math.max(1, Math.min(rect.width, maxWidth - x));
  const height = Math.max(1, Math.min(rect.height, maxHeight - y));

  return { x, y, width, height };
}

/**
 * Normalize a rectangle to handle negative width/height from dragging.
 * Ensures x,y is always top-left and width,height are positive.
 *
 * @param startX - Starting X coordinate
 * @param startY - Starting Y coordinate
 * @param endX - Ending X coordinate
 * @param endY - Ending Y coordinate
 * @returns Normalized rectangle with positive dimensions
 */
export function normalizeRect(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): { x: number; y: number; width: number; height: number } {
  const x = Math.min(startX, endX);
  const y = Math.min(startY, endY);
  const width = Math.abs(endX - startX);
  const height = Math.abs(endY - startY);

  return { x, y, width, height };
}
