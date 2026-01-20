/**
 * TypeScript types for responsive layout feature.
 */

/**
 * Breakpoint sizes matching Tailwind defaults
 */
export type Breakpoint = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

/**
 * Layout configuration state
 */
export interface LayoutConfig {
  containerMaxWidth: string;  // CSS max-width value
  previewPanelHeight: string; // CSS height value (e.g., 'clamp(400px, 50vh, 800px)')
  thumbnailSize: 'sm' | 'md' | 'lg';
  showThumbnailColumn: boolean;
}

/**
 * Responsive layout state managed by useWindowSize hook
 */
export interface ResponsiveLayoutState {
  windowWidth: number;
  windowHeight: number;
  currentBreakpoint: Breakpoint;
  layoutConfig: LayoutConfig;
}

/**
 * Configuration for responsive preview panel sizing
 */
export interface PreviewPanelConfig {
  minHeight: number;   // Default: 400
  maxHeight: number;   // Default: 800
  viewportRatio: number;  // Default: 0.5 (50% of viewport)
}

/**
 * Breakpoint pixel values matching Tailwind defaults
 */
export const BREAKPOINT_VALUES: Record<Breakpoint, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};
