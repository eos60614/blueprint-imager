'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { convertPages } from '@/lib/api-client';
import { useJobStatus } from '@/hooks/useJobStatus';
import type { ProcessingState, ProcessingStatus } from '@/types/state';
import { initialProcessingState } from '@/types/state';
import type { ConversionSettings } from '@/types/api';
import { addHistoryEntry, updateHistoryEntryStatus } from '@/lib/history-storage';
import type { CreateHistoryEntryInput } from '@/types/history';

interface HistoryEntryParams {
  fileName: string;
  pageCount: number;
}

interface ProcessingContextValue {
  processingState: ProcessingState;
  startProcessing: (
    uploadId: number,
    selectedPages: number[],
    settings?: ConversionSettings,
    historyParams?: HistoryEntryParams
  ) => Promise<void>;
  reset: () => void;
}

const ProcessingContext = createContext<ProcessingContextValue | null>(null);

interface ProcessingProviderProps {
  children: ReactNode;
}

export function ProcessingProvider({ children }: ProcessingProviderProps) {
  const [state, setState] = useState<ProcessingState>(initialProcessingState);

  const {
    status: jobStatus,
    progress,
    processedPages,
    totalPages,
    errorMessage,
    downloadUrl,
  } = useJobStatus(state.jobId, {
    enabled: state.status === 'processing',
  });

  // Sync job status with local state and update history
  useEffect(() => {
    if (state.jobId === null) return;

    if (jobStatus === 'completed') {
      setState((prev) => ({
        ...prev,
        status: 'complete',
        progress: 100,
        processedPages: totalPages,
        downloadUrl: downloadUrl || `/api/jobs/${state.jobId}/download`,
      }));
      // Update history entry status
      updateHistoryEntryStatus(state.jobId, 'completed');
    } else if (jobStatus === 'failed') {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: errorMessage || 'Processing failed',
      }));
      // Update history entry status
      updateHistoryEntryStatus(state.jobId, 'failed');
    } else if (jobStatus === 'processing') {
      setState((prev) => ({
        ...prev,
        status: 'processing',
        progress,
        processedPages,
        totalPages,
      }));
      // Update history entry status
      updateHistoryEntryStatus(state.jobId, 'processing');
    }
  }, [jobStatus, progress, processedPages, totalPages, errorMessage, downloadUrl, state.jobId]);

  const startProcessing = useCallback(
    async (
      uploadId: number,
      selectedPages: number[],
      settings?: ConversionSettings,
      historyParams?: HistoryEntryParams
    ) => {
      setState((prev) => ({
        ...prev,
        status: 'submitting',
        error: null,
      }));

      try {
        const response = await convertPages({
          uploadId,
          selectedPages,
          ...(settings && {
            dpi: settings.dpi,
            tileSize: settings.tileSize,
            overlap: settings.overlap,
          }),
        });

        setState({
          jobId: response.jobId,
          status: 'processing',
          progress: 0,
          processedPages: 0,
          totalPages: response.totalPages,
          error: null,
          downloadUrl: null,
        });

        // Add to history if we have the necessary info
        if (historyParams) {
          const defaultSettings = {
            dpi: settings?.dpi || 600,
            tileSize: settings?.tileSize || 1920,
            overlap: settings?.overlap || 250,
          };

          addHistoryEntry({
            jobId: response.jobId,
            uploadId,
            fileName: historyParams.fileName,
            pageCount: historyParams.pageCount,
            selectedPages,
            settings: defaultSettings,
          });
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to start processing';
        setState((prev) => ({
          ...prev,
          status: 'error',
          error: message,
        }));
      }
    },
    []
  );

  const reset = useCallback(() => {
    setState(initialProcessingState);
  }, []);

  return (
    <ProcessingContext.Provider
      value={{
        processingState: state,
        startProcessing,
        reset,
      }}
    >
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessing(): ProcessingContextValue {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessing must be used within a ProcessingProvider');
  }
  return context;
}
