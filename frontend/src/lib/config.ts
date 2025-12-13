/**
 * Environment configuration for the frontend.
 */

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  maxFileSize: 100 * 1024 * 1024, // 100MB in bytes
  allowedFileTypes: ['application/pdf'],
  presignedUrlExpiry: 900, // 15 minutes
} as const;
