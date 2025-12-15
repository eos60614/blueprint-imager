'use client';

interface EmptyStateProps {
  title?: string;
  message?: string;
  showBrowserNote?: boolean;
}

export function EmptyState({
  title = 'No upload history',
  message = 'Your uploaded files will appear here after processing.',
  showBrowserNote = true,
}: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-4">
      {/* Empty state icon */}
      <div className="mx-auto w-16 h-16 text-gray-300 mb-4">
        <svg
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          className="w-full h-full"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-500 mb-6 max-w-sm mx-auto">{message}</p>

      {/* Browser-specific note */}
      {showBrowserNote && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-md mx-auto">
          <div className="flex items-start">
            <svg
              className="w-5 h-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-blue-700 text-left">
              History is stored in your browser. If you use a different browser
              or clear your data, your history will not be available.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
