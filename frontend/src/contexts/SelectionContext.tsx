'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import type { PageSelectionState, ThumbnailState, DocumentState } from '@/types/state';
import { initialSelectionState } from '@/types/state';
import { parsePageSelection, formatPageSelection } from '@/lib/page-parser';
import { loadPdfFromFile, renderThumbnail } from '@/lib/pdf-utils';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface SelectionContextType {
  selectionState: PageSelectionState;
  thumbnails: Map<number, ThumbnailState>;
  updateSelection: (state: PageSelectionState) => void;
  togglePage: (pageNumber: number) => void;
  loadThumbnails: (pageNumbers: number[]) => Promise<void>;
  initializeFromFile: (file: File) => Promise<void>;
  reset: () => void;
}

const SelectionContext = createContext<SelectionContextType | null>(null);

export function useSelection() {
  const context = useContext(SelectionContext);
  if (!context) {
    throw new Error('useSelection must be used within a SelectionProvider');
  }
  return context;
}

interface SelectionProviderProps {
  children: ReactNode;
  pageCount: number;
}

export function SelectionProvider({ children, pageCount }: SelectionProviderProps) {
  const [selectionState, setSelectionState] =
    useState<PageSelectionState>(initialSelectionState);
  const [thumbnails, setThumbnails] = useState<Map<number, ThumbnailState>>(new Map());
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);

  const updateSelection = useCallback((state: PageSelectionState) => {
    setSelectionState(state);
  }, []);

  const togglePage = useCallback(
    (pageNumber: number) => {
      setSelectionState((prev) => {
        const currentPages = new Set(prev.selectedPages);

        if (currentPages.has(pageNumber)) {
          currentPages.delete(pageNumber);
        } else {
          currentPages.add(pageNumber);
        }

        const newPages = Array.from(currentPages).sort((a, b) => a - b);
        const newText = formatPageSelection(newPages);

        return {
          inputText: newText,
          selectedPages: newPages,
          isValid: true,
          validationError: null,
        };
      });
    },
    []
  );

  const loadThumbnails = useCallback(
    async (pageNumbers: number[]) => {
      if (!pdfDoc) return;

      for (const pageNum of pageNumbers) {
        if (thumbnails.has(pageNum)) continue;

        try {
          const thumbnail = await renderThumbnail(pdfDoc, pageNum, {
            maxWidth: 150,
            maxHeight: 200,
          });

          setThumbnails((prev) => {
            const next = new Map(prev);
            next.set(pageNum, {
              pageNumber: pageNum,
              dataUrl: thumbnail.dataUrl,
              width: thumbnail.width,
              height: thumbnail.height,
              loaded: true,
            });
            return next;
          });
        } catch (error) {
          console.error(`Failed to render thumbnail for page ${pageNum}:`, error);
        }
      }
    },
    [pdfDoc, thumbnails]
  );

  const initializeFromFile = useCallback(async (file: File) => {
    try {
      const doc = await loadPdfFromFile(file);
      setPdfDoc(doc);
    } catch (error) {
      console.error('Failed to load PDF:', error);
    }
  }, []);

  const reset = useCallback(() => {
    setSelectionState(initialSelectionState);
    setThumbnails(new Map());
    setPdfDoc(null);
  }, []);

  // Cleanup PDF document on unmount
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        pdfDoc.destroy();
      }
    };
  }, [pdfDoc]);

  return (
    <SelectionContext.Provider
      value={{
        selectionState,
        thumbnails,
        updateSelection,
        togglePage,
        loadThumbnails,
        initializeFromFile,
        reset,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}
