"""
Convert API endpoints for processing selected pages.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, Field, field_validator
from typing import List, Optional

from ..config import config
from ..db import get_db
from ..services import S3Client, PDFProcessor, ImageTiler
from ..services.job_service import (
    create_upload_job,
    update_job_status,
    update_page_status,
    get_upload_for_job,
    get_selected_pages,
    get_job_settings,
    mark_job_completed,
    mark_job_failed,
)
from ..models.area_selection import AreaSelection
from ..services.tile_calculator import calculate_tiles_for_area, get_tile_set_for_area

router = APIRouter(prefix="/api/convert", tags=["Convert"])


# T005: AreaSelectionInput Pydantic model
class AreaSelectionInput(BaseModel):
    """Area selection input for a single page."""
    pageNum: int = Field(..., ge=1, description="1-indexed page number")
    x: int = Field(..., ge=0, description="Left edge in native DPI pixels")
    y: int = Field(..., ge=0, description="Top edge in native DPI pixels")
    width: int = Field(..., gt=0, description="Width in pixels")
    height: int = Field(..., gt=0, description="Height in pixels")


# T006: Extended ConvertPagesRequest with areaSelections
class ConvertPagesRequest(BaseModel):
    uploadId: int
    selectedPages: List[int]
    dpi: int = 600
    tileSize: int = 1920
    overlap: int = 250
    # NEW: Optional area selections per page
    areaSelections: Optional[List[AreaSelectionInput]] = None

    @field_validator('selectedPages')
    @classmethod
    def validate_pages(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError('At least one page must be selected')
        if any(p < 1 for p in v):
            raise ValueError('Page numbers must be 1 or greater')
        return sorted(set(v))  # Deduplicate and sort

    @field_validator('dpi')
    @classmethod
    def validate_dpi(cls, v: int) -> int:
        if v < 72 or v > 2400:
            raise ValueError('DPI must be between 72 and 2400')
        return v

    @field_validator('tileSize')
    @classmethod
    def validate_tile_size(cls, v: int) -> int:
        if v < 256 or v > 4096:
            raise ValueError('Tile size must be between 256 and 4096')
        return v

    @field_validator('overlap')
    @classmethod
    def validate_overlap(cls, v: int) -> int:
        if v < 0:
            raise ValueError('Overlap must be non-negative')
        return v


class ConvertPagesResponse(BaseModel):
    jobId: int
    status: str
    totalPages: int


# T023: Tile estimate request/response models
class TileEstimateAreaInput(BaseModel):
    """Optional area for tile estimation."""
    x: int = Field(..., ge=0)
    y: int = Field(..., ge=0)
    width: int = Field(..., gt=0)
    height: int = Field(..., gt=0)


class TileEstimateRequest(BaseModel):
    pageWidth: int = Field(..., gt=0)
    pageHeight: int = Field(..., gt=0)
    tileSize: int = Field(1920, ge=256, le=4096)
    overlap: int = Field(250, ge=0)
    areaSelection: Optional[TileEstimateAreaInput] = None


class TilePreview(BaseModel):
    row: int
    col: int
    x: int
    y: int


class TileEstimateResponse(BaseModel):
    rows: int
    cols: int
    total: int
    tiles: List[TilePreview]


@router.post("/pages", response_model=ConvertPagesResponse, status_code=202)
async def convert_pages(request: ConvertPagesRequest, background_tasks: BackgroundTasks):
    """
    Start a conversion job for specific pages from an uploaded PDF.
    Returns immediately with job ID; poll /api/jobs/{id} for progress.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Verify upload exists and is ready
        cursor.execute(
            'SELECT id, page_count, status FROM uploads WHERE id = %s',
            (request.uploadId,)
        )
        upload = cursor.fetchone()

    if not upload:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Upload with ID {request.uploadId} not found"}
        )

    if upload[2] != 'ready':
        raise HTTPException(
            status_code=400,
            detail={"error": "Not ready", "message": "Upload is not ready for processing"}
        )

    page_count = upload[1]

    # Validate page numbers against document
    invalid_pages = [p for p in request.selectedPages if p > page_count]
    if invalid_pages:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "Invalid pages",
                "message": f"Pages {invalid_pages} exceed document length ({page_count} pages)"
            }
        )

    # T007: Validate area selections
    area_selections_dict: dict = {}  # pageNum -> AreaSelection
    if request.areaSelections:
        for area_input in request.areaSelections:
            # Check pageNum is in selectedPages
            if area_input.pageNum not in request.selectedPages:
                raise HTTPException(
                    status_code=400,
                    detail={
                        "error": "Invalid area selection",
                        "message": f"Area selection references page {area_input.pageNum} which is not in selectedPages"
                    }
                )
            # Convert to AreaSelection model (last one wins if duplicates)
            area_selections_dict[area_input.pageNum] = AreaSelection(
                page_num=area_input.pageNum,
                x=area_input.x,
                y=area_input.y,
                width=area_input.width,
                height=area_input.height
            )

    # Create job with conversion settings
    try:
        job_id = create_upload_job(
            request.uploadId,
            request.selectedPages,
            dpi=request.dpi,
            tile_size=request.tileSize,
            overlap=request.overlap
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": "Invalid request", "message": str(e)})

    # T008: Start background processing with area selections
    background_tasks.add_task(process_pages_job, job_id, area_selections_dict)

    return ConvertPagesResponse(
        jobId=job_id,
        status="processing",
        totalPages=len(request.selectedPages)
    )


def process_pages_job(job_id: int, area_selections: dict = None):
    """Background task to process PDF pages.

    Tiles are saved to local storage (LOCAL_TILE_STORAGE_PATH/{job_id}/)
    instead of S3. S3 upload happens later when user sends to Roboflow.

    Args:
        job_id: The job ID to process
        area_selections: Optional dict mapping pageNum -> AreaSelection.
                        If provided, only tiles intersecting the area are generated.
    """
    import tempfile
    import os
    import json
    import shutil
    from pathlib import Path

    if area_selections is None:
        area_selections = {}

    try:
        update_job_status(job_id, 'processing')

        # Get upload info
        upload = get_upload_for_job(job_id)
        if not upload:
            mark_job_failed(job_id, "Upload not found")
            return

        selected_pages = get_selected_pages(job_id)
        if not selected_pages:
            mark_job_failed(job_id, "No pages selected")
            return

        # Get conversion settings for this job
        settings = get_job_settings(job_id)
        if not settings:
            mark_job_failed(job_id, "Job settings not found")
            return

        dpi = settings['dpi']
        tile_size = settings['tile_size']
        overlap = settings['overlap']

        s3_client = S3Client()
        processor = PDFProcessor(dpi=dpi)
        tiler = ImageTiler(tile_size=tile_size, overlap=overlap)

        # Create local storage directory for this job's tiles
        local_tiles_dir = Path(config.LOCAL_TILE_STORAGE_PATH) / str(job_id) / "tiles"
        local_tiles_dir.mkdir(parents=True, exist_ok=True)

        # Download PDF from S3
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
            pdf_path = tmp_pdf.name

        try:
            s3_client.download_file(upload['s3_key'], pdf_path)

            # Process each selected page
            with tempfile.TemporaryDirectory() as temp_dir:
                temp_path = Path(temp_dir)

                for page_num in selected_pages:
                    try:
                        update_page_status(job_id, page_num, 'processing')

                        # Convert single page to image
                        from pdf2image import convert_from_path
                        images = convert_from_path(
                            pdf_path,
                            dpi=dpi,
                            first_page=page_num,
                            last_page=page_num,
                            fmt='png'
                        )

                        if not images:
                            update_page_status(job_id, page_num, 'failed', error_message="No image generated")
                            continue

                        # Save page image
                        page_image_path = temp_path / f"page_{page_num}.png"
                        images[0].save(str(page_image_path), 'PNG', compress_level=0)

                        # Get page dimensions for area filtering
                        page_width, page_height = images[0].size

                        # T009: Check if this page has an area selection
                        area = area_selections.get(page_num)
                        tile_filter_set = None
                        if area:
                            # Clamp area to page bounds
                            area = area.clamp_to_bounds(page_width, page_height)
                            # Get set of (row, col) that intersect with area
                            tile_filter_set = get_tile_set_for_area(
                                area, page_width, page_height, tile_size, overlap
                            )

                        # Tile the page
                        tiles_dir = temp_path / f"tiles_page_{page_num}"
                        tiles_dir.mkdir(exist_ok=True)
                        all_tiles = tiler.tile_image(str(page_image_path), str(tiles_dir))

                        # Filter tiles if area selection exists
                        if tile_filter_set is not None:
                            tiles = [
                                t for t in all_tiles
                                if (t['row'], t['column']) in tile_filter_set
                            ]
                        else:
                            tiles = all_tiles

                        # Copy only filtered tiles to local storage
                        for tile in tiles:
                            tile_path = Path(tile['file_path'])
                            dest_path = local_tiles_dir / tile_path.name
                            shutil.copy2(str(tile_path), str(dest_path))

                        # Save tile metadata as JSON (only for filtered tiles)
                        tile_metadata = [
                            {
                                'row': t['row'],
                                'col': t['column'],
                                'is_blank': bool(t.get('is_blank', False)),
                                'width': int(t['width']),
                                'height': int(t['height']),
                            }
                            for t in tiles
                        ]
                        metadata_path = local_tiles_dir / f"page_{page_num}_metadata.json"
                        with open(metadata_path, 'w') as f:
                            json.dump(tile_metadata, f)

                        update_page_status(job_id, page_num, 'completed', tile_count=len(tiles))

                    except Exception as e:
                        update_page_status(job_id, page_num, 'failed', error_message=str(e))

            # Mark job as completed
            mark_job_completed(job_id)

        finally:
            if os.path.exists(pdf_path):
                os.unlink(pdf_path)

    except Exception as e:
        mark_job_failed(job_id, str(e))


# T024: Tile estimate endpoint
@router.post("/estimate-tiles", response_model=TileEstimateResponse)
async def estimate_tiles(request: TileEstimateRequest):
    """
    Estimate the number of tiles that would be generated for a page/area.

    Does not require an upload or job. Used for client-side preview.
    """
    from ..services.tile_calculator import calculate_tiles_for_area, calculate_grid_dimensions

    # Validate overlap < tileSize
    if request.overlap >= request.tileSize:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid settings", "message": "overlap must be less than tileSize"}
        )

    # Build area if provided
    area = None
    if request.areaSelection:
        area = AreaSelection(
            page_num=1,  # Not used in calculation, just for model
            x=request.areaSelection.x,
            y=request.areaSelection.y,
            width=request.areaSelection.width,
            height=request.areaSelection.height
        )
        # Clamp to page bounds
        area = area.clamp_to_bounds(request.pageWidth, request.pageHeight)

    # Calculate tiles
    tiles = calculate_tiles_for_area(
        page_width=request.pageWidth,
        page_height=request.pageHeight,
        area=area,
        tile_size=request.tileSize,
        overlap=request.overlap
    )

    # Get grid dimensions for response
    rows, cols, _ = calculate_grid_dimensions(
        request.pageWidth, request.pageHeight, request.tileSize, request.overlap
    )

    # If area is specified, adjust rows/cols to reflect actual tiles returned
    if area and tiles:
        actual_rows = max(t.row for t in tiles) - min(t.row for t in tiles) + 1
        actual_cols = max(t.col for t in tiles) - min(t.col for t in tiles) + 1
        rows = actual_rows
        cols = actual_cols

    return TileEstimateResponse(
        rows=rows,
        cols=cols,
        total=len(tiles),
        tiles=[
            TilePreview(row=t.row, col=t.col, x=t.x, y=t.y)
            for t in tiles
        ]
    )
