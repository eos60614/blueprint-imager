"""
Job service for managing conversion jobs from the upload frontend.
"""

import json
from typing import List, Optional

from ..db import get_db


def create_upload_job(upload_id: int, selected_pages: List[int]) -> int:
    """
    Create a new conversion job for an upload with selected pages.
    Returns the job ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Get upload info
        cursor.execute('SELECT s3_key FROM uploads WHERE id = %s', (upload_id,))
        upload = cursor.fetchone()
        if not upload:
            raise ValueError(f"Upload {upload_id} not found")

        # Create job
        cursor.execute('''
            INSERT INTO jobs (project_id, status, source, upload_id, selected_pages, total_pages, processed_pages)
            VALUES (%s, 'pending', 'upload', %s, %s, %s, 0)
            RETURNING id
        ''', ('upload', upload_id, json.dumps(selected_pages), len(selected_pages)))

        job_id = cursor.fetchone()[0]

        # Create job_pages entries
        for page_num in selected_pages:
            cursor.execute('''
                INSERT INTO job_pages (job_id, page_number, status)
                VALUES (%s, %s, 'pending')
            ''', (job_id, page_num))

        # Update upload status
        cursor.execute('UPDATE uploads SET status = %s WHERE id = %s', ('processing', upload_id))

    return job_id


def update_job_status(job_id: int, status: str, error_message: Optional[str] = None) -> None:
    """Update the overall job status."""
    with get_db() as conn:
        cursor = conn.cursor()

        if error_message:
            cursor.execute('''
                UPDATE jobs SET status = %s, error_message = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (status, error_message, job_id))
        else:
            cursor.execute('''
                UPDATE jobs SET status = %s, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (status, job_id))


def update_page_status(
    job_id: int,
    page_number: int,
    status: str,
    tile_count: int = 0,
    error_message: Optional[str] = None
) -> None:
    """Update the status of a specific page within a job."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE job_pages
            SET status = %s, tile_count = %s, error_message = %s, updated_at = CURRENT_TIMESTAMP
            WHERE job_id = %s AND page_number = %s
        ''', (status, tile_count, error_message, job_id, page_number))

        # Update processed_pages count in job
        if status == 'completed':
            cursor.execute('''
                UPDATE jobs SET processed_pages = processed_pages + 1, updated_at = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (job_id,))


def get_job_progress(job_id: int) -> Optional[dict]:
    """
    Get the progress of a job including per-page status.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, status, total_pages, processed_pages, error_message, upload_id
            FROM jobs WHERE id = %s
        ''', (job_id,))
        job = cursor.fetchone()

        if not job:
            return None

        # Calculate progress
        total = job[2] or 1
        processed = job[3] or 0
        progress = (processed / total) * 100 if total > 0 else 0

        return {
            'jobId': job[0],
            'status': job[1],
            'progress': round(progress, 1),
            'processedPages': processed,
            'totalPages': total,
            'errorMessage': job[4],
            'uploadId': job[5],
        }


def mark_job_completed(job_id: int) -> None:
    """Mark a job as completed and update the upload status."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE jobs SET status = 'completed', updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (job_id,))

        # Get upload_id and update upload status
        cursor.execute('SELECT upload_id FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()
        if row and row[0]:
            cursor.execute('UPDATE uploads SET status = %s WHERE id = %s', ('completed', row[0]))


def mark_job_failed(job_id: int, error_message: str) -> None:
    """Mark a job as failed."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            UPDATE jobs SET status = 'failed', error_message = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        ''', (error_message, job_id))

        # Get upload_id and update upload status
        cursor.execute('SELECT upload_id FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()
        if row and row[0]:
            cursor.execute('UPDATE uploads SET status = %s WHERE id = %s', ('failed', row[0]))


def get_upload_for_job(job_id: int) -> Optional[dict]:
    """Get the upload associated with a job."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT u.id, u.s3_bucket, u.s3_key, u.file_name, u.page_count
            FROM uploads u
            JOIN jobs j ON j.upload_id = u.id
            WHERE j.id = %s
        ''', (job_id,))

        row = cursor.fetchone()

        if not row:
            return None

        return {
            'id': row[0],
            's3_bucket': row[1],
            's3_key': row[2],
            'file_name': row[3],
            'page_count': row[4],
        }


def get_selected_pages(job_id: int) -> List[int]:
    """Get the selected pages for a job."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('SELECT selected_pages FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()

        if not row or not row[0]:
            return []

        return json.loads(row[0])
