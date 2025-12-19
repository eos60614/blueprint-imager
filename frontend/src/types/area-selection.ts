/**
 * Area Selection Types for Tiling Feature
 *
 * Coordinates are relative to the PDF page at native resolution (e.g., 600 DPI).
 */

/**
 * Represents a rectangular area selection on a PDF page.
 */
export interface AreaSelection {
  pageNum: number; // 1-indexed page number
  x: number; // Left edge in pixels (native DPI)
  y: number; // Top edge in pixels (native DPI)
  width: number; // Width in pixels (native DPI)
  height: number; // Height in pixels (native DPI)
}

/**
 * State for managing area selections across pages.
 */
export interface AreaSelectionState {
  selections: Map<number, AreaSelection>; // pageNum -> selection
  activePageNum: number | null; // Currently drawing on this page
}

/**
 * Pagination state for page preview.
 */
export interface PagePreviewPagination {
  currentStartPage: number; // 1-indexed, first page being displayed
  pagesPerView: 2; // Always 2 (constant)
  totalPages: number;
}

/**
 * Estimated tile count for an area selection.
 */
export interface TileEstimate {
  pageNum: number;
  rows: number;
  cols: number;
  total: number;
}

/**
 * Page dimensions for coordinate transformation.
 */
export interface PageDimensions {
  nativeWidth: number; // PDF width at target DPI (e.g., 600)
  nativeHeight: number;
  displayWidth: number; // Rendered canvas width
  displayHeight: number;
}

/**
 * Tile preview from estimate endpoint.
 */
export interface TilePreview {
  row: number; // 0-indexed
  col: number; // 0-indexed
  x: number; // Pixel x of tile top-left
  y: number; // Pixel y of tile top-left
}

/**
 * Response from tile estimate endpoint.
 */
export interface TileEstimateResponse {
  rows: number;
  cols: number;
  total: number;
  tiles: TilePreview[];
}

/**
 * Request for tile estimate endpoint.
 */
export interface TileEstimateRequest {
  pageWidth: number;
  pageHeight: number;
  tileSize?: number;
  overlap?: number;
  areaSelection?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
