"""
Upload API endpoints for the PDF upload frontend.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, field_validator
import tempfile
import os
from typing import Literal

from ..services import S3Client, PDFProcessor
from ..config import config
from ..db import get_db

router = APIRouter(prefix="/api/upload", tags=["Upload"])


# Request/Response models
class PresignedUrlRequest(BaseModel):
    fileName: str
    fileSize: int
    contentType: str

    @field_validator('contentType')
    @classmethod
    def validate_content_type(cls, v: str) -> str:
        if v != 'application/pdf':
            raise ValueError('Only PDF files are accepted')
        return v

    @field_validator('fileSize')
    @classmethod
    def validate_file_size(cls, v: int) -> int:
        if v <= 0:
            raise ValueError('File size must be greater than 0')
        if v > config.MAX_FILE_SIZE:
            max_mb = config.MAX_FILE_SIZE // (1024 * 1024)
            raise ValueError(f'Maximum file size is {max_mb}MB')
        return v


class PresignedUrlResponse(BaseModel):
    uploadUrl: str
    s3Key: str
    expiresIn: int


class UploadCompleteRequest(BaseModel):
    s3Key: str


class UploadCompleteResponse(BaseModel):
    uploadId: int
    pageCount: int
    status: Literal['ready']


class ErrorResponse(BaseModel):
    error: str
    message: str


@router.post("/presign", response_model=PresignedUrlResponse)
async def get_presigned_url(request: PresignedUrlRequest):
    """
    Generate a presigned URL for uploading a PDF directly to S3.
    The URL expires in 15 minutes.
    """
    try:
        s3_client = S3Client()
        result = s3_client.generate_presigned_upload_url(
            file_name=request.fileName,
            content_type=request.contentType,
            expires_in=900  # 15 minutes
        )

        return PresignedUrlResponse(
            uploadUrl=result['uploadUrl'],
            s3Key=result['s3Key'],
            expiresIn=result['expiresIn']
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail={"error": "S3 Error", "message": str(e)}
        )


@router.post("/complete", response_model=UploadCompleteResponse)
async def complete_upload(request: UploadCompleteRequest):
    """
    Called after successful S3 upload to register the document
    and retrieve page count.
    """
    s3_client = S3Client()

    # Verify the file exists in S3
    if not s3_client.check_object_exists(request.s3Key):
        raise HTTPException(
            status_code=404,
            detail={"error": "Not found", "message": "Uploaded file not found in S3"}
        )

    # Download to temp file to count pages
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_file:
        tmp_path = tmp_file.name

    try:
        s3_client.download_file(request.s3Key, tmp_path)

        # Get page count using PDFProcessor
        processor = PDFProcessor()
        try:
            pdf_info = processor.get_pdf_info(tmp_path)
            page_count = pdf_info.get('page_count', 0)
        except Exception as e:
            raise HTTPException(
                status_code=422,
                detail={"error": "Invalid PDF", "message": f"The uploaded file is not a valid PDF or has no pages: {str(e)}"}
            )

        if page_count == 0:
            raise HTTPException(
                status_code=422,
                detail={"error": "Invalid PDF", "message": "The uploaded file has no pages"}
            )

        # Get file size
        file_size = s3_client.get_object_size(request.s3Key)

        # Register in database
        with get_db() as conn:
            cursor = conn.cursor()

            cursor.execute('''
                INSERT INTO uploads (s3_bucket, s3_key, file_name, file_size, page_count, status)
                VALUES (%s, %s, %s, %s, %s, 'ready')
                RETURNING id
            ''', (
                s3_client.bucket_name,
                request.s3Key,
                request.s3Key.split('/')[-1],  # Extract filename from key
                file_size,
                page_count
            ))

            upload_id = cursor.fetchone()[0]

        return UploadCompleteResponse(
            uploadId=upload_id,
            pageCount=page_count,
            status='ready'
        )

    finally:
        # Clean up temp file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)
