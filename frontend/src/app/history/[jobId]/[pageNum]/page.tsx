'use client';

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useJobDetails, usePageTiles } from '@/hooks/useJobDetails';
import { TileGrid } from '@/components/TileGrid';

export default function TileGridPage() {
  const params = useParams();
  const jobId = params.jobId ? parseInt(params.jobId as string, 10) : null;
  const pageNum = params.pageNum ? parseInt(params.pageNum as string, 10) : null;

  const { jobDetails, isLoading: isLoadingJob, error: jobError } = useJobDetails(jobId);
  const { tilesData, isLoading: isLoadingTiles, error: tilesError } = usePageTiles(jobId, pageNum);

  const isLoading = isLoadingJob || isLoadingTiles;
  const error = jobError || tilesError;

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-24">
          <svg
            className="animate-spin h-10 w-10 text-blue-600"
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
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-lg font-semibold text-red-800 mb-2">
            Failed to load tiles
          </h2>
          <p className="text-red-600 mb-4">{error}</p>
          <Link
            href={`/history/${jobId}`}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Back to job details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Breadcrumb */}
      <nav className="mb-6 text-sm">
        <ol className="flex items-center space-x-2 flex-wrap">
          <li>
            <Link href="/history" className="text-blue-600 hover:text-blue-800">
              History
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li>
            <Link
              href={`/history/${jobId}`}
              className="text-blue-600 hover:text-blue-800 truncate max-w-xs inline-block"
            >
              {jobDetails?.fileName || `Job ${jobId}`}
            </Link>
          </li>
          <li className="text-gray-400">/</li>
          <li className="text-gray-600">Page {pageNum}</li>
        </ol>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Page {pageNum} Tiles
            </h1>
            {jobDetails && (
              <p className="text-gray-500 mt-1">
                {jobDetails.fileName}
              </p>
            )}
          </div>
          <Link
            href={`/history/${jobId}`}
            className="text-blue-600 hover:text-blue-800 flex items-center gap-1 text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to pages
          </Link>
        </div>

        {/* Settings info */}
        {jobDetails && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            {jobDetails.tileSize}x{jobDetails.tileSize}px tiles | {jobDetails.overlap}px overlap |{' '}
            {jobDetails.dpi} DPI
          </div>
        )}
      </div>

      {/* Tile grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <TileGrid
          tilesData={tilesData || null}
          isLoading={isLoadingTiles}
          error={tilesError}
        />
      </div>
    </div>
  );
}
