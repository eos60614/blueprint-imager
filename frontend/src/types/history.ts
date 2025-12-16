/**
 * TypeScript types for the browse history feature.
 * These types match the data models defined in data-model.md and history-api.yaml.
 */

/**
 * Status of a history entry (client-side view).
 */
export type HistoryStatus =
  | 'pending'       // Job created, not started
  | 'processing'    // Currently processing
  | 'completed'     // Successfully finished
  | 'failed'        // Processing failed
  | 'unavailable';  // Server files no longer exist (expired)

/**
 * Conversion settings stored with history entry.
 */
export interface HistoryEntrySettings {
  dpi: number;
  tileSize: number;
  overlap: number;
}

/**
 * A single entry in the user's upload history.
 * Stored in browser localStorage.
 */
export interface HistoryEntry {
  // Core identifiers
  jobId: number;
  uploadId: number;

  // Display information
  fileName: string;
  uploadedAt: string;           // ISO 8601 timestamp

  // Page information
  pageCount: number;            // Total pages in original PDF
  selectedPages: number[];      // Pages selected for processing

  // Status tracking
  status: HistoryStatus;
  lastSyncedAt: string;         // ISO 8601 timestamp

  // Conversion settings (for display)
  settings: HistoryEntrySettings;
}

/**
 * Job status from server (matches backend).
 */
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * Summary of a job returned from batch fetch endpoint.
 */
export interface JobSummary {
  jobId: number;
  status: JobStatus;
  fileName: string;
  uploadedAt: string;
  pageCount?: number;
  selectedPages?: number[];
  progress?: number;
}

/**
 * Full job details from the server.
 */
export interface JobDetails {
  jobId: number;
  status: JobStatus;
  progress: number;              // 0-100

  // Upload info
  uploadId: number;
  fileName: string;
  uploadedAt: string;

  // Page info
  totalPages: number;            // In original PDF
  selectedPages: number[];
  processedPages: number;

  // Conversion settings
  dpi: number;
  tileSize: number;
  overlap: number;

  // Error info (if failed)
  errorMessage?: string;

  // Download (if completed)
  downloadUrl?: string;
}

/**
 * Information about a processed page.
 */
export interface PageInfo {
  pageNumber: number;            // 1-indexed (matches PDF page numbers)
  tileCount: number;             // Number of tiles generated
  gridSize: {
    rows: number;
    cols: number;
  };
  thumbnailUrl?: string;         // Presigned URL (if pre-cached)
}

/**
 * Information about a single tile.
 */
export interface TileInfo {
  row: number;                   // 0-indexed
  col: number;                   // 0-indexed
  url: string;                   // Presigned S3 URL
  width?: number;                // Pixel width (usually tileSize)
  height?: number;               // Pixel height (may vary at edges)
  isBlank?: boolean;             // True if tile is 80%+ white (mostly blank)
}

/**
 * Response from tile listing endpoint.
 */
export interface TileGridResponse {
  jobId: number;
  pageNumber: number;
  tiles: TileInfo[];
  totalTiles: number;
  gridSize: {
    rows: number;
    cols: number;
  };
}

/**
 * Response from job pages endpoint.
 */
export interface JobPagesResponse {
  jobId: number;
  pages: PageInfo[];
}

/**
 * Response from PDF URL endpoint.
 */
export interface PdfUrlResponse {
  url: string;
  expiresIn: number;             // Seconds until URL expires
}

/**
 * Response from batch jobs endpoint.
 */
export interface JobListResponse {
  jobs: JobSummary[];
}

/**
 * Input for creating a new history entry.
 */
export interface CreateHistoryEntryInput {
  jobId: number;
  uploadId: number;
  fileName: string;
  pageCount: number;
  selectedPages: number[];
  settings: HistoryEntrySettings;
}
