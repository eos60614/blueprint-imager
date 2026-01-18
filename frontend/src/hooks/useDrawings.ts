'use client';

import useSWR from 'swr';
import { listProcoreDrawings } from '@/lib/api-client';
import type { ListDrawingsResponse } from '@/types/procore';

interface UseDrawingsParams {
  projectId?: number;
  search?: string;
  page?: number;
  limit?: number;
}

async function fetchDrawings(params: UseDrawingsParams): Promise<ListDrawingsResponse> {
  return listProcoreDrawings(params);
}

interface UseDrawingsOptions {
  enabled?: boolean;
}

export function useDrawings(
  params: UseDrawingsParams = {},
  options: UseDrawingsOptions = {}
) {
  const { enabled = true } = options;

  // Create a stable cache key from params
  const cacheKey = enabled
    ? ['procoreDrawings', params.projectId, params.search, params.page, params.limit]
    : null;

  const { data, error, isLoading, mutate } = useSWR<ListDrawingsResponse, Error>(
    cacheKey,
    () => fetchDrawings(params),
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000, // Cache for 5 seconds
      keepPreviousData: true, // Keep showing previous data while loading new page
    }
  );

  return {
    drawings: data?.drawings ?? [],
    total: data?.total ?? 0,
    page: data?.page ?? 1,
    limit: data?.limit ?? 50,
    hasMore: data?.hasMore ?? false,
    isLoading,
    error,
    refresh: mutate,
  };
}
