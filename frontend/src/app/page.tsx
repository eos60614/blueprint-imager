'use client';

import { useEffect, useState, useCallback } from 'react';
import { UploadProvider, useUpload } from '@/contexts/UploadContext';
import { SelectionProvider, useSelection } from '@/contexts/SelectionContext';
import { ProcessingProvider, useProcessing } from '@/contexts/ProcessingContext';
import { FileUpload } from '@/components/FileUpload';
import { PageSelector } from '@/components/PageSelector';
import { ThumbnailGrid } from '@/components/ThumbnailGrid';
import { ProcessingStatus } from '@/components/ProcessingStatus';
import { SubmitButton } from '@/components/SubmitButton';
import { DownloadButton } from '@/components/DownloadButton';
import { Instructions } from '@/components/Instructions';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ConversionSettings } from '@/components/ConversionSettings';
import { DEFAULT_CONVERSION_SETTINGS } from '@/types/api';
import type { ConversionSettings as ConversionSettingsType } from '@/types/api';

function ProcessingSection() {
  const { documentState, uploadState } = useUpload();
  const { selectionState } = useSelection();
  const { processingState, startProcessing, reset } = useProcessing();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [conversionSettings, setConversionSettings] = useState<ConversionSettingsType>(
    DEFAULT_CONVERSION_SETTINGS
  );

  if (!documentState) return null;

  const handleSubmit = () => {
    if (selectionState.selectedPages.length === 0) return;
    setShowConfirmModal(true);
  };

  const handleConfirm = () => {
    setShowConfirmModal(false);
    startProcessing(
      documentState.uploadId,
      selectionState.selectedPages,
      conversionSettings,
      {
        fileName: uploadState.fileName || 'document.pdf',
        pageCount: documentState.pageCount,
      }
    );
  };

  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  const canSubmit =
    selectionState.selectedPages.length > 0 &&
    selectionState.isValid &&
    processingState.status === 'idle';

  const isSubmitting = processingState.status === 'submitting';
  const isProcessing = processingState.status === 'processing';
  const isComplete = processingState.status === 'complete';
  const hasError = processingState.status === 'error';

  // Keyboard navigation: Enter to submit
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === 'Enter' &&
        !e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        canSubmit &&
        !isProcessing &&
        !isComplete &&
        !showConfirmModal
      ) {
        // Don't trigger if focus is on an input element
        const activeElement = document.activeElement;
        if (
          activeElement?.tagName !== 'INPUT' &&
          activeElement?.tagName !== 'TEXTAREA'
        ) {
          handleSubmit();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [canSubmit, isProcessing, isComplete, showConfirmModal]);

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
          Step 3: Process & Download
        </h2>

        <div className="space-y-4">
          {/* Conversion settings */}
          {!isProcessing && !isComplete && (
            <ConversionSettings
              settings={conversionSettings}
              onChange={setConversionSettings}
              disabled={isSubmitting}
            />
          )}

          {/* Show submit button when not processing */}
          {!isProcessing && !isComplete && (
            <SubmitButton
              onClick={handleSubmit}
              disabled={!canSubmit || hasError}
              selectedCount={selectionState.selectedPages.length}
              isSubmitting={isSubmitting}
            />
          )}

          {/* Show processing status */}
          <ProcessingStatus
            status={processingState.status}
            progress={processingState.progress}
            processedPages={processingState.processedPages}
            totalPages={processingState.totalPages}
            error={processingState.error}
            onRetry={reset}
          />

          {/* Show download button when complete */}
          {isComplete && processingState.jobId && (
            <div className="pt-2">
              <DownloadButton jobId={processingState.jobId} />
            </div>
          )}

          {/* Option to process again after completion */}
          {isComplete && (
            <button
              type="button"
              onClick={reset}
              className="w-full py-2 px-4 text-sm text-gray-600 hover:text-gray-800 underline"
            >
              Process different pages
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        title="Start Processing"
        message={`Convert ${selectionState.selectedPages.length} page${
          selectionState.selectedPages.length === 1 ? '' : 's'
        } to tiled images? This may take a few minutes depending on the number of pages.`}
        confirmText="Start Processing"
        cancelText="Cancel"
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </>
  );
}

function PageSelectionSection() {
  const { uploadState, documentState } = useUpload();
  const {
    selectionState,
    thumbnails,
    updateSelection,
    togglePage,
    loadThumbnails,
    initializeFromFile,
  } = useSelection();

  // Initialize PDF for thumbnail rendering when file is uploaded
  useEffect(() => {
    if (uploadState.file && uploadState.uploadStatus === 'uploaded') {
      initializeFromFile(uploadState.file);
    }
  }, [uploadState.file, uploadState.uploadStatus, initializeFromFile]);

  if (!documentState) return null;

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
        Step 2: Select Pages
      </h2>

      {/* Page selector input */}
      <div className="mb-6">
        <PageSelector
          pageCount={documentState.pageCount}
          selectionState={selectionState}
          onSelectionChange={updateSelection}
        />
      </div>

      {/* Thumbnail grid */}
      <div className="border-t pt-4">
        <p className="text-sm text-gray-500 mb-3">
          Click thumbnails to toggle selection, or use the text input above.
        </p>
        <ThumbnailGrid
          pageCount={documentState.pageCount}
          thumbnails={thumbnails}
          selectedPages={selectionState.selectedPages}
          onThumbnailClick={togglePage}
          onLoadThumbnails={loadThumbnails}
        />
      </div>
    </div>
  );
}

function UploadPage() {
  const { uploadState, documentState, uploadFile, clearError } = useUpload();
  const [showInstructions, setShowInstructions] = useState(true);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
          Blueprint Imager
        </h1>
        <p className="mt-2 text-sm sm:text-base text-gray-600">
          Convert PDF mechanical drawings to tiled images for YOLO training
        </p>
      </div>

      {/* Instructions */}
      {showInstructions && !documentState && (
        <div className="mb-6">
          <div className="flex justify-between items-start mb-2">
            <Instructions expanded />
            <button
              type="button"
              onClick={() => setShowInstructions(false)}
              className="text-gray-400 hover:text-gray-600 p-1"
              aria-label="Dismiss instructions"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Step 1: File Upload */}
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
          Step 1: Upload PDF
        </h2>
        <FileUpload
          uploadState={uploadState}
          onFileSelect={uploadFile}
          onClearError={clearError}
        />
      </div>

      {/* Step 2: Page Selection & Step 3: Processing */}
      {documentState && (
        <SelectionProvider pageCount={documentState.pageCount}>
          <ProcessingProvider>
            <PageSelectionSection />
            <ProcessingSection />
          </ProcessingProvider>
        </SelectionProvider>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <UploadProvider>
      <UploadPage />
    </UploadProvider>
  );
}
