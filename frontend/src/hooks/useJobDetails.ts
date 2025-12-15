'use client';

import useSWR from 'swr';
import type {
  JobDetails,
  JobPagesResponse,
  TileGridResponse,
  PdfUrlResponse,
} from '@/types/history';
import {
  getJobDetails as fetchJobDetails,
  getJobPages as fetchJobPages,
  getPageTiles as fetchPageTiles,
  getPdfUrl as fetchPdfUrl,
} from '@/lib/api-client';

/**
 * Hook for fetching job details.
 */
export function useJobDetails(jobId: number | null) {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<JobDetails>(
    jobId ? `job-details-${jobId}` : null,
    jobId ? () => fetchJobDetails(jobId) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    jobDetails: data,
    isLoading,
    error: error?.message || null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching job pages.
 */
export function useJobPages(jobId: number | null) {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<JobPagesResponse>(
    jobId ? `job-pages-${jobId}` : null,
    jobId ? () => fetchJobPages(jobId) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    pagesData: data,
    isLoading,
    error: error?.message || null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching page tiles.
 */
export function usePageTiles(jobId: number | null, pageNum: number | null) {
  const shouldFetch = jobId !== null && pageNum !== null;

  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<TileGridResponse>(
    shouldFetch ? `page-tiles-${jobId}-${pageNum}` : null,
    shouldFetch ? () => fetchPageTiles(jobId, pageNum) : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  return {
    tilesData: data,
    isLoading,
    error: error?.message || null,
    refresh: mutate,
  };
}

/**
 * Hook for fetching PDF URL for thumbnail rendering.
 */
export function usePdfUrl(jobId: number | null) {
  const {
    data,
    error,
    isLoading,
    mutate,
  } = useSWR<PdfUrlResponse>(
    jobId ? `pdf-url-${jobId}` : null,
    jobId ? () => fetchPdfUrl(jobId) : null,
    {
      revalidateOnFocus: false,
      // Don't auto-revalidate since URLs expire after 1 hour
      refreshInterval: 0,
    }
  );

  return {
    pdfUrl: data?.url || null,
    expiresIn: data?.expiresIn || null,
    isLoading,
    error: error?.message || null,
    refresh: mutate,
  };
}
