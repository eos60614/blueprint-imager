"""
Jobs API endpoints for tracking conversion progress and downloading results.
Includes history browsing endpoints for viewing past uploads.
"""

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List
import io
import zipfile

from ..db import get_db
from ..services import S3Client
from ..services.job_service import (
    get_job_progress,
    get_jobs_by_ids,
    get_job_with_upload,
    get_job_pages,
    get_page_tiles,
    get_upload_for_job,
)

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobStatusResponse(BaseModel):
    jobId: int
    status: str
    progress: float
    processedPages: int
    totalPages: int
    errorMessage: Optional[str] = None
    downloadUrl: Optional[str] = None


# ============================================================
# History feature response models (T009-T013)
# ============================================================

class JobSummary(BaseModel):
    jobId: int
    status: str
    fileName: str
    uploadedAt: Optional[str] = None
    pageCount: Optional[int] = None
    selectedPages: Optional[List[int]] = None
    progress: Optional[float] = None


class JobListResponse(BaseModel):
    jobs: List[JobSummary]


class JobDetailsResponse(BaseModel):
    jobId: int
    status: str
    progress: float
    uploadId: Optional[int] = None
    fileName: str
    uploadedAt: Optional[str] = None
    totalPages: int
    selectedPages: List[int]
    processedPages: int
    dpi: int
    tileSize: int
    overlap: int
    errorMessage: Optional[str] = None
    downloadUrl: Optional[str] = None


class GridSize(BaseModel):
    rows: int
    cols: int


class PageInfo(BaseModel):
    pageNumber: int
    tileCount: int
    gridSize: GridSize


class JobPagesResponse(BaseModel):
    jobId: int
    pages: List[PageInfo]


class TileInfo(BaseModel):
    row: int
    col: int
    url: str
    width: Optional[int] = None
    height: Optional[int] = None
    isBlank: bool = False


class TileGridResponse(BaseModel):
    jobId: int
    pageNumber: int
    tiles: List[TileInfo]
    totalTiles: int
    gridSize: GridSize


class PdfUrlResponse(BaseModel):
    url: str
    expiresIn: int


class TileSelection(BaseModel):
    pageNum: int
    row: int
    col: int


class DownloadTilesRequest(BaseModel):
    tiles: List[TileSelection]


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: int):
    """
    Get the status of a conversion job.
    Poll this endpoint to track conversion progress.
    """
    job = get_job_progress(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job with ID {job_id} not found"}
        )

    response = JobStatusResponse(
        jobId=job['jobId'],
        status=job['status'],
        progress=job['progress'],
        processedPages=job['processedPages'],
        totalPages=job['totalPages'],
        errorMessage=job.get('errorMessage'),
    )

    # Add download URL if job is completed
    if job['status'] == 'completed':
        response.downloadUrl = f"/api/jobs/{job_id}/download"

    return response


