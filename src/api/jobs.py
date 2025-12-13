"""
Jobs API endpoints for tracking conversion progress and downloading results.
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
import io
import zipfile

from ..db import get_db
from ..services import S3Client
from ..services.job_service import get_job_progress

router = APIRouter(prefix="/api/jobs", tags=["Jobs"])


class JobStatusResponse(BaseModel):
    jobId: int
    status: str
    progress: float
    processedPages: int
    totalPages: int
    errorMessage: Optional[str] = None
    downloadUrl: Optional[str] = None


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
