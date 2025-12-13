/**
 * Page range parser for selecting PDF pages.
 * Supports formats like: "1-5", "3, 7, 15", "1-5, 8, 12-15"
 */

export interface ParseResult {
  pages: number[];
  isValid: boolean;
  error: string | null;
}

/**
 * Parse a page selection string into an array of page numbers.
 *
 * @param input - The input string (e.g., "1-5, 8, 12-15")
 * @param totalPages - The total number of pages in the document
 * @returns ParseResult with parsed pages or error message
 */
export function parsePageSelection(input: string, totalPages: number): ParseResult {
  // Handle empty input
  if (!input || input.trim() === '') {
    return {
      pages: [],
      isValid: true,
      error: null,
    };
  }

  const trimmedInput = input.trim();
  const pages: Set<number> = new Set();
  const invalidPages: number[] = [];

  // Split by comma and process each segment
  const segments = trimmedInput.split(',').map((s) => s.trim()).filter((s) => s !== '');

  for (const segment of segments) {
    // Check if it's a range (contains hyphen)
    if (segment.includes('-')) {
      const rangeResult = parseRange(segment, totalPages);
      if (!rangeResult.isValid) {
        return rangeResult;
      }
      rangeResult.pages.forEach((p) => pages.add(p));
    } else {
      // Single page number
      const pageNum = parseInt(segment, 10);

      if (isNaN(pageNum)) {
        return {
          pages: [],
          isValid: false,
          error: `Invalid format: "${segment}" is not a valid page number. Use numbers and ranges like "1-5, 8, 12-15".`,
        };
      }

      if (pageNum < 1) {
        return {
          pages: [],
          isValid: false,
          error: `Invalid page number: ${pageNum}. Page numbers must be 1 or greater.`,
        };
      }

      if (pageNum > totalPages) {
        invalidPages.push(pageNum);
      } else {
        pages.add(pageNum);
      }
    }
  }

  // Report invalid pages
  if (invalidPages.length > 0) {
    return {
      pages: [],
      isValid: false,
      error: `Page${invalidPages.length > 1 ? 's' : ''} ${invalidPages.join(', ')} exceed${invalidPages.length === 1 ? 's' : ''} document length (${totalPages} pages).`,
    };
  }

  // Convert to sorted array
  const sortedPages = Array.from(pages).sort((a, b) => a - b);

  return {
    pages: sortedPages,
    isValid: true,
    error: null,
  };
}

/**
 * Parse a range segment (e.g., "1-5", "12-15").
 */
function parseRange(segment: string, totalPages: number): ParseResult {
  const parts = segment.split('-').map((s) => s.trim());

  if (parts.length !== 2) {
    return {
      pages: [],
      isValid: false,
      error: `Invalid range format: "${segment}". Use format like "1-5".`,
    };
  }

  const start = parseInt(parts[0], 10);
  const end = parseInt(parts[1], 10);

  if (isNaN(start) || isNaN(end)) {
    return {
      pages: [],
      isValid: false,
      error: `Invalid range: "${segment}". Both values must be numbers.`,
    };
  }

  if (start < 1) {
    return {
      pages: [],
      isValid: false,
      error: `Invalid range start: ${start}. Page numbers must be 1 or greater.`,
    };
  }

  if (start > end) {
    return {
      pages: [],
      isValid: false,
      error: `Invalid range: ${start}-${end}. Start must be less than or equal to end.`,
    };
  }

  // Check for out-of-bounds pages
  if (end > totalPages) {
    return {
      pages: [],
      isValid: false,
      error: `Range ${start}-${end} exceeds document length (${totalPages} pages).`,
    };
  }

  // Generate pages in range
  const pages: number[] = [];
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return {
    pages,
    isValid: true,
    error: null,
  };
}

/**
 * Format a page selection array back to a string.
 * Useful for display purposes.
 */
export function formatPageSelection(pages: number[]): string {
  if (pages.length === 0) return '';

  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let rangeStart = sorted[0];
  let rangeEnd = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === rangeEnd + 1) {
      rangeEnd = sorted[i];
    } else {
      // End current range
      ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);
      rangeStart = sorted[i];
      rangeEnd = sorted[i];
    }
  }

  // Add final range
  ranges.push(rangeStart === rangeEnd ? `${rangeStart}` : `${rangeStart}-${rangeEnd}`);

  return ranges.join(', ');
}
