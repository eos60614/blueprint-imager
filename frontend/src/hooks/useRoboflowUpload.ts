'use client';

import { useState, useCallback } from 'react';
import useSWR from 'swr';
import { uploadTilesToRoboflow, getRoboflowStatus } from '@/lib/api-client';
import type { TileSelection, RoboflowUploadResult, RoboflowStatus } from '@/types/roboflow';

/**
 * Hook for checking Roboflow configuration status.
 */
export function useRoboflowStatus() {
  const { data, error, isLoading } = useSWR<RoboflowStatus, Error>(
    'roboflowStatus',
    getRoboflowStatus,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // Cache for 1 minute
    }
  );

  return {
    isConfigured: data?.configured ?? false,
    projectName: data?.projectName ?? null,
    isLoading,
    error: error?.message,
  };
}

/**
 * Hook for uploading tiles to Roboflow.
 */
export function useRoboflowUpload() {
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<RoboflowUploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadTiles = useCallback(
    async (jobId: number, tiles: TileSelection[]): Promise<RoboflowUploadResult | null> => {
      if (tiles.length === 0) {
        setError('No tiles selected');
        return null;
      }

      setIsUploading(true);
      setResult(null);
      setError(null);

      try {
        const uploadResult = await uploadTilesToRoboflow({
          jobId,
          tiles,
        });
        setResult(uploadResult);
        return uploadResult;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Upload failed';
        setError(errorMessage);
        return null;
      } finally {
        setIsUploading(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    uploadTiles,
    isUploading,
    result,
    error,
    reset,
  };
}
