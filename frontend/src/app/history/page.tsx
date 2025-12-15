'use client';

import { useState } from 'react';
import { useHistory } from '@/hooks/useHistory';
import { HistoryList } from '@/components/HistoryList';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function HistoryPage() {
  const {
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
  } = useHistory({ pageSize: 20, autoSync: true });

  const [deleteJobId, setDeleteJobId] = useState<number | null>(null);

  const handleDeleteClick = (jobId: number) => {
    setDeleteJobId(jobId);
  };

  const handleDeleteConfirm = () => {
    if (deleteJobId !== null) {
      deleteEntry(deleteJobId);
      setDeleteJobId(null);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteJobId(null);
  };

  const entryToDelete = deleteJobId !== null
    ? entries.find((e) => e.jobId === deleteJobId)
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Upload History
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          View and manage your previously uploaded PDF files
        </p>
      </div>

      {/* History list */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <HistoryList
          entries={entries}
          isLoading={isLoading}
          isSyncing={isSyncing}
          hasMore={hasMore}
          error={error}
          total={total}
          onLoadMore={loadMore}
          onDelete={handleDeleteClick}
          onRefresh={refresh}
        />
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        isOpen={deleteJobId !== null}
        title="Delete from History"
        message={
          entryToDelete
            ? `Remove "${entryToDelete.fileName}" from your history? This only removes the local reference; server files will remain until they expire.`
            : 'Remove this entry from your history?'
        }
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        variant="danger"
      />
    </div>
  );
}
