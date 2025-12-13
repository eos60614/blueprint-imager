"""
Convert API endpoints for processing selected pages.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel, field_validator
from typing import List

from ..config import config
from ..db import get_db
from ..services import S3Client, PDFProcessor, ImageTiler
from ..services.job_service import (
    create_upload_job,
    update_job_status,
    update_page_status,
    get_upload_for_job,
    get_selected_pages,
    mark_job_completed,
    mark_job_failed,
)

router = APIRouter(prefix="/api/convert", tags=["Convert"])


class ConvertPagesRequest(BaseModel):
    uploadId: int
    selectedPages: List[int]

    @field_validator('selectedPages')
    @classmethod
    def validate_pages(cls, v: List[int]) -> List[int]:
        if not v:
            raise ValueError('At least one page must be selected')
        if any(p < 1 for p in v):
            raise ValueError('Page numbers must be 1 or greater')
        return sorted(set(v))  # Deduplicate and sort


class ConvertPagesResponse(BaseModel):
    jobId: int
    status: str
    totalPages: int


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

    # Create job
    try:
        job_id = create_upload_job(request.uploadId, request.selectedPages)
    except ValueError as e:
        raise HTTPException(status_code=400, detail={"error": "Invalid request", "message": str(e)})

    # Start background processing
    background_tasks.add_task(process_pages_job, job_id)

    return ConvertPagesResponse(
        jobId=job_id,
        status="processing",
        totalPages=len(request.selectedPages)
    )


def process_pages_job(job_id: int):
    """Background task to process PDF pages."""
    import tempfile
    import os
    from pathlib import Path

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

        s3_client = S3Client()
        processor = PDFProcessor(dpi=config.PDF_DPI)
        tiler = ImageTiler(tile_size=config.TILE_SIZE, overlap=config.TILE_OVERLAP)

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
                            dpi=config.PDF_DPI,
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

                        # Tile the page
                        tiles_dir = temp_path / f"tiles_page_{page_num}"
                        tiles_dir.mkdir(exist_ok=True)
                        tiles = tiler.tile_image(str(page_image_path), str(tiles_dir))

                        # Upload tiles to S3
                        for tile in tiles:
                            tile_path = Path(tile['file_path'])
                            s3_key = f"output/{job_id}/tiles/page_{page_num}_{tile_path.name}"
                            s3_client.upload_file(str(tile_path), s3_key, content_type='image/png')

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
