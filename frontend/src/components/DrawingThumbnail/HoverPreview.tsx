'use client';

import { useEffect, useRef } from 'react';

interface HoverPreviewProps {
  imageUrl: string;
  drawingNumber: string;
  isVisible: boolean;
  onClose: () => void;
}

export function HoverPreview({
  imageUrl,
  drawingNumber,
  isVisible,
  onClose,
}: HoverPreviewProps) {
  const previewRef = useRef<HTMLDivElement>(null);

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  return (
    <div
      ref={previewRef}
      className="absolute z-50 left-full ml-2 top-0 bg-white rounded-lg shadow-xl border border-gray-200 p-2 pointer-events-none"
      role="tooltip"
      aria-label={`Enlarged preview of drawing ${drawingNumber}`}
    >
      <img
        src={imageUrl}
        alt={`Enlarged preview of drawing ${drawingNumber}`}
        className="max-w-64 max-h-64 w-auto h-auto object-contain"
        style={{ minWidth: '200px', minHeight: '150px' }}
      />
    </div>
  );
}
