'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { UploadState, DocumentState } from '@/types/state';
import { initialUploadState } from '@/types/state';
import { getPresignedUrl, completeUpload } from '@/lib/api-client';
import { uploadToS3 } from '@/lib/s3-upload';
import { validateFile } from '@/lib/validators';

interface UploadContextType {
  uploadState: UploadState;
  documentState: DocumentState | null;
  uploadFile: (file: File) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const UploadContext = createContext<UploadContextType | null>(null);

export function useUpload() {
  const context = useContext(UploadContext);
  if (!context) {
    throw new Error('useUpload must be used within an UploadProvider');
  }
  return context;
}

interface UploadProviderProps {
  children: ReactNode;
}

export function UploadProvider({ children }: UploadProviderProps) {
  const [uploadState, setUploadState] = useState<UploadState>(initialUploadState);
  const [documentState, setDocumentState] = useState<DocumentState | null>(null);

  const uploadFile = useCallback(async (file: File) => {
    // Validate file
    const validation = validateFile(file);
    if (!validation.valid) {
      setUploadState((prev) => ({
        ...prev,
        uploadStatus: 'error',
        uploadError: validation.error,
      }));
      return;
    }

    // Start upload
    setUploadState({
      file,
      fileName: file.name,
      fileSize: file.size,
      uploadProgress: 0,
      uploadStatus: 'uploading',
      uploadError: null,
      s3Key: null,
    });

    try {
      // Get presigned URL
      const presigned = await getPresignedUrl({
        fileName: file.name,
        fileSize: file.size,
        contentType: 'application/pdf',
      });

      // Upload to S3
      await uploadToS3(file, presigned.uploadUrl, (progress) => {
        setUploadState((prev) => ({
          ...prev,
          uploadProgress: progress.percentage,
        }));
      });

      // Complete upload and get page count
      const completed = await completeUpload({
        s3Key: presigned.s3Key,
      });

      // Update states
      setUploadState((prev) => ({
        ...prev,
        uploadStatus: 'uploaded',
        uploadProgress: 100,
        s3Key: presigned.s3Key,
      }));

      setDocumentState({
        uploadId: completed.uploadId,
        s3Key: presigned.s3Key,
        pageCount: completed.pageCount,
        thumbnails: new Map(),
        thumbnailLoadingStatus: 'idle',
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Upload failed. Please try again.';
      setUploadState((prev) => ({
        ...prev,
        uploadStatus: 'error',
        uploadError: message,
        uploadProgress: 0,
      }));
    }
  }, []);

  const clearError = useCallback(() => {
    setUploadState((prev) => ({
      ...prev,
      uploadError: null,
      uploadStatus: prev.uploadStatus === 'error' ? 'idle' : prev.uploadStatus,
    }));
  }, []);

  const reset = useCallback(() => {
    setUploadState(initialUploadState);
    setDocumentState(null);
  }, []);

  return (
    <UploadContext.Provider
      value={{
        uploadState,
        documentState,
        uploadFile,
        clearError,
        reset,
      }}
    >
      {children}
    </UploadContext.Provider>
  );
}
