'use client';

import { getDownloadUrl } from '@/lib/api-client';

interface DownloadButtonProps {
  jobId: number;
  disabled?: boolean;
}

export function DownloadButton({ jobId, disabled = false }: DownloadButtonProps) {
  const handleDownload = () => {
    const url = getDownloadUrl(jobId);
    window.open(url, '_blank');
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      disabled={disabled}
      className={`
        w-full py-3 px-4 rounded-lg font-medium
        transition-all duration-200 flex items-center justify-center
        ${
          disabled
            ? 'bg-gray-400 text-white cursor-not-allowed'
            : 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
        }
      `}
    >
      <svg
        className="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
        />
      </svg>
      Download Tiles (ZIP)
    </button>
  );
}
