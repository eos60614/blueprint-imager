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
