/**
 * localStorage wrapper for managing upload history.
 * Key: 'blueprint-imager-history'
 */

import type {
  HistoryEntry,
  HistoryStatus,
  CreateHistoryEntryInput,
} from '@/types/history';

// Re-export types for convenience
export type { CreateHistoryEntryInput } from '@/types/history';

const STORAGE_KEY = 'blueprint-imager-history';

/**
 * Get all history entries from localStorage.
 * Returns entries sorted by uploadedAt (most recent first).
 */
export function getHistoryEntries(): HistoryEntry[] {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return [];
    }

    const entries: HistoryEntry[] = JSON.parse(stored);

    // Sort by uploadedAt descending (most recent first)
    return entries.sort((a, b) => {
      return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime();
    });
  } catch (error) {
    console.error('Failed to parse history from localStorage:', error);
    return [];
  }
}

/**
 * Add a new history entry.
 * The entry is prepended to the list (most recent first).
 */
export function addHistoryEntry(input: CreateHistoryEntryInput): HistoryEntry {
  const now = new Date().toISOString();

  const entry: HistoryEntry = {
    jobId: input.jobId,
    uploadId: input.uploadId,
    fileName: input.fileName,
    uploadedAt: now,
    pageCount: input.pageCount,
    selectedPages: input.selectedPages,
    status: 'pending',
    lastSyncedAt: now,
    settings: input.settings,
  };

  const entries = getHistoryEntries();

  // Check if entry already exists (by jobId)
  const existingIndex = entries.findIndex((e) => e.jobId === input.jobId);
  if (existingIndex >= 0) {
    // Update existing entry
    entries[existingIndex] = entry;
  } else {
    // Add new entry at the beginning
    entries.unshift(entry);
  }

  saveHistoryEntries(entries);
  return entry;
}

/**
 * Update a history entry's status.
 */
export function updateHistoryEntryStatus(
  jobId: number,
  status: HistoryStatus
): HistoryEntry | null {
  const entries = getHistoryEntries();
  const index = entries.findIndex((e) => e.jobId === jobId);

  if (index < 0) {
    return null;
  }

  entries[index] = {
    ...entries[index],
    status,
    lastSyncedAt: new Date().toISOString(),
  };

  saveHistoryEntries(entries);
  return entries[index];
}

/**
 * Update multiple history entries with server data.
 * Used for syncing with backend.
 */
export function syncHistoryEntries(
  updates: Array<{ jobId: number; status: HistoryStatus }>
): void {
  const entries = getHistoryEntries();
  const now = new Date().toISOString();

  for (const update of updates) {
    const index = entries.findIndex((e) => e.jobId === update.jobId);
    if (index >= 0) {
      entries[index] = {
        ...entries[index],
        status: update.status,
        lastSyncedAt: now,
      };
    }
  }

  saveHistoryEntries(entries);
}

/**
 * Delete a history entry by jobId.
 * Only removes from localStorage; server files are retained.
 */
export function deleteHistoryEntry(jobId: number): boolean {
  const entries = getHistoryEntries();
  const index = entries.findIndex((e) => e.jobId === jobId);

  if (index < 0) {
    return false;
  }

  entries.splice(index, 1);
  saveHistoryEntries(entries);
  return true;
}

/**
 * Get a single history entry by jobId.
 */
export function getHistoryEntry(jobId: number): HistoryEntry | null {
  const entries = getHistoryEntries();
  return entries.find((e) => e.jobId === jobId) || null;
}

/**
 * Check if a history entry exists.
 */
export function hasHistoryEntry(jobId: number): boolean {
  const entries = getHistoryEntries();
  return entries.some((e) => e.jobId === jobId);
}

/**
 * Get the count of history entries.
 */
export function getHistoryCount(): number {
  return getHistoryEntries().length;
}

/**
 * Clear all history entries.
 */
export function clearHistory(): void {
  if (typeof window === 'undefined') {
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Get paginated history entries.
 * @param page - Page number (0-indexed)
 * @param pageSize - Number of items per page
 */
export function getHistoryEntriesPaginated(
  page: number,
  pageSize: number = 20
): {
  entries: HistoryEntry[];
  hasMore: boolean;
  total: number;
} {
  const allEntries = getHistoryEntries();
  const start = page * pageSize;
  const end = start + pageSize;

  return {
    entries: allEntries.slice(start, end),
    hasMore: end < allEntries.length,
    total: allEntries.length,
  };
}

/**
 * Internal: Save entries to localStorage.
 */
function saveHistoryEntries(entries: HistoryEntry[]): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.error('Failed to save history to localStorage:', error);
    // localStorage might be full - try to handle gracefully
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      // Remove oldest entries and try again
      const trimmedEntries = entries.slice(0, Math.floor(entries.length / 2));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmedEntries));
        console.warn('History trimmed due to storage quota exceeded');
      } catch {
        // If still failing, clear all
        localStorage.removeItem(STORAGE_KEY);
        console.error('Failed to save history, storage cleared');
      }
    }
  }
}
