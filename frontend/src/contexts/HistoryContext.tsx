'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import type { HistoryEntry, HistoryStatus } from '@/types/history';
import {
  getHistoryEntries,
  getHistoryEntriesPaginated,
  deleteHistoryEntry as deleteFromStorage,
  syncHistoryEntries,
  addHistoryEntry as addToStorage,
  CreateHistoryEntryInput,
} from '@/lib/history-storage';
import { getJobsByIds } from '@/lib/api-client';

interface HistoryContextType {
  entries: HistoryEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  error: string | null;
  hasMore: boolean;
  total: number;
  loadMore: () => void;
  refresh: () => void;
  syncWithServer: () => Promise<void>;
  deleteEntry: (jobId: number) => void;
  addEntry: (input: CreateHistoryEntryInput) => HistoryEntry;
}

const HistoryContext = createContext<HistoryContextType | null>(null);

export function useHistoryContext() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error('useHistoryContext must be used within a HistoryProvider');
  }
  return context;
}

interface HistoryProviderProps {
  children: ReactNode;
  pageSize?: number;
  autoSync?: boolean;
}

export function HistoryProvider({
  children,
  pageSize = 20,
  autoSync = true,
}: HistoryProviderProps) {
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
        err instanceof Error ? err.message : 'Failed to sync with server'
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
  const deleteEntry = useCallback((jobId: number) => {
    deleteFromStorage(jobId);
    // Update local state without full reload
    setEntries((prev) => prev.filter((e) => e.jobId !== jobId));
    setTotal((prev) => prev - 1);
  }, []);

  /**
   * Add a new history entry.
   */
  const addEntry = useCallback(
    (input: CreateHistoryEntryInput): HistoryEntry => {
      const entry = addToStorage(input);
      // Add to the beginning of the list
      setEntries((prev) => [entry, ...prev]);
      setTotal((prev) => prev + 1);
      return entry;
    },
    []
  );

  // Initial load
  useEffect(() => {
    loadEntries(0, false);
  }, [loadEntries]);

  // Auto-sync on mount
  useEffect(() => {
    if (autoSync) {
      syncWithServer();
    }
  }, [autoSync, syncWithServer]);

  return (
    <HistoryContext.Provider
      value={{
        entries,
        isLoading,
        isSyncing,
        error,
        hasMore,
        total,
        loadMore,
        refresh,
        syncWithServer,
        deleteEntry,
        addEntry,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}
