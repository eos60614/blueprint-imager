'use client';

interface SubmitButtonProps {
  onClick: () => void;
  disabled: boolean;
  selectedCount: number;
  isSubmitting: boolean;
}

export function SubmitButton({
  onClick,
  disabled,
  selectedCount,
  isSubmitting,
}: SubmitButtonProps) {
  const buttonText = isSubmitting
    ? 'Starting...'
    : selectedCount === 0
      ? 'Select pages to convert'
      : `Convert ${selectedCount} page${selectedCount === 1 ? '' : 's'}`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isSubmitting}
      className={`
        w-full py-3 px-4 rounded-lg font-medium text-white
        transition-all duration-200
        ${
          disabled || isSubmitting
            ? 'bg-gray-400 cursor-not-allowed'
            : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
        }
      `}
    >
      {isSubmitting && (
        <span className="inline-block mr-2">
          <svg
            className="animate-spin h-4 w-4 inline"
            xmlns="http://www.w3.org/2000/svg"
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
        </span>
      )}
      {buttonText}
    </button>
  );
}
