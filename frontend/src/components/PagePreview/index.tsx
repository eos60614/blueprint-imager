'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PagePreviewProps {
  pdfUrl: string;
  pageNumber: number;
  onClose: () => void;
}

export function PagePreview({ pdfUrl, pageNumber, onClose }: PagePreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Render page
  useEffect(() => {
    if (!pdfUrl || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        if (pageNumber > pdf.numPages) {
          setError(`Page ${pageNumber} not found`);
          return;
        }

        const page = await pdf.getPage(pageNumber);

        if (cancelled) return;

        // Calculate scale to fit in viewport with some padding
        const viewport = page.getViewport({ scale: 1 });
        const maxWidth = window.innerWidth * 0.9;
        const maxHeight = window.innerHeight * 0.85;
        const scaleX = maxWidth / viewport.width;
        const scaleY = maxHeight / viewport.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledViewport = page.getViewport({ scale });

        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        const context = canvas.getContext('2d');
        if (!context) return;

        await page.render({
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        setIsLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load page');
          setIsLoading(false);
        }
      }
    };

    renderPage();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl, pageNumber]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75"
      onClick={onClose}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
        aria-label="Close preview"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>

      {/* Page number indicator */}
      <div className="absolute top-4 left-4 text-white text-lg font-medium">
        Page {pageNumber}
      </div>

      {/* Content container */}
      <div
        className="relative max-w-[90vw] max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className={`block rounded shadow-2xl ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        />

        {/* Loading state */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800 rounded min-w-[200px] min-h-[200px]">
            <svg
              className="animate-spin h-8 w-8 text-white"
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
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-red-900 rounded text-white p-4 text-center min-w-[200px] min-h-[200px]">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
