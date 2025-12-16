"""
Roboflow API endpoints for uploading tiles to Roboflow datasets.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from ..config import config
from ..services import S3Client, RoboflowClient

router = APIRouter(prefix="/api/roboflow", tags=["Roboflow"])


class TileSelection(BaseModel):
    pageNum: int
    row: int
    col: int


class UploadRequest(BaseModel):
    jobId: int
    tiles: List[TileSelection]


class SplitCounts(BaseModel):
    train: int
    valid: int
    test: int


class UploadResponse(BaseModel):
    total: int
    successful: int
    failed: int
    errors: List[str]
    splits: SplitCounts


@router.post("/upload", response_model=UploadResponse)
async def upload_tiles_to_roboflow(request: UploadRequest):
    """
    Upload selected tiles to Roboflow.

    Tiles are uploaded using presigned S3 URLs. Each tile is randomly
    assigned to a split (70% train, 20% valid, 10% test).

    Blank tiles (80%+ white) are automatically filtered out.

    Errors are logged but don't fail the entire upload - continues
    processing remaining tiles.
    """
    import json

    # Validate Roboflow is configured
    if not config.ROBOFLOW_API_KEY or not config.ROBOFLOW_PROJECT_NAME:
        raise HTTPException(
            status_code=503,
            detail={
                "error": "Roboflow not configured",
                "message": "ROBOFLOW_API_KEY and ROBOFLOW_PROJECT_NAME must be set"
            }
        )

    if not request.tiles:
        raise HTTPException(
            status_code=400,
            detail={"error": "No tiles", "message": "At least one tile must be selected"}
        )

    s3_client = S3Client()

    # Load tile metadata to check for blank tiles
    # Group tiles by page for efficient metadata loading
    tiles_by_page: dict[int, list] = {}
    for tile in request.tiles:
        if tile.pageNum not in tiles_by_page:
            tiles_by_page[tile.pageNum] = []
        tiles_by_page[tile.pageNum].append(tile)

    # Load metadata for each page
    page_metadata: dict[int, dict] = {}
    for page_num in tiles_by_page.keys():
        metadata_key = f"output/{request.jobId}/tiles/page_{page_num}_metadata.json"
        try:
            metadata_bytes = s3_client.download_bytes(metadata_key)
            metadata_list = json.loads(metadata_bytes.decode('utf-8'))
            # Create lookup dict by (row, col)
            page_metadata[page_num] = {
                (m['row'], m['col']): m for m in metadata_list
            }
        except Exception:
            # Metadata doesn't exist (older jobs), assume no blanks
            page_metadata[page_num] = {}

    # Build tile data with presigned URLs, filtering out blank tiles
    tiles_to_upload = []
    skipped_blank = 0

    for tile in request.tiles:
        # Check if tile is blank
        meta = page_metadata.get(tile.pageNum, {}).get((tile.row, tile.col), {})
        if meta.get('is_blank', False):
            skipped_blank += 1
            continue

        # S3 key pattern: output/{job_id}/tiles/page_{page_num}_tile_{row}_{col}.png
        s3_key = f"output/{request.jobId}/tiles/page_{tile.pageNum}_tile_{tile.row}_{tile.col}.png"

        # Check if tile exists
        if not s3_client.check_object_exists(s3_key):
            # Skip non-existent tiles but continue
            continue

        # Generate presigned URL (1 hour expiry)
        presigned_url = s3_client.generate_presigned_download_url(s3_key, expires_in=3600)

        # Image name for Roboflow
        image_name = f"job{request.jobId}_page{tile.pageNum}_tile{tile.row}_{tile.col}.png"

        tiles_to_upload.append({
            "presigned_url": presigned_url,
            "image_name": image_name,
        })

    if not tiles_to_upload:
        message = "None of the selected tiles exist in S3"
        if skipped_blank > 0:
            message = f"All {skipped_blank} selected tiles were blank and skipped"
        raise HTTPException(
            status_code=404,
            detail={"error": "No tiles found", "message": message}
        )

    # Upload to Roboflow
    try:
        roboflow_client = RoboflowClient()
        result = roboflow_client.upload_batch(tiles_to_upload)

        return UploadResponse(
            total=result["total"],
            successful=result["successful"],
            failed=result["failed"],
            errors=result["errors"],
            splits=SplitCounts(
                train=result["splits"]["train"],
                valid=result["splits"]["valid"],
                test=result["splits"]["test"],
            ),
        )

    except ValueError as e:
        raise HTTPException(
            status_code=503,
            detail={"error": "Roboflow configuration error", "message": str(e)}
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "Upload failed", "message": str(e)}
        )


@router.get("/status")
async def get_roboflow_status():
    """
    Check if Roboflow is configured and ready.
    """
    configured = bool(config.ROBOFLOW_API_KEY and config.ROBOFLOW_PROJECT_NAME)

    return {
        "configured": configured,
        "projectName": config.ROBOFLOW_PROJECT_NAME if configured else None,
    }