@router.get("/{job_id}/download")
async def download_job_results(job_id: int):
    """
    Download job results as a ZIP file.
    Only available when job status is "completed".
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Verify job exists and is completed
        cursor.execute('SELECT status FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job with ID {job_id} not found"}
        )

    if row[0] != 'completed':
        raise HTTPException(
            status_code=400,
            detail={"error": "Not ready", "message": "Job is not yet completed"}
        )

    # Get tiles from S3 and create ZIP
    s3_client = S3Client()
    prefix = f"output/{job_id}/tiles/"

    try:
        objects = s3_client.list_objects(prefix)

        if not objects:
            raise HTTPException(
                status_code=404,
                detail={"error": "No tiles", "message": "No tiles found for this job"}
            )

        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for obj in objects:
                key = obj['Key']
                filename = key.replace(prefix, '')

                # Download file content
                response = s3_client.s3.get_object(
                    Bucket=s3_client.bucket_name,
                    Key=key
                )
                file_content = response['Body'].read()

                # Add to ZIP
                zip_file.writestr(f"tiles/{filename}", file_content)

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="job_{job_id}_tiles.zip"'
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "Download failed", "message": str(e)}
        )


@router.post("/{job_id}/download-tiles")
async def download_selected_tiles(job_id: int, request: DownloadTilesRequest):
    """
    Download selected tiles as a ZIP file.
    Accepts a list of tile selections (pageNum, row, col).
    """
    if not request.tiles:
        raise HTTPException(
            status_code=400,
            detail={"error": "No tiles selected", "message": "At least one tile must be selected"}
        )

    with get_db() as conn:
        cursor = conn.cursor()

        # Verify job exists
        cursor.execute('SELECT status FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job with ID {job_id} not found"}
        )

    if row[0] != 'completed':
        raise HTTPException(
            status_code=400,
            detail={"error": "Not ready", "message": "Job is not yet completed"}
        )

    # Get selected tiles from S3 and create ZIP
    s3_client = S3Client()

    try:
        # Create ZIP in memory
        zip_buffer = io.BytesIO()
        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
            for tile in request.tiles:
                # S3 key pattern: output/{job_id}/tiles/page_{page_num}_tile_{row}_{col}.png
                s3_key = f"output/{job_id}/tiles/page_{tile.pageNum}_tile_{tile.row}_{tile.col}.png"
                filename = f"page_{tile.pageNum}_tile_{tile.row}_{tile.col}.png"

                try:
                    # Download file content
                    response = s3_client.s3.get_object(
                        Bucket=s3_client.bucket_name,
                        Key=s3_key
                    )
                    file_content = response['Body'].read()

                    # Add to ZIP
                    zip_file.writestr(f"tiles/{filename}", file_content)
                except Exception:
                    # Skip tiles that don't exist
                    continue

        zip_buffer.seek(0)

        return StreamingResponse(
            zip_buffer,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="job_{job_id}_selected_tiles.zip"'
            }
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "Download failed", "message": str(e)}
        )


# ============================================================
# History feature endpoints (T009-T013)
# ============================================================

@router.get("", response_model=JobListResponse)
async def get_jobs_list(ids: str = Query(..., description="Comma-separated list of job IDs")):
    """
    Get multiple jobs by IDs.
    Used for history synchronization - batch fetch job statuses.
    """
    try:
        job_ids = [int(id.strip()) for id in ids.split(',') if id.strip()]
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid parameters", "message": "IDs must be comma-separated integers"}
        )

    if not job_ids:
        raise HTTPException(
            status_code=400,
            detail={"error": "Invalid parameters", "message": "At least one job ID is required"}
        )

    jobs = get_jobs_by_ids(job_ids)

    return JobListResponse(
        jobs=[
            JobSummary(
                jobId=j['jobId'],
                status=j['status'],
                fileName=j['fileName'],
                uploadedAt=j['uploadedAt'],
                pageCount=j.get('pageCount'),
                selectedPages=j.get('selectedPages'),
                progress=j.get('progress'),
            )
            for j in jobs
        ]
    )


@router.get("/{job_id}/details", response_model=JobDetailsResponse)
async def get_job_details(job_id: int):
    """
    Get detailed job information including upload data.
    Enhanced version of status endpoint for history view.
    """
    job = get_job_with_upload(job_id)

    if not job:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job with ID {job_id} not found"}
        )

    return JobDetailsResponse(
        jobId=job['jobId'],
        status=job['status'],
        progress=job['progress'],
        uploadId=job.get('uploadId'),
        fileName=job['fileName'],
        uploadedAt=job.get('uploadedAt'),
        totalPages=job['totalPages'],
        selectedPages=job['selectedPages'],
        processedPages=job['processedPages'],
        dpi=job['dpi'],
        tileSize=job['tileSize'],
        overlap=job['overlap'],
        errorMessage=job.get('errorMessage'),
        downloadUrl=job.get('downloadUrl'),
    )


@router.get("/{job_id}/pages", response_model=JobPagesResponse)
async def get_job_pages_endpoint(job_id: int):
    """
    Get processed pages for a job.
    Returns list of pages with tile counts and grid dimensions.
    """
    result = get_job_pages(job_id)

    if not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job with ID {job_id} not found"}
        )

    return JobPagesResponse(
        jobId=result['jobId'],
        pages=[
            PageInfo(
                pageNumber=p['pageNumber'],
                tileCount=p['tileCount'],
                gridSize=GridSize(
                    rows=p['gridSize']['rows'],
                    cols=p['gridSize']['cols'],
                ),
            )
            for p in result['pages']
        ]
    )


@router.get("/{job_id}/pages/{page_num}/tiles", response_model=TileGridResponse)
async def get_page_tiles_endpoint(job_id: int, page_num: int):
    """
    Get tiles for a specific page.
    Returns tile grid with presigned S3 URLs for each tile.
    Includes isBlank flag from tile metadata.
    """
    import json

    result = get_page_tiles(job_id, page_num)

    if not result:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"Job {job_id} page {page_num} not found"}
        )

    # Generate presigned URLs for tiles
    s3_client = S3Client()

    # Try to load tile metadata from S3 (includes is_blank)
    metadata_key = f"output/{job_id}/tiles/page_{page_num}_metadata.json"
    tile_metadata = {}
    try:
        metadata_bytes = s3_client.download_bytes(metadata_key)
        metadata_list = json.loads(metadata_bytes.decode('utf-8'))
        # Create lookup dict by row,col
        for m in metadata_list:
            tile_metadata[(m['row'], m['col'])] = m
    except Exception:
        # Metadata file doesn't exist (older jobs), continue without it
        pass

    tiles_with_urls = []

    for tile in result['tiles']:
        # S3 key pattern: output/{job_id}/tiles/page_{page_num}_tile_{row}_{col}.png
        s3_key = f"output/{job_id}/tiles/page_{page_num}_tile_{tile['row']}_{tile['col']}.png"
        try:
            url = s3_client.generate_presigned_download_url(s3_key, expires_in=3600)
        except Exception:
            # If tile doesn't exist, skip it
            continue

        # Get is_blank from metadata if available
        meta = tile_metadata.get((tile['row'], tile['col']), {})
        is_blank = meta.get('is_blank', False)

        tiles_with_urls.append(
            TileInfo(
                row=tile['row'],
                col=tile['col'],
                url=url,
                width=tile.get('width'),
                height=tile.get('height'),
                isBlank=is_blank,
            )
        )

    return TileGridResponse(
        jobId=result['jobId'],
        pageNumber=result['pageNumber'],
        tiles=tiles_with_urls,
        totalTiles=result['totalTiles'],
        gridSize=GridSize(
            rows=result['gridSize']['rows'],
            cols=result['gridSize']['cols'],
        ),
    )


@router.get("/{job_id}/pdf-url", response_model=PdfUrlResponse)
async def get_pdf_url(job_id: int):
    """
    Get presigned URL for the original PDF.
    Used for client-side thumbnail rendering.
    """
    upload = get_upload_for_job(job_id)

    if not upload:
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": f"PDF for job {job_id} not found"}
        )

    s3_client = S3Client()
    s3_key = upload['s3_key']

    # Check if PDF exists
    if not s3_client.check_object_exists(s3_key):
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": "PDF file no longer exists (may have expired)"}
        )

    expires_in = 3600  # 1 hour
    url = s3_client.generate_presigned_download_url(s3_key, expires_in=expires_in)

    return PdfUrlResponse(
        url=url,
        expiresIn=expires_in,
    )
