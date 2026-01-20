"""
Procore Browse API endpoints.
Provides read-only access to browse and process M-series drawings from external PostgreSQL database.
"""

import io
import logging
import tempfile
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/procore", tags=["Procore Browse"])


# Pydantic Response Models

class ProjectResponse(BaseModel):
    """Response model for a Procore project."""
    id: int
    name: str
    display_name: Optional[str] = None
    project_number: Optional[str] = None
    active: bool
    city: Optional[str] = None
    state_code: Optional[str] = None

    class Config:
        from_attributes = True


class ListProjectsResponse(BaseModel):
    """Response model for list of projects."""
    projects: List[ProjectResponse]
    total: int


class DrawingResponse(BaseModel):
    """Response model for a Procore drawing."""
    id: int
    project_id: int
    drawing_number: str
    title: Optional[str] = None
    discipline: Optional[str] = None
    drawing_area_name: Optional[str] = None
    revision_number: Optional[str] = None
    has_file: bool
    file_size: Optional[int] = None
    project_name: str
    project_number: Optional[str] = None

    class Config:
        from_attributes = True


class DrawingDetailResponse(DrawingResponse):
    """Response model for detailed drawing info."""
    s3_key: Optional[str] = None
    filename: Optional[str] = None


class ListDrawingsResponse(BaseModel):
    """Response model for paginated list of drawings."""
    drawings: List[DrawingResponse]
    total: int
    page: int
    limit: int
    has_more: bool


class ProcessDrawingsRequest(BaseModel):
    """Request model for processing drawings."""
    drawing_ids: List[int]
    dpi: int = 600
    tile_size: int = 1920
    overlap: int = 250
    no_tiles: bool = False  # If True, output single images instead of tiles

    @field_validator('drawing_ids')
    @classmethod
    def validate_drawing_ids(cls, v):
        if len(v) == 0:
            raise ValueError('At least one drawing must be selected')
        if len(v) > 10:
            raise ValueError('Maximum 10 drawings per batch')
        return v

    @field_validator('dpi')
    @classmethod
    def validate_dpi(cls, v):
        if v < 72 or v > 2400:
            raise ValueError('DPI must be between 72 and 2400')
        return v

    @field_validator('tile_size')
    @classmethod
    def validate_tile_size(cls, v):
        if v < 512 or v > 4096:
            raise ValueError('Tile size must be between 512 and 4096')
        return v

    @field_validator('overlap')
    @classmethod
    def validate_overlap(cls, v):
        if v < 0 or v > 500:
            raise ValueError('Overlap must be between 0 and 500')
        return v


class ProcessDrawingsResponse(BaseModel):
    """Response model for process drawings request."""
    job_id: int
    status: str
    total_drawings: int
    message: str


# Import database client
from src.services.procore_db_client import ProcoreDBClient
import psycopg2


