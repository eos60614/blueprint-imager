'use client';

import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ProgressBar } from './ProgressBar';
import { ErrorMessage } from './ErrorMessage';
import { validateFile } from '@/lib/validators';
import type { UploadState } from '@/types/state';

interface FileUploadProps {
  uploadState: UploadState;
  onFileSelect: (file: File) => void;
  onClearError: () => void;
  disabled?: boolean;
}

export function FileUpload({
  uploadState,
  onFileSelect,
  onClearError,
  disabled = false,
}: FileUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];
      const validation = validateFile(file);

      if (!validation.valid) {
        // The parent component handles errors through context
        // For now, just don't proceed
        return;
      }

      onFileSelect(file);
    },
    [onFileSelect]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
    },
    maxFiles: 1,
    disabled: disabled || uploadState.uploadStatus === 'uploading',
  });

  const isUploading = uploadState.uploadStatus === 'uploading';
  const isUploaded = uploadState.uploadStatus === 'uploaded';
  const hasError = uploadState.uploadStatus === 'error';

  // Format file size for display
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="w-full">
      {hasError && uploadState.uploadError && (
        <div className="mb-4">
          <ErrorMessage message={uploadState.uploadError} onDismiss={onClearError} />
        </div>
      )}

      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer
          transition-colors duration-200
          ${isDragActive && !isDragReject ? 'border-blue-500 bg-blue-50' : ''}
          ${isDragReject ? 'border-red-500 bg-red-50' : ''}
          ${isUploading ? 'border-gray-300 bg-gray-50 cursor-not-allowed' : ''}
          ${isUploaded ? 'border-green-500 bg-green-50' : ''}
          ${!isDragActive && !isUploading && !isUploaded ? 'border-gray-300 hover:border-gray-400' : ''}
        `}
      >
        <input {...getInputProps()} />

        {isUploading ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              <svg
                className="animate-spin h-8 w-8 text-blue-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            </div>
            <div className="text-sm text-gray-600">
              Uploading {uploadState.fileName}...
            </div>
            <ProgressBar progress={uploadState.uploadProgress} className="max-w-xs mx-auto" />
          </div>
        ) : isUploaded ? (
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <svg
                className="h-8 w-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-sm font-medium text-gray-900">{uploadState.fileName}</p>
            <p className="text-xs text-gray-500">
              {uploadState.fileSize ? formatFileSize(uploadState.fileSize) : ''}
            </p>
            <p className="text-xs text-green-600">Upload complete</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-center">
              <svg
                className="h-12 w-12 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
            </div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop your PDF here' : 'Upload a PDF file'}
            </p>
            <p className="text-sm text-gray-500">
              Drag and drop or click to select
            </p>
            <p className="text-xs text-gray-400">
              PDF files only, max 100MB
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
