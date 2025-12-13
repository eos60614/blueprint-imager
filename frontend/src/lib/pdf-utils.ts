/**
 * PDF.js utilities for rendering PDF thumbnails.
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdf.js worker - use local worker file for reliability
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface ThumbnailOptions {
  scale?: number;
  maxWidth?: number;
  maxHeight?: number;
}

export interface RenderedThumbnail {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Load a PDF document from a URL or ArrayBuffer.
 */
export async function loadPdfDocument(
  source: string | ArrayBuffer
): Promise<pdfjsLib.PDFDocumentProxy> {
  const loadingTask = pdfjsLib.getDocument(source);
  return loadingTask.promise;
}

/**
 * Get the number of pages in a PDF document.
 */
export function getPageCount(pdf: pdfjsLib.PDFDocumentProxy): number {
  return pdf.numPages;
}

/**
 * Render a single page as a thumbnail.
 */
export async function renderThumbnail(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  options: ThumbnailOptions = {}
): Promise<RenderedThumbnail> {
  const { scale = 0.25, maxWidth = 200, maxHeight = 280 } = options;

  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });

  // Calculate scale to fit within max dimensions
  let targetScale = scale;
  if (viewport.width * scale > maxWidth) {
    targetScale = maxWidth / viewport.width;
  }
  if (viewport.height * targetScale > maxHeight) {
    targetScale = maxHeight / viewport.height;
  }

  const scaledViewport = page.getViewport({ scale: targetScale });

  // Create canvas
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Could not get 2D context from canvas');
  }

  canvas.width = scaledViewport.width;
  canvas.height = scaledViewport.height;

  // Render page to canvas
  await page.render({
    canvasContext: context,
    viewport: scaledViewport,
  }).promise;

  // Convert to data URL
  const dataUrl = canvas.toDataURL('image/png');

  return {
    pageNumber,
    dataUrl,
    width: scaledViewport.width,
    height: scaledViewport.height,
  };
}

/**
 * Render thumbnails for all pages in a PDF.
 * Yields results as they complete for progressive loading.
 */
export async function* renderAllThumbnails(
  pdf: pdfjsLib.PDFDocumentProxy,
  options: ThumbnailOptions = {}
): AsyncGenerator<RenderedThumbnail> {
  const numPages = pdf.numPages;

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    const thumbnail = await renderThumbnail(pdf, pageNum, options);
    yield thumbnail;
  }
}

/**
 * Render thumbnails for specific pages.
 */
export async function renderPageThumbnails(
  pdf: pdfjsLib.PDFDocumentProxy,
  pageNumbers: number[],
  options: ThumbnailOptions = {}
): Promise<RenderedThumbnail[]> {
  const thumbnails: RenderedThumbnail[] = [];

  for (const pageNum of pageNumbers) {
    if (pageNum >= 1 && pageNum <= pdf.numPages) {
      const thumbnail = await renderThumbnail(pdf, pageNum, options);
      thumbnails.push(thumbnail);
    }
  }

  return thumbnails;
}

/**
 * Create a PDF document from a File object.
 */
export async function loadPdfFromFile(
  file: File
): Promise<pdfjsLib.PDFDocumentProxy> {
  const arrayBuffer = await file.arrayBuffer();
  return loadPdfDocument(arrayBuffer);
}