@router.get("/projects", response_model=ListProjectsResponse)
async def list_projects():
    """
    List all active projects that have M-series drawings.

    Returns all active projects from the Procore database that contain
    at least one M-series (mechanical) drawing.
    """
    try:
        projects = ProcoreDBClient.list_projects()
        return ListProjectsResponse(
            projects=[
                ProjectResponse(
                    id=p.id,
                    name=p.name,
                    display_name=p.display_name,
                    project_number=p.project_number,
                    active=p.active,
                    city=p.city,
                    state_code=p.state_code
                )
                for p in projects
            ],
            total=len(projects)
        )
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Procore database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drawings", response_model=ListDrawingsResponse)
async def list_drawings(
    project_id: Optional[int] = Query(None, description="Filter by project ID"),
    search: Optional[str] = Query(None, max_length=200, description="Search drawing number or title"),
    page: int = Query(1, ge=1, description="Page number"),
    limit: int = Query(50, ge=1, le=100, description="Results per page")
):
    """
    List M-series drawings with optional filtering and pagination.

    Returns paginated list of M-series (mechanical) drawings. Can be filtered
    by project and searched by drawing number or title.
    """
    try:
        result = ProcoreDBClient.list_drawings(
            project_id=project_id,
            search=search,
            page=page,
            limit=limit
        )
        return ListDrawingsResponse(
            drawings=[
                DrawingResponse(
                    id=d.id,
                    project_id=d.project_id,
                    drawing_number=d.drawing_number,
                    title=d.title,
                    discipline=d.discipline,
                    drawing_area_name=d.drawing_area_name,
                    revision_number=d.revision_number,
                    has_file=d.has_file,
                    file_size=d.file_size,
                    project_name=d.project_name or "",
                    project_number=d.project_number
                )
                for d in result.drawings
            ],
            total=result.total,
            page=result.page,
            limit=result.limit,
            has_more=result.has_more
        )
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Procore database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error listing drawings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drawings/{drawing_id}", response_model=DrawingDetailResponse)
async def get_drawing(drawing_id: int):
    """
    Get details for a single drawing.

    Returns detailed information for a specific drawing including
    the current revision and S3 key for file access.
    """
    try:
        drawing = ProcoreDBClient.get_drawing(drawing_id)
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")

        return DrawingDetailResponse(
            id=drawing.id,
            project_id=drawing.project_id,
            drawing_number=drawing.drawing_number,
            title=drawing.title,
            discipline=drawing.discipline,
            drawing_area_name=drawing.drawing_area_name,
            revision_number=drawing.revision_number,
            has_file=drawing.has_file,
            file_size=drawing.file_size,
            project_name=drawing.project_name or "",
            project_number=drawing.project_number,
            s3_key=drawing.s3_key,
            filename=drawing.filename
        )
    except HTTPException:
        raise
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to Procore database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error getting drawing {drawing_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/process", response_model=ProcessDrawingsResponse, status_code=202)
async def process_drawings(
    request: ProcessDrawingsRequest,
    background_tasks: BackgroundTasks
):
    """
    Create a job to process selected drawings through the tile pipeline.

    Downloads PDFs from S3 and processes them through the existing conversion
    pipeline. Maximum 10 drawings per batch.
    """
    from src.services.job_service import create_procore_job, process_procore_drawings

    try:
        # Validate all drawings exist and have files
        valid, errors = ProcoreDBClient.validate_drawings_have_files(request.drawing_ids)
        if not valid:
            raise HTTPException(status_code=400, detail=errors[0])

        # Get drawings with S3 keys
        drawings = ProcoreDBClient.get_drawings_by_ids(request.drawing_ids)

        # Extract S3 keys in order matching drawing_ids
        drawing_map = {d.id: d for d in drawings}
        s3_keys = []
        for drawing_id in request.drawing_ids:
            drawing = drawing_map.get(drawing_id)
            if not drawing or not drawing.s3_key:
                raise HTTPException(
                    status_code=400,
                    detail=f"Drawing {drawing_id} does not have a file available"
                )
            s3_keys.append(drawing.s3_key)

        # Create the job
        job_id = create_procore_job(
            drawing_ids=request.drawing_ids,
            s3_keys=s3_keys,
            dpi=request.dpi,
            tile_size=request.tile_size,
            overlap=request.overlap,
            no_tiles=request.no_tiles
        )

        # Start background processing
        background_tasks.add_task(process_procore_drawings, job_id)

        return ProcessDrawingsResponse(
            job_id=job_id,
            status="processing",
            total_drawings=len(request.drawing_ids),
            message=f"Processing {len(request.drawing_ids)} drawings"
        )

    except HTTPException:
        raise
    except psycopg2.OperationalError as e:
        logger.error(f"Database connection error: {e}")
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Error processing drawings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


class PreviewInfoResponse(BaseModel):
    """Response model for preview info (dimensions at target DPI)."""
    width: int
    height: int
    dpi: int


@router.get("/drawings/{drawing_id}/preview")
async def get_drawing_preview(
    drawing_id: int,
    dpi: int = Query(72, ge=72, le=150, description="Preview DPI (72-150)")
):
    """
    Get a low-resolution preview image of a drawing.

    Returns a JPEG thumbnail of the first page at the specified DPI.
    Used for tile overlay visualization.
    """
    from pdf2image import convert_from_path
    from PIL import Image
    from src.services.s3_client import S3Client
    from src.config import config

    try:
        # Get drawing details
        drawing = ProcoreDBClient.get_drawing(drawing_id)
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")

        if not drawing.s3_key:
            raise HTTPException(status_code=400, detail="Drawing has no file available")

        # Initialize S3 client for Procore bucket
        # Prefer readonly bucket if configured, otherwise use main Procore bucket
        bucket_name = config.READONLY_PROCORE_S3_BUCKET or config.PROCORE_S3_BUCKET
        s3_client = S3Client(bucket_name=bucket_name)

        # Build the full S3 key with optional path prefix
        # Only prepend if the s3_key doesn't already start with the prefix
        s3_key = drawing.s3_key
        if config.READONLY_PROCORE_PATH and not s3_key.startswith(config.READONLY_PROCORE_PATH):
            s3_key = f"{config.READONLY_PROCORE_PATH}{s3_key}"

        # Download PDF to temp file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as tmp_pdf:
            s3_client.download_file(s3_key, tmp_pdf.name)

            # Convert first page to low-res image
            images = convert_from_path(
                tmp_pdf.name,
                dpi=dpi,
                fmt='jpeg',
                first_page=1,
                last_page=1
            )

            if not images:
                raise HTTPException(status_code=500, detail="Failed to render PDF")

            # Convert to JPEG bytes
            img = images[0]
            if img.mode != 'RGB':
                img = img.convert('RGB')

            img_buffer = io.BytesIO()
            img.save(img_buffer, format='JPEG', quality=80)
            img_buffer.seek(0)

            return StreamingResponse(
                img_buffer,
                media_type="image/jpeg",
                headers={
                    "X-Preview-Width": str(img.width),
                    "X-Preview-Height": str(img.height),
                    "X-Preview-DPI": str(dpi),
                    "Cache-Control": "public, max-age=3600"
                }
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating preview for drawing {drawing_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/drawings/{drawing_id}/dimensions", response_model=PreviewInfoResponse)
async def get_drawing_dimensions(
    drawing_id: int,
    dpi: int = Query(600, ge=72, le=2400, description="Target DPI for dimensions")
):
    """
    Get the dimensions of a drawing at the specified DPI.

    Returns the width and height in pixels that the drawing would be
    when rendered at the given DPI. Used for tile count calculations.
    """
    from pdf2image import convert_from_path
    from src.services.s3_client import S3Client
    from src.config import config

    try:
        # Get drawing details
        drawing = ProcoreDBClient.get_drawing(drawing_id)
        if not drawing:
            raise HTTPException(status_code=404, detail="Drawing not found")

        if not drawing.s3_key:
            raise HTTPException(status_code=400, detail="Drawing has no file available")

        # Initialize S3 client for Procore bucket
        # Prefer readonly bucket if configured, otherwise use main Procore bucket
        bucket_name = config.READONLY_PROCORE_S3_BUCKET or config.PROCORE_S3_BUCKET
        s3_client = S3Client(bucket_name=bucket_name)

        # Build the full S3 key with optional path prefix
        # Only prepend if the s3_key doesn't already start with the prefix
        s3_key = drawing.s3_key
        if config.READONLY_PROCORE_PATH and not s3_key.startswith(config.READONLY_PROCORE_PATH):
            s3_key = f"{config.READONLY_PROCORE_PATH}{s3_key}"

        # Download PDF to temp file
        with tempfile.NamedTemporaryFile(suffix='.pdf', delete=True) as tmp_pdf:
            s3_client.download_file(s3_key, tmp_pdf.name)

            # Convert first page at target DPI to get dimensions
            images = convert_from_path(
                tmp_pdf.name,
                dpi=dpi,
                fmt='png',
                first_page=1,
                last_page=1
            )

            if not images:
                raise HTTPException(status_code=500, detail="Failed to render PDF")

            img = images[0]

            return PreviewInfoResponse(
                width=img.width,
                height=img.height,
                dpi=dpi
            )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting dimensions for drawing {drawing_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
