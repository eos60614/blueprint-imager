'use client';

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

interface PageThumbnailProps {
  pdfUrl: string;
  pageNumber: number;
  width?: number;
  onClick?: () => void;
  isSelected?: boolean;
}

export function PageThumbnail({
  pdfUrl,
  pageNumber,
  width = 200,
  onClick,
  isSelected = false,
}: PageThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        const viewport = page.getViewport({ scale: 1 });
        const scale = width / viewport.width;
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
  }, [pdfUrl, pageNumber, width]);

  return (
    <div
      className={`
        relative cursor-pointer rounded-lg overflow-hidden transition-all
        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:shadow-lg'}
      `}
      onClick={onClick}
    >
      {/* Canvas for PDF rendering */}
      <canvas
        ref={canvasRef}
        className={`block ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
      />

      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
          <svg
            className="animate-spin h-6 w-6 text-gray-400"
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
        <div className="absolute inset-0 flex items-center justify-center bg-red-50 text-red-500 p-2 text-xs text-center">
          {error}
        </div>
      )}

      {/* Page number badge */}
      <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1.5 py-0.5 rounded">
        {pageNumber}
      </div>
    </div>
  );
}
