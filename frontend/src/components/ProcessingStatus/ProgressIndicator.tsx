'use client';

interface ProgressIndicatorProps {
  progress: number;
  processedPages: number;
  totalPages: number;
}

export function ProgressIndicator({
  progress,
  processedPages,
  totalPages,
}: ProgressIndicatorProps) {
  const roundedProgress = Math.round(progress);

  return (
    <div className="w-full">
      <div className="flex justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          Processing pages...
        </span>
        <span className="text-sm font-medium text-gray-700">
          {roundedProgress}%
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="mt-2 text-sm text-gray-500 text-center">
        {processedPages} of {totalPages} pages processed
      </p>
    </div>
  );
}
