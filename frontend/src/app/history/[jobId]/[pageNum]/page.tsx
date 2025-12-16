'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useJobDetails, usePageTiles } from '@/hooks/useJobDetails';
import { TileGrid, selectionToTileSelections } from '@/components/TileGrid';
import { RoboflowUpload } from '@/components/RoboflowUpload';
import { downloadSelectedTiles } from '@/lib/api-client';

export default function TileGridPage() {
  const params = useParams();
  const jobId = params.jobId ? parseInt(params.jobId as string, 10) : null;
  const pageNum = params.pageNum ? parseInt(params.pageNum as string, 10) : null;

  const { jobDetails, isLoading: isLoadingJob, error: jobError } = useJobDetails(jobId);
  const { tilesData, isLoading: isLoadingTiles, error: tilesError } = usePageTiles(jobId, pageNum);

  // Selection state
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedTiles, setSelectedTiles] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const isLoading = isLoadingJob || isLoadingTiles;
  const error = jobError || tilesError;

  const handleToggleSelectionMode = useCallback(() => {
    setSelectionMode((prev) => !prev);
    if (selectionMode) {
      // Clear selection when exiting selection mode
      setSelectedTiles(new Set());
    }
  }, [selectionMode]);

  const handleUploadComplete = useCallback(() => {
    // Optionally clear selection after upload
    setSelectedTiles(new Set());
  }, []);

  const handleDownloadSelected = useCallback(async () => {
    if (!jobId || !pageNum || selectedTiles.size === 0) return;

    setIsDownloading(true);
    try {
      const tiles = selectionToTileSelections(selectedTiles, pageNum);
      const blob = await downloadSelectedTiles(jobId, tiles);

      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `job_${jobId}_page_${pageNum}_tiles.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setIsDownloading(false);
    }
  }, [jobId, pageNum, selectedTiles]);

  // Convert selection to TileSelection array for upload
  const selectedTileSelections = pageNum
    ? selectionToTileSelections(selectedTiles, pageNum)
    : [];

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
          <div className="flex items-center gap-3">
            {/* Selection mode toggle */}
            <button
              onClick={handleToggleSelectionMode}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                selectionMode
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {selectionMode ? 'Cancel Selection' : 'Select Tiles'}
            </button>

            {/* Download selected button */}
            {selectionMode && selectedTiles.size > 0 && (
              <button
                onClick={handleDownloadSelected}
                disabled={isDownloading}
                className="px-3 py-1.5 rounded-lg text-sm font-medium bg-green-600 text-white hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
              >
                {isDownloading ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download ({selectedTiles.size})
                  </>
                )}
              </button>
            )}

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
        </div>

        {/* Settings info */}
        {jobDetails && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            {jobDetails.tileSize}x{jobDetails.tileSize}px tiles | {jobDetails.overlap}px overlap |{' '}
            {jobDetails.dpi} DPI
          </div>
        )}
      </div>

      {/* Roboflow upload panel - shown when in selection mode */}
      {selectionMode && jobId && (
        <div className="mb-6">
          <RoboflowUpload
            jobId={jobId}
            selectedTiles={selectedTileSelections}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      )}

      {/* Tile grid */}
      <div className="bg-white rounded-lg shadow p-6">
        <TileGrid
          tilesData={tilesData || null}
          isLoading={isLoadingTiles}
          error={tilesError}
          selectionMode={selectionMode}
          selectedTiles={selectedTiles}
          onSelectionChange={setSelectedTiles}
          pageNum={pageNum || undefined}
        />
      </div>
    </div>
  );
}
