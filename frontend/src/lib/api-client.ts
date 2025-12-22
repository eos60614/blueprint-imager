/**
 * API client for communicating with the Blueprint Imager backend.
 */

import { config } from './config';
import type {
  PresignedUrlRequest,
  PresignedUrlResponse,
  UploadCompleteRequest,
  UploadCompleteResponse,
  ConvertPagesRequest,
  ConvertPagesResponse,
  JobStatusResponse,
  ErrorResponse,
  isErrorResponse,
} from '@/types/api';
import type {
  JobListResponse,
  JobDetails,
  JobPagesResponse,
  TileGridResponse,
  PdfUrlResponse,
} from '@/types/history';
import type {
  RoboflowUploadRequest,
  RoboflowUploadResult,
  RoboflowStatus,
} from '@/types/roboflow';
import type {
  TileEstimateRequest,
  TileEstimateResponse,
} from '@/types/area-selection';

class ApiError extends Error {
  constructor(
    public statusCode: number,
    public error: string,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    const errorData = data as ErrorResponse;
    throw new ApiError(
      response.status,
      errorData.error || 'Unknown error',
      errorData.message || 'An unexpected error occurred'
    );
  }

  return data as T;
}

/**
 * Get a presigned URL for uploading a PDF to S3.
 */
export async function getPresignedUrl(
  request: PresignedUrlRequest
): Promise<PresignedUrlResponse> {
  const response = await fetch(`${config.apiUrl}/api/upload/presign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<PresignedUrlResponse>(response);
}

/**
 * Notify the backend that an upload has completed.
 */
export async function completeUpload(
  request: UploadCompleteRequest
): Promise<UploadCompleteResponse> {
  const response = await fetch(`${config.apiUrl}/api/upload/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<UploadCompleteResponse>(response);
}

/**
 * Start a conversion job for selected pages.
 */
export async function convertPages(
  request: ConvertPagesRequest
): Promise<ConvertPagesResponse> {
  const response = await fetch(`${config.apiUrl}/api/convert/pages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<ConvertPagesResponse>(response);
}

/**
 * Get the status of a conversion job.
 */
export async function getJobStatus(jobId: number): Promise<JobStatusResponse> {
  const response = await fetch(`${config.apiUrl}/api/jobs/${jobId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<JobStatusResponse>(response);
}

/**
 * Get the download URL for a completed job.
 * Note: The downloadUrl is included in the JobStatusResponse when status is 'completed'.
 * This function returns the direct download URL or redirects to it.
 */
export function getDownloadUrl(jobId: number): string {
  return `${config.apiUrl}/api/jobs/${jobId}/download`;
}


// ============================================================
// History feature API functions
// ============================================================

/**
 * Get multiple jobs by IDs (for history sync).
 */
export async function getJobsByIds(jobIds: number[]): Promise<JobListResponse> {
  if (jobIds.length === 0) {
    return { jobs: [] };
  }

  const idsParam = jobIds.join(',');
  const response = await fetch(`${config.apiUrl}/api/jobs?ids=${idsParam}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<JobListResponse>(response);
}

/**
 * Get detailed job information.
 */
export async function getJobDetails(jobId: number): Promise<JobDetails> {
  const response = await fetch(`${config.apiUrl}/api/jobs/${jobId}/details`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<JobDetails>(response);
}

/**
 * Get pages for a job.
 */
export async function getJobPages(jobId: number): Promise<JobPagesResponse> {
  const response = await fetch(`${config.apiUrl}/api/jobs/${jobId}/pages`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<JobPagesResponse>(response);
}

/**
 * Get tiles for a specific page.
 */
export async function getPageTiles(
  jobId: number,
  pageNum: number
): Promise<TileGridResponse> {
  const response = await fetch(
    `${config.apiUrl}/api/jobs/${jobId}/pages/${pageNum}/tiles`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  const data = await handleResponse<TileGridResponse>(response);

  // Transform relative tile URLs to absolute URLs pointing to the backend
  return {
    ...data,
    tiles: data.tiles.map((tile) => ({
      ...tile,
      url: `${config.apiUrl}${tile.url}`,
    })),
  };
}

/**
 * Get presigned URL for the original PDF.
 */
export async function getPdfUrl(jobId: number): Promise<PdfUrlResponse> {
  const response = await fetch(`${config.apiUrl}/api/jobs/${jobId}/pdf-url`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<PdfUrlResponse>(response);
}

// ============================================================
// Roboflow API functions
// ============================================================

/**
 * Upload tiles to Roboflow.
 */
export async function uploadTilesToRoboflow(
  request: RoboflowUploadRequest
): Promise<RoboflowUploadResult> {
  const response = await fetch(`${config.apiUrl}/api/roboflow/upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<RoboflowUploadResult>(response);
}

/**
 * Check if Roboflow is configured.
 */
export async function getRoboflowStatus(): Promise<RoboflowStatus> {
  const response = await fetch(`${config.apiUrl}/api/roboflow/status`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  return handleResponse<RoboflowStatus>(response);
}

// ============================================================
// Tile download API functions
// ============================================================

export interface DownloadTileSelection {
  pageNum: number;
  row: number;
  col: number;
}

/**
 * Download selected tiles as a ZIP file.
 * Returns a blob that can be downloaded.
 */
export async function downloadSelectedTiles(
  jobId: number,
  tiles: DownloadTileSelection[]
): Promise<Blob> {
  const response = await fetch(`${config.apiUrl}/api/jobs/${jobId}/download-tiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ tiles }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new ApiError(
      response.status,
      errorData.error || 'Unknown error',
      errorData.message || 'Failed to download tiles'
    );
  }

  return response.blob();
}

// ============================================================
// Area Selection / Tile Estimate API functions
// ============================================================

/**
 * Estimate tile count for a page or area selection.
 */
export async function estimateTiles(
  request: TileEstimateRequest
): Promise<TileEstimateResponse> {
  const response = await fetch(`${config.apiUrl}/api/convert/estimate-tiles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  return handleResponse<TileEstimateResponse>(response);
}

export { ApiError };
