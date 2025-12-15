'use client';

import { useEffect, useRef, useCallback } from 'react';
import type { HistoryEntry } from '@/types/history';
import { HistoryItem } from '@/components/HistoryItem';
import { EmptyState } from '@/components/EmptyState';

interface HistoryListProps {
  entries: HistoryEntry[];
  isLoading: boolean;
  isSyncing: boolean;
  hasMore: boolean;
  error: string | null;
  total: number;
  onLoadMore: () => void;
  onDelete: (jobId: number) => void;
  onRefresh: () => void;
}

export function HistoryList({
  entries,
  isLoading,
  isSyncing,
  hasMore,
  error,
  total,
  onLoadMore,
  onDelete,
  onRefresh,
}: HistoryListProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Set up intersection observer for infinite scroll
  const setupObserver = useCallback(
    (node: HTMLDivElement | null) => {
      if (isLoading) return;

      if (observerRef.current) {
        observerRef.current.disconnect();
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            onLoadMore();
          }
        },
        { threshold: 0.1 }
      );

      if (node) {
        observerRef.current.observe(node);
      }
    },
    [isLoading, hasMore, onLoadMore]
  );

  // Clean up observer on unmount
  useEffect(() => {
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Show empty state
  if (!isLoading && entries.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-4">
      {/* Header with count and sync status */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {total} upload{total !== 1 ? 's' : ''} in history
        </p>
        <div className="flex items-center gap-2">
          {isSyncing && (
            <span className="text-xs text-gray-400 flex items-center">
              <svg
                className="animate-spin -ml-1 mr-1 h-3 w-3 text-gray-400"
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
              Syncing...
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading || isSyncing}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:text-gray-400"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* History items */}
      <div className="space-y-3">
        {entries.map((entry) => (
          <HistoryItem
            key={entry.jobId}
            entry={entry}
            onDelete={onDelete}
          />
        ))}
      </div>

      {/* Loading indicator for infinite scroll */}
      {isLoading && (
        <div className="flex justify-center py-4">
          <svg
            className="animate-spin h-6 w-6 text-blue-600"
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
      )}

      {/* Infinite scroll trigger */}
      {hasMore && !isLoading && (
        <div
          ref={setupObserver}
          className="h-10 flex items-center justify-center"
        >
          <span className="text-sm text-gray-400">Loading more...</span>
        </div>
      )}

      {/* End of list message */}
      {!hasMore && entries.length > 0 && (
        <p className="text-center text-sm text-gray-400 py-4">
          End of history
        </p>
      )}
    </div>
  );
}
