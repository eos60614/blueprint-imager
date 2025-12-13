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

export { ApiError };
