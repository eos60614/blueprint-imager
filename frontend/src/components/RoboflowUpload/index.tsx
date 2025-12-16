'use client';

import { useRoboflowStatus, useRoboflowUpload } from '@/hooks/useRoboflowUpload';
import type { TileSelection } from '@/types/roboflow';

interface RoboflowUploadProps {
  jobId: number;
  selectedTiles: TileSelection[];
  onUploadComplete?: () => void;
}

export function RoboflowUpload({ jobId, selectedTiles, onUploadComplete }: RoboflowUploadProps) {
  const { isConfigured, projectName, isLoading: isCheckingStatus } = useRoboflowStatus();
  const { uploadTiles, isUploading, result, error, reset } = useRoboflowUpload();

  const handleUpload = async () => {
    const uploadResult = await uploadTiles(jobId, selectedTiles);
    if (uploadResult && onUploadComplete) {
      onUploadComplete();
    }
  };

  // Loading state while checking configuration
  if (isCheckingStatus) {
    return (
      <div className="bg-gray-50 rounded-lg p-4 text-center text-gray-500 text-sm">
        Checking Roboflow configuration...
      </div>
    );
  }

  // Not configured state
  if (!isConfigured) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-yellow-800">Roboflow not configured</p>
            <p className="text-xs text-yellow-700 mt-1">
              Set ROBOFLOW_API_KEY and ROBOFLOW_PROJECT_NAME environment variables to enable uploads.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Show result after upload
  if (result) {
    const hasErrors = result.failed > 0;
    return (
      <div className={`rounded-lg p-4 ${hasErrors ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
        <div className="flex items-start justify-between">
          <div>
            <p className={`text-sm font-medium ${hasErrors ? 'text-yellow-800' : 'text-green-800'}`}>
              Upload Complete
            </p>
            <p className="text-xs mt-1 text-gray-600">
              {result.successful} of {result.total} tiles uploaded successfully
            </p>
            {result.successful > 0 && (
              <p className="text-xs mt-1 text-gray-500">
                Split: {result.splits.train} train, {result.splits.valid} valid, {result.splits.test} test
              </p>
            )}
            {hasErrors && result.errors.length > 0 && (
              <div className="mt-2">
                <p className="text-xs font-medium text-yellow-700">Errors:</p>
                <ul className="text-xs text-yellow-600 mt-1 max-h-20 overflow-y-auto">
                  {result.errors.slice(0, 5).map((err, i) => (
                    <li key={i} className="truncate">{err}</li>
                  ))}
                  {result.errors.length > 5 && (
                    <li className="text-yellow-500">...and {result.errors.length - 5} more</li>
                  )}
                </ul>
              </div>
            )}
          </div>
          <button
            onClick={reset}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Show error
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-red-800">Upload Failed</p>
            <p className="text-xs text-red-600 mt-1">{error}</p>
          </div>
          <button
            onClick={reset}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Default upload button state
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-700">Upload to Roboflow</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Project: {projectName} | {selectedTiles.length} tile{selectedTiles.length !== 1 ? 's' : ''} selected
          </p>
        </div>
        <button
          onClick={handleUpload}
          disabled={isUploading || selectedTiles.length === 0}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
            isUploading || selectedTiles.length === 0
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-purple-600 text-white hover:bg-purple-700'
          }`}
        >
          {isUploading ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Uploading...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload to Roboflow
            </>
          )}
        </button>
      </div>
    </div>
  );
}
