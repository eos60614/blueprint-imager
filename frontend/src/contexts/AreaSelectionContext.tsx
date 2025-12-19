'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from 'react';
import type { AreaSelection } from '@/types/area-selection';

interface AreaSelectionContextType {
  // State
  selections: Map<number, AreaSelection>;

  // Actions
  setSelection: (pageNum: number, selection: AreaSelection) => void;
  clearSelection: (pageNum: number) => void;
  clearAllSelections: () => void;
  getSelection: (pageNum: number) => AreaSelection | undefined;
  hasSelection: (pageNum: number) => boolean;

  // Derived
  getAllSelections: () => AreaSelection[];
}

const AreaSelectionContext = createContext<AreaSelectionContextType | null>(null);

export function useAreaSelection() {
  const context = useContext(AreaSelectionContext);
  if (!context) {
    throw new Error('useAreaSelection must be used within an AreaSelectionProvider');
  }
  return context;
}

interface AreaSelectionProviderProps {
  children: ReactNode;
}

export function AreaSelectionProvider({ children }: AreaSelectionProviderProps) {
  const [selections, setSelections] = useState<Map<number, AreaSelection>>(new Map());

  const setSelection = useCallback((pageNum: number, selection: AreaSelection) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.set(pageNum, selection);
      return next;
    });
  }, []);

  const clearSelection = useCallback((pageNum: number) => {
    setSelections((prev) => {
      const next = new Map(prev);
      next.delete(pageNum);
      return next;
    });
  }, []);

  const clearAllSelections = useCallback(() => {
    setSelections(new Map());
  }, []);

  const getSelection = useCallback(
    (pageNum: number) => {
      return selections.get(pageNum);
    },
    [selections]
  );

  const hasSelection = useCallback(
    (pageNum: number) => {
      return selections.has(pageNum);
    },
    [selections]
  );

  const getAllSelections = useCallback(() => {
    return Array.from(selections.values());
  }, [selections]);

  return (
    <AreaSelectionContext.Provider
      value={{
        selections,
        setSelection,
        clearSelection,
        clearAllSelections,
        getSelection,
        hasSelection,
        getAllSelections,
      }}
    >
      {children}
    </AreaSelectionContext.Provider>
  );
}
