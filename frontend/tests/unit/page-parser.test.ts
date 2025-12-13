import { describe, it, expect } from 'vitest';
import { parsePageSelection, formatPageSelection } from '../../src/lib/page-parser';

describe('parsePageSelection', () => {
  describe('valid inputs', () => {
    it('parses empty input', () => {
      const result = parsePageSelection('', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([]);
      expect(result.error).toBeNull();
    });

    it('parses single page', () => {
      const result = parsePageSelection('5', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([5]);
    });

    it('parses multiple individual pages', () => {
      const result = parsePageSelection('3, 7, 15', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([3, 7, 15]);
    });

    it('parses a range', () => {
      const result = parsePageSelection('1-5', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([1, 2, 3, 4, 5]);
    });

    it('parses combined ranges and individual pages', () => {
      const result = parsePageSelection('1-5, 8, 12-15', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([1, 2, 3, 4, 5, 8, 12, 13, 14, 15]);
    });

    it('deduplicates overlapping selections', () => {
      const result = parsePageSelection('1-5, 3, 4-7', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([1, 2, 3, 4, 5, 6, 7]);
    });

    it('handles whitespace', () => {
      const result = parsePageSelection('  1 - 5 ,  8  ', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([1, 2, 3, 4, 5, 8]);
    });

    it('handles single-page range', () => {
      const result = parsePageSelection('5-5', 50);
      expect(result.isValid).toBe(true);
      expect(result.pages).toEqual([5]);
    });
  });

  describe('invalid inputs', () => {
    it('rejects page exceeding document length', () => {
      const result = parsePageSelection('51', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('51');
      expect(result.error).toContain('50 pages');
    });

    it('rejects range exceeding document length', () => {
      const result = parsePageSelection('45-55', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('45-55');
      expect(result.error).toContain('50 pages');
    });

    it('rejects invalid range (start > end)', () => {
      const result = parsePageSelection('5-3', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('5-3');
      expect(result.error).toContain('less than or equal');
    });

    it('rejects non-numeric input', () => {
      const result = parsePageSelection('abc', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('abc');
      expect(result.error).toContain('not a valid page number');
    });

    it('rejects zero page number', () => {
      const result = parsePageSelection('0', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('1 or greater');
    });

    it('rejects negative page number', () => {
      const result = parsePageSelection('-1', 50);
      expect(result.isValid).toBe(false);
    });

    it('rejects malformed range', () => {
      const result = parsePageSelection('1-2-3', 50);
      expect(result.isValid).toBe(false);
      expect(result.error).toContain('Invalid range format');
    });
  });
});

describe('formatPageSelection', () => {
  it('formats empty array', () => {
    expect(formatPageSelection([])).toBe('');
  });

  it('formats single page', () => {
    expect(formatPageSelection([5])).toBe('5');
  });

  it('formats non-consecutive pages', () => {
    expect(formatPageSelection([3, 7, 15])).toBe('3, 7, 15');
  });

  it('formats consecutive pages as range', () => {
    expect(formatPageSelection([1, 2, 3, 4, 5])).toBe('1-5');
  });

  it('formats mixed consecutive and non-consecutive', () => {
    expect(formatPageSelection([1, 2, 3, 4, 5, 8, 12, 13, 14, 15])).toBe('1-5, 8, 12-15');
  });

  it('handles unsorted input', () => {
    expect(formatPageSelection([5, 3, 1, 4, 2])).toBe('1-5');
  });
});
