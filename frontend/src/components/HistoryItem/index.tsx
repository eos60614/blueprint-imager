'use client';

import Link from 'next/link';
import type { HistoryEntry, HistoryStatus } from '@/types/history';
import { getDownloadUrl } from '@/lib/api-client';

interface HistoryItemProps {
  entry: HistoryEntry;
  onDelete?: (jobId: number) => void;
  showDeleteButton?: boolean;
  showDownloadButton?: boolean;
}

function getStatusBadge(status: HistoryStatus) {
  const statusStyles: Record<HistoryStatus, { bg: string; text: string; label: string }> = {
    pending: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-800',
      label: 'Pending',
    },
    processing: {
      bg: 'bg-blue-100',
      text: 'text-blue-800',
      label: 'Processing',
    },
    completed: {
      bg: 'bg-green-100',
      text: 'text-green-800',
      label: 'Completed',
    },
    failed: {
      bg: 'bg-red-100',
      text: 'text-red-800',
      label: 'Failed',
    },
    unavailable: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      label: 'Unavailable',
    },
  };

  const style = statusStyles[status];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}
    >
      {style.label}
    </span>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryItem({
  entry,
  onDelete,
  showDeleteButton = true,
  showDownloadButton = true,
}: HistoryItemProps) {
  const isClickable = entry.status === 'completed' || entry.status === 'processing';
  const canDownload = entry.status === 'completed';

  const handleDownload = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (canDownload) {
      const url = getDownloadUrl(entry.jobId);
      window.open(url, '_blank');
    }
  };

  const content = (
    <div className="flex items-center justify-between p-4">
      <div className="flex-1 min-w-0">
        {/* File name */}
        <h3 className="text-sm font-medium text-gray-900 truncate">
          {entry.fileName}
        </h3>

        {/* Metadata */}
        <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
          <span>{formatDate(entry.uploadedAt)}</span>
          <span>
            {entry.selectedPages.length} of {entry.pageCount} page
            {entry.pageCount !== 1 ? 's' : ''} selected
          </span>
        </div>

        {/* Settings */}
        <div className="mt-1 text-xs text-gray-400">
          {entry.settings.dpi} DPI | {entry.settings.tileSize}x
          {entry.settings.tileSize} tiles | {entry.settings.overlap}px overlap
        </div>
      </div>

      {/* Status and actions */}
      <div className="flex items-center gap-3 ml-4">
        {getStatusBadge(entry.status)}

        {/* Download button for completed jobs */}
        {showDownloadButton && canDownload && (
          <button
            type="button"
            onClick={handleDownload}
            className="p-1.5 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
            aria-label="Download tiles"
            title="Download tiles (ZIP)"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
          </button>
        )}

        {showDeleteButton && onDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(entry.jobId);
            }}
            className="p-1 text-gray-400 hover:text-red-500 transition-colors"
            aria-label="Delete from history"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}

        {/* Arrow indicator for clickable items */}
        {isClickable && (
          <svg
            className="w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        )}
      </div>
    </div>
  );

  if (isClickable) {
    return (
      <Link
        href={`/history/${entry.jobId}`}
        className="block bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-blue-300 transition-all"
      >
        {content}
      </Link>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg opacity-75">
      {content}
    </div>
  );
}
