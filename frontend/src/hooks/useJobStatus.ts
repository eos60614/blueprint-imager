'use client';

import useSWR from 'swr';
import { getJobStatus } from '@/lib/api-client';
import type { JobStatusResponse } from '@/types/api';

const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds

async function fetchJobStatus(jobId: number): Promise<JobStatusResponse> {
  return getJobStatus(jobId);
}

interface UseJobStatusOptions {
  enabled?: boolean;
}

export function useJobStatus(
  jobId: number | null,
  options: UseJobStatusOptions = {}
) {
  const { enabled = true } = options;

  const shouldPoll = enabled && jobId !== null;

  const { data, error, isLoading, mutate } = useSWR<JobStatusResponse, Error>(
    shouldPoll ? ['jobStatus', jobId] : null,
    () => fetchJobStatus(jobId!),
    {
      refreshInterval: (latestData) => {
        // Stop polling when job is complete or failed
        if (
          latestData?.status === 'completed' ||
          latestData?.status === 'failed'
        ) {
          return 0;
        }
        return POLL_INTERVAL_MS;
      },
      revalidateOnFocus: false,
      dedupingInterval: 1000,
    }
  );

  return {
    status: data?.status,
    progress: data?.progress ?? 0,
    processedPages: data?.processedPages ?? 0,
    totalPages: data?.totalPages ?? 0,
    errorMessage: data?.errorMessage,
    downloadUrl: data?.downloadUrl,
    isLoading,
    error,
    refresh: mutate,
  };
}
