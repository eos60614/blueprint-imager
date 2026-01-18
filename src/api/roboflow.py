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

    This endpoint:
    1. Reads tiles from local storage
    2. Uploads them to S3
    3. Generates presigned URLs
    4. Sends to Roboflow

    Each tile is randomly assigned to a split (70% train, 20% valid, 10% test).
    Errors are logged but don't fail the entire upload - continues
    processing remaining tiles.
    """
    from pathlib import Path

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
    local_tiles_dir = Path(config.LOCAL_TILE_STORAGE_PATH) / str(request.jobId) / "tiles"

    # Upload tiles to S3 and generate presigned URLs
    tiles_to_upload = []
    uploaded_to_s3 = 0

    for tile in request.tiles:
        # Local tile path
        filename = f"page_{tile.pageNum}_tile_{tile.row}_{tile.col}.png"
        local_tile_path = local_tiles_dir / filename

        # Check if tile exists locally
        if not local_tile_path.exists():
            # Skip non-existent tiles but continue
            continue

        # S3 key pattern: output/{job_id}/tiles/page_{page_num}_tile_{row}_{col}.png
        s3_key = f"output/{request.jobId}/tiles/{filename}"

        # Upload tile to S3
        try:
            s3_client.upload_file(str(local_tile_path), s3_key, content_type='image/png')
            uploaded_to_s3 += 1
        except Exception as e:
            # Log error but continue with other tiles
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
        raise HTTPException(
            status_code=404,
            detail={"error": "No tiles found", "message": "None of the selected tiles exist locally"}
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
