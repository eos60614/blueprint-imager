/**
 * S3 direct upload functionality.
 */

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: UploadProgress) => void;

/**
 * Upload a file directly to S3 using a presigned URL.
 * Returns a promise that resolves when the upload is complete.
 */
export async function uploadToS3(
  file: File,
  presignedUrl: string,
  onProgress?: ProgressCallback,
  originalFileName?: string
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress({
          loaded: event.loaded,
          total: event.total,
          percentage: Math.round((event.loaded / event.total) * 100),
        });
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.statusText}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed due to network error'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload was aborted'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    // S3 presigned URL requires this header to match the signed metadata
    if (originalFileName) {
      xhr.setRequestHeader('x-amz-meta-original-filename', originalFileName);
    }
    xhr.send(file);
  });
}

/**
 * Create an abort controller for cancellable uploads.
 * Note: The XMLHttpRequest approach above doesn't use AbortController,
 * but this can be used for future fetch-based implementations.
 */
export function createUploadController(): AbortController {
  return new AbortController();
}
