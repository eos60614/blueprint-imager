"""
Tiles API endpoints for serving tiles from local storage.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from pathlib import Path

from ..config import config

router = APIRouter(prefix="/api/tiles", tags=["Tiles"])


@router.get("/{job_id}/{filename}")
async def get_tile(job_id: int, filename: str):
    """
    Serve a tile image from local storage.

    Tiles are stored at: LOCAL_TILE_STORAGE_PATH/{job_id}/tiles/{filename}
    """
    # Validate filename to prevent directory traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid filename", "message": "Invalid tile filename"}
        )

    # Only allow PNG files
    if not filename.endswith(".png") and not filename.endswith(".json"):
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid file type", "message": "Only PNG and JSON files are allowed"}
        )

    tile_path = Path(config.LOCAL_TILE_STORAGE_PATH) / str(job_id) / "tiles" / filename

    if not tile_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Tile {filename} not found for job {job_id}"}
        )

    # Determine media type
    media_type = "image/png" if filename.endswith(".png") else "application/json"

    return FileResponse(
        path=str(tile_path),
        media_type=media_type,
        filename=filename,
    )
