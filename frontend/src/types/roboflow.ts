/**
 * Types for Roboflow upload functionality.
 */

export interface TileSelection {
  pageNum: number;
  row: number;
  col: number;
}

export interface SplitCounts {
  train: number;
  valid: number;
  test: number;
}

export interface RoboflowUploadResult {
  total: number;
  successful: number;
  failed: number;
  errors: string[];
  splits: SplitCounts;
}

export interface RoboflowUploadRequest {
  jobId: number;
  tiles: TileSelection[];
}

export interface RoboflowStatus {
  configured: boolean;
  projectName: string | null;
}
