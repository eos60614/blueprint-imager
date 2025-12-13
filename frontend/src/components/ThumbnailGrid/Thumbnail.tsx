'use client';

interface ThumbnailProps {
  pageNumber: number;
  dataUrl?: string;
  isSelected: boolean;
  isLoading: boolean;
  onClick?: () => void;
}

export function Thumbnail({
  pageNumber,
  dataUrl,
  isSelected,
  isLoading,
  onClick,
}: ThumbnailProps) {
  return (
    <div
      onClick={onClick}
      className={`
        relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all
        ${isSelected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-gray-300'
        }
      `}
    >
      {/* Thumbnail image or placeholder */}
      <div className="aspect-[3/4] bg-gray-100 flex items-center justify-center">
        {isLoading ? (
          <div className="animate-pulse bg-gray-200 w-full h-full" />
        ) : dataUrl ? (
          <img
            src={dataUrl}
            alt={`Page ${pageNumber}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="text-gray-400 text-sm">No preview</div>
        )}
      </div>

      {/* Page number badge */}
      <div
        className={`
          absolute bottom-1 left-1 px-2 py-0.5 rounded text-xs font-medium
          ${isSelected ? 'bg-blue-500 text-white' : 'bg-gray-800/70 text-white'}
        `}
      >
        {pageNumber}
      </div>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-1 right-1">
          <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
      )}
    </div>
  );
}
