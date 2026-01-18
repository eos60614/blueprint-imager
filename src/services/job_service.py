"""
Job service for managing conversion jobs from the upload frontend.
"""

import json
import logging
import tempfile
from pathlib import Path
from typing import List, Optional

from ..db import get_db
from ..config import config

logger = logging.getLogger(__name__)


def create_upload_job(
    upload_id: int,
    selected_pages: List[int],
    dpi: int = 600,
    tile_size: int = 1920,
    overlap: int = 250
) -> int:
    """
    Create a new conversion job for an upload with selected pages and settings.
    Returns the job ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Get upload info
        cursor.execute('SELECT s3_key FROM uploads WHERE id = %s', (upload_id,))
        upload = cursor.fetchone()
        if not upload:
            raise ValueError(f"Upload {upload_id} not found")

        # Create job with conversion settings
        cursor.execute('''
            INSERT INTO jobs (project_id, status, source, upload_id, selected_pages, total_pages, processed_pages, dpi, tile_size, overlap)
            VALUES (%s, 'pending', 'upload', %s, %s, %s, 0, %s, %s, %s)
            RETURNING id
        ''', ('upload', upload_id, json.dumps(selected_pages), len(selected_pages), dpi, tile_size, overlap))

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


def get_job_settings(job_id: int) -> Optional[dict]:
    """Get the conversion settings for a job."""
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('SELECT dpi, tile_size, overlap FROM jobs WHERE id = %s', (job_id,))
        row = cursor.fetchone()

        if not row:
            return None

        return {
            'dpi': row[0] or 600,
            'tile_size': row[1] or 1920,
            'overlap': row[2] or 250,
        }


# ============================================================
# History feature functions (T005-T008)
# ============================================================

def get_jobs_by_ids(job_ids: List[int]) -> List[dict]:
    """
    Fetch multiple jobs by ID for history synchronization.
    Returns list of job summaries. Missing IDs are omitted from results.
    """
    if not job_ids:
        return []

    with get_db() as conn:
        cursor = conn.cursor()

        # Use parameterized query with IN clause
        placeholders = ', '.join(['%s'] * len(job_ids))
        cursor.execute(f'''
            SELECT j.id, j.status, j.total_pages, j.processed_pages, j.selected_pages,
                   j.created_at, u.file_name, u.page_count
            FROM jobs j
            LEFT JOIN uploads u ON j.upload_id = u.id
            WHERE j.id IN ({placeholders})
        ''', tuple(job_ids))

        rows = cursor.fetchall()

    jobs = []
    for row in rows:
        total = row[2] or 1
        processed = row[3] or 0
        progress = (processed / total) * 100 if total > 0 else 0

        selected_pages = []
        if row[4]:
            selected_pages = json.loads(row[4])

        jobs.append({
            'jobId': row[0],
            'status': row[1],
            'fileName': row[6] or 'Unknown',
            'uploadedAt': row[5].isoformat() if row[5] else None,
            'pageCount': row[7],
            'selectedPages': selected_pages,
            'progress': round(progress, 1),
        })

    return jobs


def get_job_with_upload(job_id: int) -> Optional[dict]:
    """
    Get job with joined upload data for detail view.
    Returns complete job details including upload info.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT j.id, j.status, j.total_pages, j.processed_pages, j.selected_pages,
                   j.error_message, j.dpi, j.tile_size, j.overlap, j.created_at,
                   j.upload_id, u.file_name, u.page_count, u.s3_key, u.s3_bucket
            FROM jobs j
            LEFT JOIN uploads u ON j.upload_id = u.id
            WHERE j.id = %s
        ''', (job_id,))

        row = cursor.fetchone()

    if not row:
        return None

    total = row[2] or 1
    processed = row[3] or 0
    progress = (processed / total) * 100 if total > 0 else 0

    selected_pages = []
    if row[4]:
        selected_pages = json.loads(row[4])

    result = {
        'jobId': row[0],
        'status': row[1],
        'progress': round(progress, 1),
        'uploadId': row[10],
        'fileName': row[11] or 'Unknown',
        'uploadedAt': row[9].isoformat() if row[9] else None,
        'totalPages': row[12] or 0,
        'selectedPages': selected_pages,
        'processedPages': processed,
        'dpi': row[6] or 600,
        'tileSize': row[7] or 1920,
        'overlap': row[8] or 250,
        'errorMessage': row[5],
        's3Key': row[13],
        's3Bucket': row[14],
    }

    # Add download URL if completed
    if row[1] == 'completed':
        result['downloadUrl'] = f'/api/jobs/{job_id}/download'

    return result


def get_job_pages(job_id: int) -> Optional[dict]:
    """
    Get page info for a job.
    Returns list of pages with tile counts and grid dimensions.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # First verify job exists
        cursor.execute('SELECT id, tile_size, dpi FROM jobs WHERE id = %s', (job_id,))
        job = cursor.fetchone()

        if not job:
            return None

        tile_size = job[1] or 1920

        # Get all pages for this job
        cursor.execute('''
            SELECT page_number, tile_count, status
            FROM job_pages
            WHERE job_id = %s
            ORDER BY page_number
        ''', (job_id,))

        rows = cursor.fetchall()

    pages = []
    for row in rows:
        page_number = row[0]
        tile_count = row[1] or 0

        # Calculate grid dimensions from tile count
        # Assuming square-ish grid, estimate rows and cols
        if tile_count > 0:
            cols = int(tile_count ** 0.5)
            if cols == 0:
                cols = 1
            rows = (tile_count + cols - 1) // cols
        else:
            rows = 0
            cols = 0

        pages.append({
            'pageNumber': page_number,
            'tileCount': tile_count,
            'gridSize': {
                'rows': rows,
                'cols': cols,
            },
        })

    return {
        'jobId': job_id,
        'pages': pages,
    }


def get_page_tiles(job_id: int, page_num: int) -> Optional[dict]:
    """
    Get tile info for a specific page.
    Returns tile grid with metadata. URLs are generated by the API layer.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # First verify job and page exist
        cursor.execute('''
            SELECT jp.tile_count, j.tile_size
            FROM job_pages jp
            JOIN jobs j ON jp.job_id = j.id
            WHERE jp.job_id = %s AND jp.page_number = %s
        ''', (job_id, page_num))

        row = cursor.fetchone()

    if not row:
        return None

    tile_count = row[0] or 0
    tile_size = row[1] or 1920

    # Calculate grid dimensions
    if tile_count > 0:
        cols = int(tile_count ** 0.5)
        if cols == 0:
            cols = 1
        rows = (tile_count + cols - 1) // cols
    else:
        rows = 0
        cols = 0

    # Generate tile metadata (without URLs - that's done in API layer with S3 presigned URLs)
    tiles = []
    tile_idx = 0
    for r in range(rows):
        for c in range(cols):
            if tile_idx >= tile_count:
                break
            tiles.append({
                'row': r,
                'col': c,
                'width': tile_size,
                'height': tile_size,
            })
            tile_idx += 1

    return {
        'jobId': job_id,
        'pageNumber': page_num,
        'tiles': tiles,
        'totalTiles': tile_count,
        'gridSize': {
            'rows': rows,
            'cols': cols,
        },
    }


# ============================================================
# Procore Drawing Processing (T030, T031)
# ============================================================

def create_procore_job(
    drawing_ids: List[int],
    s3_keys: List[str],
    dpi: int = 600,
    tile_size: int = 1920,
    overlap: int = 250,
    no_tiles: bool = False
) -> int:
    """
    Create a new conversion job for Procore drawings.

    Args:
        drawing_ids: List of Procore drawing IDs.
        s3_keys: List of S3 keys for the drawing files.
        dpi: DPI for PDF conversion.
        tile_size: Size of output tiles.
        overlap: Overlap between tiles.
        no_tiles: If True, output single images instead of tiles.

    Returns:
        Job ID.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # Store settings including no_tiles flag in procore_s3_keys JSON
        job_settings = {
            's3_keys': s3_keys,
            'no_tiles': no_tiles
        }

        # Create job with procore source
        cursor.execute('''
            INSERT INTO jobs (
                project_id, status, source, total_pages, processed_pages,
                dpi, tile_size, overlap, procore_drawing_ids, procore_s3_keys
            )
            VALUES ('procore', 'processing', 'procore', %s, 0, %s, %s, %s, %s, %s)
            RETURNING id
        ''', (
            len(drawing_ids),
            dpi,
            tile_size,
            overlap,
            json.dumps(drawing_ids),
            json.dumps(job_settings)
        ))

        job_id = cursor.fetchone()[0]

        # Create job_pages entries (one per drawing)
        for idx, drawing_id in enumerate(drawing_ids):
            cursor.execute('''
                INSERT INTO job_pages (job_id, page_number, status)
                VALUES (%s, %s, 'pending')
            ''', (job_id, idx + 1))

    logger.info(f"Created Procore job {job_id} with {len(drawing_ids)} drawings (no_tiles={no_tiles})")
    return job_id


def get_procore_job_data(job_id: int) -> Optional[dict]:
    """
    Get Procore-specific job data including drawing IDs and S3 keys.

    Args:
        job_id: Job ID.

    Returns:
        Dict with job data or None if not found.
    """
    with get_db() as conn:
        cursor = conn.cursor()

        cursor.execute('''
            SELECT id, status, dpi, tile_size, overlap,
                   procore_drawing_ids, procore_s3_keys
            FROM jobs WHERE id = %s AND source = 'procore'
        ''', (job_id,))

        row = cursor.fetchone()

    if not row:
        return None

    # Parse procore_s3_keys which may be a list (legacy) or dict (new format with settings)
    s3_keys_data = json.loads(row[6]) if row[6] else []
    if isinstance(s3_keys_data, dict):
        s3_keys = s3_keys_data.get('s3_keys', [])
        no_tiles = s3_keys_data.get('no_tiles', False)
    else:
        # Legacy format: just a list of s3_keys
        s3_keys = s3_keys_data
        no_tiles = False

    return {
        'job_id': row[0],
        'status': row[1],
        'dpi': row[2] or 600,
        'tile_size': row[3] or 1920,
        'overlap': row[4] or 250,
        'drawing_ids': json.loads(row[5]) if row[5] else [],
        's3_keys': s3_keys,
        'no_tiles': no_tiles,
    }


def process_procore_drawings(job_id: int) -> None:
    """
    Background task to process Procore drawings through the tile pipeline.

    Downloads PDFs from Procore S3 bucket, converts to images, optionally tiles them,
    and stores output in local storage.

    Args:
        job_id: Job ID to process.
    """
    import shutil
    from .s3_client import S3Client
    from .pdf_processor import PDFProcessor
    from .image_tiler import ImageTiler

    logger.info(f"Starting Procore job {job_id}")

    job_data = get_procore_job_data(job_id)
    if not job_data:
        logger.error(f"Procore job {job_id} not found")
        return

    drawing_ids = job_data['drawing_ids']
    s3_keys = job_data['s3_keys']
    dpi = job_data['dpi']
    tile_size = job_data['tile_size']
    overlap = job_data['overlap']
    no_tiles = job_data['no_tiles']

    # Initialize clients
    procore_s3 = S3Client(bucket_name=config.PROCORE_S3_BUCKET)
    processor = PDFProcessor(dpi=dpi)

    # Only create tiler if we need tiles
    tiler = None if no_tiles else ImageTiler(tile_size=tile_size, overlap=overlap)

    # Output directory - use "images" for no_tiles mode, "tiles" otherwise
    output_subdir = "images" if no_tiles else "tiles"
    output_base = Path(config.LOCAL_TILE_STORAGE_PATH) / str(job_id) / output_subdir
    output_base.mkdir(parents=True, exist_ok=True)

    total_output = 0
    processed_count = 0

    try:
        for idx, (drawing_id, s3_key) in enumerate(zip(drawing_ids, s3_keys)):
            page_num = idx + 1
            logger.info(f"Processing drawing {drawing_id} (page {page_num}/{len(drawing_ids)}) no_tiles={no_tiles}")

            try:
                # Update page status to processing
                update_page_status(job_id, page_num, 'processing')

                # Download PDF from Procore S3
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
                    procore_s3.download_file(s3_key, tmp_pdf.name)
                    pdf_path = tmp_pdf.name

                # Convert PDF to images
                with tempfile.TemporaryDirectory() as images_dir:
                    image_paths = processor.convert_to_images(pdf_path, images_dir)

                    page_output_count = 0

                    if no_tiles:
                        # No tiling - just copy the converted images to output
                        for img_idx, image_path in enumerate(image_paths):
                            # Name format: drawing{id}_page{num}.png
                            output_name = f"drawing{drawing_id}_page{img_idx + 1}.png"
                            output_path = output_base / output_name
                            shutil.copy2(image_path, output_path)
                            page_output_count += 1
                    else:
                        # Tile each page of the PDF
                        for img_idx, image_path in enumerate(image_paths):
                            tile_prefix = f"page{page_num}_pdf{img_idx + 1}"
                            tiles = tiler.tile_image(image_path, str(output_base), prefix=tile_prefix)
                            page_output_count += len(tiles)

                    total_output += page_output_count

                # Clean up temp PDF
                Path(pdf_path).unlink(missing_ok=True)

                # Update page status
                update_page_status(job_id, page_num, 'completed', tile_count=page_output_count)
                processed_count += 1

            except Exception as e:
                logger.error(f"Failed to process drawing {drawing_id}: {e}")
                update_page_status(job_id, page_num, 'failed', error_message=str(e))

        # Mark job as completed or failed based on results
        output_type = "images" if no_tiles else "tiles"
        if processed_count == len(drawing_ids):
            mark_job_completed(job_id)
            logger.info(f"Procore job {job_id} completed: {total_output} {output_type} generated")
        elif processed_count > 0:
            # Partial success
            update_job_status(job_id, 'completed')
            logger.warning(f"Procore job {job_id} partially completed: {processed_count}/{len(drawing_ids)} drawings")
        else:
            mark_job_failed(job_id, "All drawings failed to process")
            logger.error(f"Procore job {job_id} failed: no drawings processed")

    except Exception as e:
        logger.error(f"Procore job {job_id} failed with error: {e}")
        mark_job_failed(job_id, str(e))
