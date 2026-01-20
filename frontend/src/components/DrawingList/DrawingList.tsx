'use client';

import type { ProcoreDrawing } from '@/types/procore';
import { DrawingThumbnail } from '@/components/DrawingThumbnail';

interface DrawingListProps {
  drawings: ProcoreDrawing[];
  isLoading?: boolean;
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (page: number) => void;
  selectedDrawingIds?: Set<number>;
  onSelectionChange?: (drawingId: number, selected: boolean) => void;
  selectionEnabled?: boolean;
  showThumbnails?: boolean;
  thumbnailSize?: 'sm' | 'md' | 'lg';
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '-';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(1)} ${units[unitIndex]}`;
}

export function DrawingList({
  drawings,
  isLoading = false,
  total,
  page,
  limit,
  hasMore,
  onPageChange,
  selectedDrawingIds = new Set(),
  onSelectionChange,
  selectionEnabled = false,
  showThumbnails = true,
  thumbnailSize = 'md',
}: DrawingListProps) {
  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const totalPages = Math.ceil(total / limit);

  if (isLoading && drawings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Loading drawings...</span>
        </div>
      </div>
    );
  }

  if (!isLoading && drawings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center text-gray-500">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="mt-2 text-sm">No drawings found matching your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Results summary */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          Showing {startItem}-{endItem} of {total} drawings
          {selectionEnabled && selectedDrawingIds.size > 0 && (
            <span className="ml-2 text-blue-600">
              ({selectedDrawingIds.size} selected)
            </span>
          )}
        </span>
        {isLoading && (
          <span className="text-sm text-blue-600 flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            Loading...
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {selectionEnabled && (
                <th className="px-4 py-3 w-10">
                  <span className="sr-only">Select</span>
                </th>
              )}
              {showThumbnails && (
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                  Preview
                </th>
              )}
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Drawing
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Project
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Revision
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Size
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {drawings.map((drawing) => {
              const isSelected = selectedDrawingIds.has(drawing.id);
              const canSelect = drawing.hasFile;

              return (
                <tr
                  key={drawing.id}
                  className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''} ${
                    !canSelect && selectionEnabled ? 'opacity-60' : ''
                  }`}
                >
                  {selectionEnabled && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelect}
                        onChange={(e) =>
                          onSelectionChange?.(drawing.id, e.target.checked)
                        }
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        title={canSelect ? 'Select for processing' : 'No file available'}
                      />
                    </td>
                  )}
                  {showThumbnails && (
                    <td className="px-4 py-3 hidden md:table-cell">
                      <DrawingThumbnail
                        drawingId={drawing.id}
                        hasFile={drawing.hasFile}
                        drawingNumber={drawing.drawingNumber}
                        size={thumbnailSize}
                      />
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-gray-900">
                        {drawing.drawingNumber}
                      </span>
                      {drawing.title && (
                        <span className="text-sm text-gray-500">{drawing.title}</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm text-gray-900">{drawing.projectName}</span>
                      {drawing.projectNumber && (
                        <span className="text-xs text-gray-500">
                          {drawing.projectNumber}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {drawing.revisionNumber || '-'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(drawing.fileSize)}
                  </td>
                  <td className="px-4 py-3">
                    {drawing.hasFile ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Available
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                        No File
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1 || isLoading}
            className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={!hasMore || isLoading}
            className="px-3 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
