/**
 * Frontend state types for the upload workflow.
 */

// Upload state
export type UploadStatus = 'idle' | 'uploading' | 'uploaded' | 'error';

export interface UploadState {
  file: File | null;
  fileName: string | null;
  fileSize: number | null;
  uploadProgress: number; // 0-100
  uploadStatus: UploadStatus;
  uploadError: string | null;
  s3Key: string | null;
}

// Document state (after upload)
export interface ThumbnailState {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
  loaded: boolean;
}

export type ThumbnailLoadingStatus = 'idle' | 'loading' | 'complete' | 'error';

export interface DocumentState {
  uploadId: number;
  s3Key: string;
  pageCount: number;
  thumbnails: Map<number, ThumbnailState>;
  thumbnailLoadingStatus: ThumbnailLoadingStatus;
}

// Page selection state
export interface PageSelectionState {
  inputText: string;
  selectedPages: number[];
  isValid: boolean;
  validationError: string | null;
}

// Processing state
export type ProcessingStatus = 'idle' | 'submitting' | 'processing' | 'complete' | 'error';

export interface ProcessingState {
  jobId: number | null;
  status: ProcessingStatus;
  progress: number;
  processedPages: number;
  totalPages: number;
  error: string | null;
  downloadUrl: string | null;
}

// Combined application state
export interface AppState {
  upload: UploadState;
  document: DocumentState | null;
  selection: PageSelectionState;
  processing: ProcessingState;
}

// Initial states
export const initialUploadState: UploadState = {
  file: null,
  fileName: null,
  fileSize: null,
  uploadProgress: 0,
  uploadStatus: 'idle',
  uploadError: null,
  s3Key: null,
};

export const initialSelectionState: PageSelectionState = {
  inputText: '',
  selectedPages: [],
  isValid: true,
  validationError: null,
};

export const initialProcessingState: ProcessingState = {
  jobId: null,
  status: 'idle',
  progress: 0,
  processedPages: 0,
  totalPages: 0,
  error: null,
  downloadUrl: null,
};
