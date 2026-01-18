'use client';

import useSWR from 'swr';
import { listProcoreProjects } from '@/lib/api-client';
import type { ListProjectsResponse } from '@/types/procore';

async function fetchProjects(): Promise<ListProjectsResponse> {
  return listProcoreProjects();
}

interface UseProjectsOptions {
  enabled?: boolean;
}

export function useProjects(options: UseProjectsOptions = {}) {
  const { enabled = true } = options;

  const { data, error, isLoading, mutate } = useSWR<ListProjectsResponse, Error>(
    enabled ? 'procoreProjects' : null,
    fetchProjects,
    {
      revalidateOnFocus: false,
      dedupingInterval: 30000, // Cache for 30 seconds
    }
  );

  return {
    projects: data?.projects ?? [],
    total: data?.total ?? 0,
    isLoading,
    error,
    refresh: mutate,
  };
}
