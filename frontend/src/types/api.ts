/**
 * API request/response types matching the OpenAPI contract.
 */

// Upload endpoints
export interface PresignedUrlRequest {
  fileName: string;
  fileSize: number;
  contentType: string; // must be "application/pdf"
}

export interface PresignedUrlResponse {
  uploadUrl: string;
  s3Key: string;
  expiresIn: number;
}

export interface UploadCompleteRequest {
  s3Key: string;
}

export interface UploadCompleteResponse {
  uploadId: number;
  pageCount: number;
  status: 'ready';
}

// Conversion settings
export interface ConversionSettings {
  dpi: number;
  tileSize: number;
  overlap: number;
}

export const DEFAULT_CONVERSION_SETTINGS: ConversionSettings = {
  dpi: 600,
  tileSize: 1920,
  overlap: 250,
};

// Area selection for convert request
export interface AreaSelectionInput {
  pageNum: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Convert endpoints
export interface ConvertPagesRequest {
  uploadId: number;
  selectedPages: number[];
  dpi?: number;
  tileSize?: number;
  overlap?: number;
  // Optional area selections per page
  areaSelections?: AreaSelectionInput[];
}

export interface ConvertPagesResponse {
  jobId: number;
  status: 'processing';
  totalPages: number;
}

// Job status
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface JobStatusResponse {
  jobId: number;
  status: JobStatus;
  progress: number;
  processedPages: number;
  totalPages: number;
  errorMessage?: string;
  downloadUrl?: string;
}

// Error response
export interface ErrorResponse {
  error: string;
  message: string;
}

// Type guards
export function isErrorResponse(response: unknown): response is ErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    'message' in response
  );
}
