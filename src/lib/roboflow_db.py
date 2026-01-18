"""
Database utilities for Roboflow operations.

This module provides functions for persisting and retrieving
Roboflow upload jobs, failures, and downloads from SQLite.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from src.models.roboflow import (
    RoboflowUploadJob,
    UploadFailure,
    DatasetDownload,
    UploadStatus,
    DownloadStatus
)


def get_connection(db_path: str = "blueprint_imager.db") -> sqlite3.Connection:
    """Get a database connection."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn


def save_upload_job(job: RoboflowUploadJob, db_path: str = "blueprint_imager.db") -> int:
    """
    Save an upload job to the database.

    Returns the job ID.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO roboflow_upload_jobs (
            workspace, project, source_directory, total_images,
            successful_uploads, failed_uploads, status, error_message,
            created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job.workspace,
        job.project,
        str(job.source_directory),
        job.total_images,
        job.successful_uploads,
        job.failed_uploads,
        job.status.value,
        job.error_message,
        job.created_at.isoformat(),
        job.completed_at.isoformat() if job.completed_at else None
    ))

    job_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return job_id


def update_upload_job(job: RoboflowUploadJob, db_path: str = "blueprint_imager.db"):
    """Update an existing upload job in the database."""
    if job.id is None:
        raise ValueError("Job ID is required for update")

    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE roboflow_upload_jobs
        SET total_images = ?,
            successful_uploads = ?,
            failed_uploads = ?,
            status = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ?
    """, (
        job.total_images,
        job.successful_uploads,
        job.failed_uploads,
        job.status.value,
        job.error_message,
        job.completed_at.isoformat() if job.completed_at else None,
        job.id
    ))

    conn.commit()
    conn.close()


def get_upload_job(job_id: int, db_path: str = "blueprint_imager.db") -> Optional[RoboflowUploadJob]:
    """Retrieve an upload job by ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM roboflow_upload_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return RoboflowUploadJob(
        workspace=row["workspace"],
        project=row["project"],
        source_directory=Path(row["source_directory"]),
        total_images=row["total_images"],
        successful_uploads=row["successful_uploads"],
        failed_uploads=row["failed_uploads"],
        status=UploadStatus(row["status"]),
        error_message=row["error_message"],
        created_at=datetime.fromisoformat(row["created_at"]),
        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
        id=row["id"]
    )


def list_upload_jobs(
    status: Optional[str] = None,
    limit: int = 20,
    db_path: str = "blueprint_imager.db"
) -> List[RoboflowUploadJob]:
    """List upload jobs, optionally filtered by status."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    if status and status != "all":
        cursor.execute(
            "SELECT * FROM roboflow_upload_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?",
            (status, limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM roboflow_upload_jobs ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )

    rows = cursor.fetchall()
    conn.close()

    jobs = []
    for row in rows:
        jobs.append(RoboflowUploadJob(
            workspace=row["workspace"],
            project=row["project"],
            source_directory=Path(row["source_directory"]),
            total_images=row["total_images"],
            successful_uploads=row["successful_uploads"],
            failed_uploads=row["failed_uploads"],
            status=UploadStatus(row["status"]),
            error_message=row["error_message"],
            created_at=datetime.fromisoformat(row["created_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
            id=row["id"]
        ))

    return jobs


def save_upload_failure(failure: UploadFailure, db_path: str = "blueprint_imager.db") -> int:
    """
    Save an upload failure to the database.

    Returns the failure ID.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO roboflow_upload_failures (
            upload_job_id, image_path, error_message,
            error_code, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, (
        failure.upload_job_id,
        str(failure.image_path),
        failure.error_message,
        failure.error_code,
        failure.retry_count,
        failure.created_at.isoformat()
    ))

    failure_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return failure_id


def get_upload_failures(
    job_id: int,
    db_path: str = "blueprint_imager.db"
) -> List[UploadFailure]:
    """Retrieve all failures for an upload job."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM roboflow_upload_failures WHERE upload_job_id = ? ORDER BY created_at",
        (job_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    failures = []
    for row in rows:
        failures.append(UploadFailure(
            upload_job_id=row["upload_job_id"],
            image_path=Path(row["image_path"]),
            error_message=row["error_message"],
            error_code=row["error_code"],
            retry_count=row["retry_count"],
            created_at=datetime.fromisoformat(row["created_at"]),
            id=row["id"]
        ))

    return failures


def save_dataset_download(download: DatasetDownload, db_path: str = "blueprint_imager.db") -> int:
    """
    Save a dataset download to the database.

    Returns the download ID.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO roboflow_dataset_downloads (
            workspace, project, version, format, destination_path,
            file_count, file_size_bytes, status, error_message,
            created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        download.workspace,
        download.project,
        download.version,
        download.format,
        str(download.destination_path) if download.destination_path else None,
        download.file_count,
        download.file_size_bytes,
        download.status.value,
        download.error_message,
        download.created_at.isoformat(),
        download.completed_at.isoformat() if download.completed_at else None
    ))

    download_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return download_id


def update_dataset_download(download: DatasetDownload, db_path: str = "blueprint_imager.db"):
    """Update an existing dataset download in the database."""
    if download.id is None:
        raise ValueError("Download ID is required for update")

    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE roboflow_dataset_downloads
        SET file_count = ?,
            file_size_bytes = ?,
            status = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ?
    """, (
        download.file_count,
        download.file_size_bytes,
        download.status.value,
        download.error_message,
        download.completed_at.isoformat() if download.completed_at else None,
        download.id
    ))

    conn.commit()
    conn.close()


def get_dataset_download(download_id: int, db_path: str = "blueprint_imager.db") -> Optional[DatasetDownload]:
    """Retrieve a dataset download by ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM roboflow_dataset_downloads WHERE id = ?", (download_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return DatasetDownload(
        workspace=row["workspace"],
        project=row["project"],
        version=row["version"],
        format=row["format"],
        destination_path=Path(row["destination_path"]) if row["destination_path"] else None,
        file_count=row["file_count"],
        file_size_bytes=row["file_size_bytes"],
        status=DownloadStatus(row["status"]),
        error_message=row["error_message"],
        created_at=datetime.fromisoformat(row["created_at"]),
        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
        id=row["id"]
    )
