'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Breakpoint, LayoutConfig, ResponsiveLayoutState } from '@/types/layout';
import { BREAKPOINT_VALUES } from '@/types/layout';

/**
 * Calculate the current breakpoint based on window width
 */
function getBreakpoint(width: number): Breakpoint {
  if (width >= BREAKPOINT_VALUES['2xl']) return '2xl';
  if (width >= BREAKPOINT_VALUES.xl) return 'xl';
  if (width >= BREAKPOINT_VALUES.lg) return 'lg';
  if (width >= BREAKPOINT_VALUES.md) return 'md';
  return 'sm';
}

/**
 * Generate layout configuration based on current breakpoint
 */
function getLayoutConfig(breakpoint: Breakpoint, windowHeight: number): LayoutConfig {
  // Calculate dynamic preview panel height based on viewport
  const baseHeight = Math.max(400, Math.min(800, windowHeight * 0.5 - 128));
  const previewPanelHeight = `${Math.round(baseHeight)}px`;

  switch (breakpoint) {
    case '2xl':
      return {
        containerMaxWidth: '1920px',
        previewPanelHeight,
        thumbnailSize: 'lg',
        showThumbnailColumn: true,
      };
    case 'xl':
      return {
        containerMaxWidth: '1280px',
        previewPanelHeight,
        thumbnailSize: 'md',
        showThumbnailColumn: true,
      };
    case 'lg':
      return {
        containerMaxWidth: '1024px',
        previewPanelHeight,
        thumbnailSize: 'md',
        showThumbnailColumn: true,
      };
    case 'md':
      return {
        containerMaxWidth: '768px',
        previewPanelHeight: '400px',
        thumbnailSize: 'sm',
        showThumbnailColumn: true,
      };
    case 'sm':
    default:
      return {
        containerMaxWidth: '100%',
        previewPanelHeight: '300px',
        thumbnailSize: 'sm',
        showThumbnailColumn: false,
      };
  }
}

// Default values used for both SSR and initial client render to avoid hydration mismatch
const DEFAULT_WIDTH = 1024;
const DEFAULT_HEIGHT = 768;

/**
 * Hook to track window size with debouncing and provide responsive layout state
 * @param debounceMs - Debounce delay in milliseconds (default: 100)
 */
export function useWindowSize(debounceMs: number = 100): ResponsiveLayoutState {
  // Always initialize with fixed defaults to avoid hydration mismatch
  const [windowWidth, setWindowWidth] = useState(DEFAULT_WIDTH);
  const [windowHeight, setWindowHeight] = useState(DEFAULT_HEIGHT);

  useEffect(() => {
    // Only read window size after mount (client-side only)
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      setWindowHeight(window.innerHeight);
    };

    // Set initial values on mount
    handleResize();

    // Debounced resize handler
    let timeoutId: NodeJS.Timeout;
    const debouncedResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleResize, debounceMs);
    };

    window.addEventListener('resize', debouncedResize);

    return () => {
      window.removeEventListener('resize', debouncedResize);
      clearTimeout(timeoutId);
    };
  }, [debounceMs]);

  const currentBreakpoint = useMemo(() => getBreakpoint(windowWidth), [windowWidth]);
  const layoutConfig = useMemo(
    () => getLayoutConfig(currentBreakpoint, windowHeight),
    [currentBreakpoint, windowHeight]
  );

  return {
    windowWidth,
    windowHeight,
    currentBreakpoint,
    layoutConfig,
  };
}
