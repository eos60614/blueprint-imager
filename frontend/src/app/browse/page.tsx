'use client';

import { useState, useCallback } from 'react';
import { useProjects } from '@/hooks/useProjects';
import { useDrawings } from '@/hooks/useDrawings';
import { useJobStatus } from '@/hooks/useJobStatus';
import { useWindowSize } from '@/hooks/useWindowSize';
import { DrawingFilters } from '@/components/DrawingFilters/DrawingFilters';
import { DrawingList } from '@/components/DrawingList/DrawingList';
import { DrawingProcessButton } from '@/components/DrawingProcessButton/DrawingProcessButton';
import { ProcessingSettingsPanel } from '@/components/ProcessingSettings/ProcessingSettings';
import { ProcessingStatus } from '@/components/ProcessingStatus/ProcessingStatus';
import { DownloadButton } from '@/components/DownloadButton/DownloadButton';
import { TileLayoutPreview } from '@/components/TileLayoutPreview';
import { processDrawings } from '@/lib/api-client';
import type { ProcessingSettings } from '@/types/procore';

const DEFAULT_SETTINGS: ProcessingSettings = {
  dpi: 600,
  tileSize: 1920,
  overlap: 250,
  noTiles: false,
};

export default function BrowsePage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>();
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<Set<number>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeJobId, setActiveJobId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<ProcessingSettings>(DEFAULT_SETTINGS);

  const { layoutConfig } = useWindowSize();
  const { projects, isLoading: projectsLoading, error: projectsError } = useProjects();

  const {
    drawings,
    total,
    page: currentPage,
    limit,
    hasMore,
    isLoading: drawingsLoading,
    error: drawingsError,
  } = useDrawings({
    projectId: selectedProjectId,
    search: searchQuery || undefined,
    page,
    limit: 50,
  });

  const {
    status: jobStatus,
    progress: jobProgress,
    processedPages,
    totalPages,
    errorMessage: jobErrorMessage,
  } = useJobStatus(activeJobId);

  const handleProjectChange = useCallback((projectId: number | undefined) => {
    setSelectedProjectId(projectId);
    setPage(1);
  }, []);

  const handleSearchChange = useCallback((search: string) => {
    setSearchQuery(search);
    setPage(1);
  }, []);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSelectionChange = useCallback((drawingId: number, selected: boolean) => {
    setSelectedDrawingIds((prev) => {
      const next = new Set(prev);
      if (selected) {
        if (next.size < 10) {
          next.add(drawingId);
        }
      } else {
        next.delete(drawingId);
      }
      return next;
    });
  }, []);

  const handleProcess = useCallback(async () => {
    if (selectedDrawingIds.size === 0 || selectedDrawingIds.size > 10) {
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const response = await processDrawings({
        drawingIds: Array.from(selectedDrawingIds),
        dpi: settings.dpi,
        tileSize: settings.tileSize,
        overlap: settings.overlap,
        noTiles: settings.noTiles,
      });

      setActiveJobId(response.jobId);
      setSelectedDrawingIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start processing');
    } finally {
      setIsProcessing(false);
    }
  }, [selectedDrawingIds, settings]);

  const handleReset = useCallback(() => {
    setActiveJobId(null);
    setError(null);
  }, []);

  // Show error state
  if (projectsError || drawingsError) {
    const err = projectsError || drawingsError;
    return (
      <div
        className="mx-auto px-4 sm:px-6 lg:px-8 py-8"
        style={{ maxWidth: layoutConfig.containerMaxWidth }}
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center">
            <svg
              className="h-5 w-5 text-red-400 mr-2"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span className="text-red-800 font-medium">Error loading data</span>
          </div>
          <p className="mt-2 text-sm text-red-700">
            {err?.message || 'Unable to connect to the database. Please try again later.'}
          </p>
        </div>
      </div>
    );
  }

  // Show job status when processing
  const showJobStatus = activeJobId !== null && (jobStatus === 'processing' || jobStatus === 'pending');
  const showDownload = activeJobId !== null && jobStatus === 'completed';
  const showJobError = activeJobId !== null && jobStatus === 'failed';

  return (
    <div
      className="mx-auto px-4 sm:px-6 lg:px-8 py-8"
      style={{ maxWidth: layoutConfig.containerMaxWidth }}
    >
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Browse Drawings</h1>
        <p className="mt-1 text-sm text-gray-600">
          View and filter M-series (mechanical) drawings from the Procore database.
          Select up to 10 drawings to process through the tile pipeline.
        </p>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Job Status */}
      {showJobStatus && (
        <div className="mb-4">
          <ProcessingStatus
            status={jobStatus === 'pending' ? 'submitting' : 'processing'}
            progress={jobProgress}
            processedPages={processedPages}
            totalPages={totalPages}
            error={null}
          />
        </div>
      )}

      {/* Job Error */}
      {showJobError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-red-800">Processing failed</p>
              <p className="text-sm text-red-700">{jobErrorMessage}</p>
            </div>
            <button
              onClick={handleReset}
              className="px-3 py-1 text-sm text-red-700 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* Download Section */}
      {showDownload && activeJobId && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-800">Processing complete</p>
              <p className="text-sm text-green-700">Your tiles are ready for download.</p>
            </div>
            <div className="flex items-center space-x-2">
              <DownloadButton jobId={activeJobId} />
              <button
                onClick={handleReset}
                className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
              >
                Process More
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <DrawingFilters
        projects={projects}
        selectedProjectId={selectedProjectId}
        searchQuery={searchQuery}
        onProjectChange={handleProjectChange}
        onSearchChange={handleSearchChange}
        isLoading={projectsLoading}
      />

      {/* Processing Settings with Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <ProcessingSettingsPanel
          settings={settings}
          onChange={setSettings}
          disabled={showJobStatus}
        />
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Tile Preview</h3>
          <TileLayoutPreview
            drawingId={selectedDrawingIds.size === 1 ? Array.from(selectedDrawingIds)[0] : null}
            dpi={settings.dpi}
            tileSize={settings.tileSize}
            overlap={settings.overlap}
            noTiles={settings.noTiles}
            fullWidth
            previewHeight={layoutConfig.previewPanelHeight}
          />
          {selectedDrawingIds.size > 1 && (
            <p className="mt-2 text-xs text-gray-500 text-center">
              Select a single drawing to preview tile layout
            </p>
          )}
        </div>
      </div>

      {/* Process Button */}
      <DrawingProcessButton
        selectedCount={selectedDrawingIds.size}
        onProcess={handleProcess}
        isProcessing={isProcessing || showJobStatus}
        maxSelections={10}
      />

      {/* Drawing List with Selection */}
      <DrawingList
        drawings={drawings}
        isLoading={drawingsLoading}
        total={total}
        page={currentPage}
        limit={limit}
        hasMore={hasMore}
        onPageChange={handlePageChange}
        selectedDrawingIds={selectedDrawingIds}
        onSelectionChange={handleSelectionChange}
        selectionEnabled={!showJobStatus}
        showThumbnails={layoutConfig.showThumbnailColumn}
        thumbnailSize={layoutConfig.thumbnailSize}
      />
    </div>
  );
}
