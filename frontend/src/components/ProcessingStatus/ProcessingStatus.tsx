'use client';

import type { ProcessingStatus as Status } from '@/types/state';
import { ProgressIndicator } from './ProgressIndicator';
import { ErrorDisplay } from './ErrorDisplay';

interface ProcessingStatusProps {
  status: Status;
  progress: number;
  processedPages: number;
  totalPages: number;
  error: string | null;
  onRetry?: () => void;
}

export function ProcessingStatus({
  status,
  progress,
  processedPages,
  totalPages,
  error,
  onRetry,
}: ProcessingStatusProps) {
  if (status === 'idle') {
    return null;
  }

  if (status === 'submitting') {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Starting conversion...</span>
      </div>
    );
  }

  if (status === 'processing') {
    return (
      <ProgressIndicator
        progress={progress}
        processedPages={processedPages}
        totalPages={totalPages}
      />
    );
  }

  if (status === 'error' && error) {
    return <ErrorDisplay error={error} onRetry={onRetry} />;
  }

  if (status === 'complete') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
        <div className="flex items-center">
          <svg
            className="h-5 w-5 text-green-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
              clipRule="evenodd"
            />
          </svg>
          <span className="ml-3 text-green-800 font-medium">
            Processing complete! Your tiles are ready to download.
          </span>
        </div>
      </div>
    );
  }

  return null;
}
