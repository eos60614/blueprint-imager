/**
 * File validation utilities.
 */

import { config } from './config';

export interface ValidationResult {
  valid: boolean;
  error: string | null;
}

/**
 * Validate that a file is a PDF.
 */
export function validateFileType(file: File): ValidationResult {
  if (!(config.allowedFileTypes as readonly string[]).includes(file.type)) {
    return {
      valid: false,
      error: 'Only PDF files are accepted. Please select a PDF file.',
    };
  }

  // Also check file extension as fallback
  const extension = file.name.toLowerCase().split('.').pop();
  if (extension !== 'pdf') {
    return {
      valid: false,
      error: 'Only PDF files are accepted. Please select a file with .pdf extension.',
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate that a file is within the size limit.
 */
export function validateFileSize(file: File): ValidationResult {
  if (file.size > config.maxFileSize) {
    const maxSizeMB = config.maxFileSize / (1024 * 1024);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File too large (${fileSizeMB}MB). Maximum file size is ${maxSizeMB}MB.`,
    };
  }

  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty. Please select a valid PDF file.',
    };
  }

  return { valid: true, error: null };
}

/**
 * Validate a file for upload.
 * Checks both file type and size.
 */
export function validateFile(file: File): ValidationResult {
  const typeResult = validateFileType(file);
  if (!typeResult.valid) {
    return typeResult;
  }

  const sizeResult = validateFileSize(file);
  if (!sizeResult.valid) {
    return sizeResult;
  }

  return { valid: true, error: null };
}
