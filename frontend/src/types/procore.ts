/**
 * TypeScript types for Procore browse feature.
 */

export interface ProcoreProject {
  id: number;
  name: string;
  displayName?: string;
  projectNumber?: string;
  active: boolean;
  city?: string;
  stateCode?: string;
}

export interface ProcoreDrawing {
  id: number;
  projectId: number;
  drawingNumber: string;
  title?: string;
  discipline?: string;
  drawingAreaName?: string;
  revisionNumber?: string;
  hasFile: boolean;
  fileSize?: number;
  projectName: string;
  projectNumber?: string;
}

export interface ProcoreDrawingDetail extends ProcoreDrawing {
  s3Key?: string;
  filename?: string;
}

export interface ListProjectsResponse {
  projects: ProcoreProject[];
  total: number;
}

export interface ListDrawingsResponse {
  drawings: ProcoreDrawing[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ProcessDrawingsRequest {
  drawingIds: number[];
  dpi?: number;
  tileSize?: number;
  overlap?: number;
  noTiles?: boolean;  // If true, output single images instead of tiles
}

export interface ProcessingSettings {
  dpi: number;
  tileSize: number;
  overlap: number;
  noTiles: boolean;
}

export interface ProcessDrawingsResponse {
  jobId: number;
  status: string;
  totalDrawings: number;
  message: string;
}

/**
 * State for a single drawing thumbnail in the browse list
 */
export interface DrawingThumbnailState {
  drawingId: number;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  imageUrl: string | null;
  error: string | null;
  width?: number;
  height?: number;
}

/**
 * Props for the DrawingThumbnail component
 */
export interface DrawingThumbnailProps {
  drawingId: number;
  hasFile: boolean;
  drawingNumber: string;  // For alt text
  onHover?: (drawingId: number | null) => void;
  size?: 'sm' | 'md' | 'lg';  // sm=60px, md=80px, lg=120px
}
