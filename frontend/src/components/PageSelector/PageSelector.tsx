'use client';

import { useCallback, useState, useEffect } from 'react';
import { ValidationError } from './ValidationError';
import { HelpText } from './HelpText';
import { parsePageSelection, formatPageSelection } from '@/lib/page-parser';
import type { PageSelectionState } from '@/types/state';

interface PageSelectorProps {
  pageCount: number;
  selectionState: PageSelectionState;
  onSelectionChange: (state: PageSelectionState) => void;
  disabled?: boolean;
}

export function PageSelector({
  pageCount,
  selectionState,
  onSelectionChange,
  disabled = false,
}: PageSelectorProps) {
  const [inputValue, setInputValue] = useState(selectionState.inputText);

  // Sync with external state changes (e.g., thumbnail clicks)
  useEffect(() => {
    if (selectionState.inputText !== inputValue) {
      setInputValue(selectionState.inputText);
    }
  }, [selectionState.inputText]);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setInputValue(value);

      // Parse and validate
      const result = parsePageSelection(value, pageCount);

      onSelectionChange({
        inputText: value,
        selectedPages: result.pages,
        isValid: result.isValid,
        validationError: result.error,
      });
    },
    [pageCount, onSelectionChange]
  );

  const handleSelectAll = useCallback(() => {
    const allPages = Array.from({ length: pageCount }, (_, i) => i + 1);
    const text = formatPageSelection(allPages);
    setInputValue(text);
    onSelectionChange({
      inputText: text,
      selectedPages: allPages,
      isValid: true,
      validationError: null,
    });
  }, [pageCount, onSelectionChange]);

  const handleClear = useCallback(() => {
    setInputValue('');
    onSelectionChange({
      inputText: '',
      selectedPages: [],
      isValid: true,
      validationError: null,
    });
  }, [onSelectionChange]);

  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <div className="flex-1">
          <label
            htmlFor="page-selection"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Pages to convert
          </label>
          <input
            id="page-selection"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            disabled={disabled}
            placeholder={`e.g., 1-${Math.min(10, pageCount)}, ${Math.min(15, pageCount)}`}
            className={`
              w-full px-3 py-2 border rounded-lg shadow-sm
              focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              disabled:bg-gray-100 disabled:cursor-not-allowed
              ${selectionState.validationError
                ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300'
              }
            `}
          />
          {selectionState.validationError && (
            <ValidationError message={selectionState.validationError} />
          )}
        </div>
        <div className="flex items-end gap-2">
          <button
            onClick={handleSelectAll}
            disabled={disabled}
            className="px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Select All
          </button>
          <button
            onClick={handleClear}
            disabled={disabled || selectionState.selectedPages.length === 0}
            className="px-3 py-2 text-sm font-medium text-gray-600 hover:text-gray-700 hover:bg-gray-100 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Clear
          </button>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <HelpText />
        <div className="text-sm text-gray-600">
          {selectionState.selectedPages.length > 0 ? (
            <span>
              <span className="font-medium">{selectionState.selectedPages.length}</span>
              {' '}of {pageCount} pages selected
            </span>
          ) : (
            <span className="text-gray-400">No pages selected</span>
          )}
        </div>
      </div>
    </div>
  );
}
