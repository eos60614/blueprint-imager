'use client';

import { useState, useEffect, useCallback } from 'react';
import type { HistoryEntry, HistoryStatus } from '@/types/history';
import {
  getHistoryEntries,
  getHistoryEntriesPaginated,
  deleteHistoryEntry as deleteFromStorage,
  syncHistoryEntries,
} from '@/lib/history-storage';
import { getJobsByIds } from '@/lib/api-client';

interface UseHistoryOptions {
  pageSize?: number;
  autoSync?: boolean;
}

interface UseHistoryResult {
  entries: HistoryEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  page: number;
  loadMore: () => void;
  refresh: () => void;
  syncWithServer: () => Promise<void>;
  deleteEntry: (jobId: number) => void;
}

/**
 * Hook for managing history entries with localStorage and server sync.
 */
export function useHistory(options: UseHistoryOptions = {}): UseHistoryResult {
  const { pageSize = 20, autoSync = true } = options;

  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);

  /**
   * Load history entries from localStorage with pagination.
   */
  const loadEntries = useCallback(
    (pageNum: number = 0, append: boolean = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const result = getHistoryEntriesPaginated(pageNum, pageSize);

        if (append) {
          setEntries((prev) => [...prev, ...result.entries]);
        } else {
          setEntries(result.entries);
        }

        setHasMore(result.hasMore);
        setTotal(result.total);
        setPage(pageNum);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load history'
        );
      } finally {
        setIsLoading(false);
      }
    },
    [pageSize]
  );

  /**
   * Sync local history with server status.
   */
  const syncWithServer = useCallback(async () => {
    const allEntries = getHistoryEntries();

    if (allEntries.length === 0) {
      return;
    }

    setIsSyncing(true);
    setError(null);

    try {
      const jobIds = allEntries.map((e) => e.jobId);
      const response = await getJobsByIds(jobIds);

      // Build a map of server statuses
      const serverStatusMap = new Map<number, HistoryStatus>();
      const foundJobIds = new Set<number>();

      for (const job of response.jobs) {
        foundJobIds.add(job.jobId);
        serverStatusMap.set(job.jobId, job.status as HistoryStatus);
      }

      // Prepare updates
      const updates: Array<{ jobId: number; status: HistoryStatus }> = [];

      for (const entry of allEntries) {
        if (!foundJobIds.has(entry.jobId)) {
          // Job not found on server - mark as unavailable
          updates.push({ jobId: entry.jobId, status: 'unavailable' });
        } else {
          const serverStatus = serverStatusMap.get(entry.jobId);
          if (serverStatus && serverStatus !== entry.status) {
            updates.push({ jobId: entry.jobId, status: serverStatus });
          }
        }
      }

      // Apply updates to localStorage
      if (updates.length > 0) {
        syncHistoryEntries(updates);
      }

      // Reload entries
      loadEntries(0, false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to sync with server'
      );
    } finally {
      setIsSyncing(false);
    }
  }, [loadEntries]);

  /**
   * Load more entries (pagination).
   */
  const loadMore = useCallback(() => {
    if (hasMore && !isLoading) {
      loadEntries(page + 1, true);
    }
  }, [hasMore, isLoading, page, loadEntries]);

  /**
   * Refresh the list from the beginning.
   */
  const refresh = useCallback(() => {
    loadEntries(0, false);
  }, [loadEntries]);

  /**
   * Delete an entry from history.
   */
  const deleteEntry = useCallback(
    (jobId: number) => {
      deleteFromStorage(jobId);
      // Update local state without full reload
      setEntries((prev) => prev.filter((e) => e.jobId !== jobId));
      setTotal((prev) => prev - 1);
    },
    []
  );

  // Initial load and auto-sync
  useEffect(() => {
    loadEntries(0, false);

    if (autoSync) {
      syncWithServer();
    }
  }, [loadEntries, autoSync, syncWithServer]);

  return {
    entries,
    isLoading,
    isSyncing,
    error,
    hasMore,
    total,
    page,
    loadMore,
    refresh,
    syncWithServer,
    deleteEntry,
  };
}
