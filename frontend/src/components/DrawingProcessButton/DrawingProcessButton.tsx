'use client';

interface DrawingProcessButtonProps {
  selectedCount: number;
  onProcess: () => void;
  isProcessing?: boolean;
  maxSelections?: number;
}

export function DrawingProcessButton({
  selectedCount,
  onProcess,
  isProcessing = false,
  maxSelections = 10,
}: DrawingProcessButtonProps) {
  const isDisabled = selectedCount === 0 || selectedCount > maxSelections || isProcessing;

  let validationMessage = '';
  if (selectedCount === 0) {
    validationMessage = 'Select drawings to process';
  } else if (selectedCount > maxSelections) {
    validationMessage = `Maximum ${maxSelections} drawings allowed`;
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-600">
            {selectedCount > 0 ? (
              <>
                <span className="font-medium text-gray-900">{selectedCount}</span> drawing
                {selectedCount !== 1 ? 's' : ''} selected
              </>
            ) : (
              'No drawings selected'
            )}
          </span>
          {validationMessage && selectedCount > 0 && (
            <span className="text-sm text-red-600">{validationMessage}</span>
          )}
        </div>

        <button
          onClick={onProcess}
          disabled={isDisabled}
          className={`
            px-4 py-2 rounded-md text-sm font-medium transition-colors
            ${
              isDisabled
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2'
            }
          `}
        >
          {isProcessing ? (
            <span className="flex items-center">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
              Processing...
            </span>
          ) : (
            `Process ${selectedCount > 0 ? selectedCount : ''} Drawing${selectedCount !== 1 ? 's' : ''}`
          )}
        </button>
      </div>
    </div>
  );
}
