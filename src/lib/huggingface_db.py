"""
Database utilities for Hugging Face operations.

This module provides functions for persisting and retrieving
Hugging Face upload jobs and failures from SQLite.
"""

import sqlite3
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from src.models.huggingface import (
    HuggingFaceUploadJob,
    HFUploadFailure,
    HFUploadStatus
)


def get_connection(db_path: str = "blueprint_imager.db") -> sqlite3.Connection:
    """Get a database connection."""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row  # Enable column access by name
    return conn


def save_upload_job(job: HuggingFaceUploadJob, db_path: str = "blueprint_imager.db") -> int:
    """
    Save an upload job to the database.

    Returns the job ID.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO huggingface_upload_jobs (
            repo_id, source_directory, total_files,
            successful_uploads, failed_uploads, status, error_message,
            created_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        job.repo_id,
        str(job.source_directory),
        job.total_files,
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


def update_upload_job(job: HuggingFaceUploadJob, db_path: str = "blueprint_imager.db"):
    """Update an existing upload job in the database."""
    if job.id is None:
        raise ValueError("Job ID is required for update")

    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        UPDATE huggingface_upload_jobs
        SET total_files = ?,
            successful_uploads = ?,
            failed_uploads = ?,
            status = ?,
            error_message = ?,
            completed_at = ?
        WHERE id = ?
    """, (
        job.total_files,
        job.successful_uploads,
        job.failed_uploads,
        job.status.value,
        job.error_message,
        job.completed_at.isoformat() if job.completed_at else None,
        job.id
    ))

    conn.commit()
    conn.close()


def get_upload_job(job_id: int, db_path: str = "blueprint_imager.db") -> Optional[HuggingFaceUploadJob]:
    """Retrieve an upload job by ID."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM huggingface_upload_jobs WHERE id = ?", (job_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        return None

    return HuggingFaceUploadJob(
        repo_id=row["repo_id"],
        source_directory=Path(row["source_directory"]),
        total_files=row["total_files"],
        successful_uploads=row["successful_uploads"],
        failed_uploads=row["failed_uploads"],
        status=HFUploadStatus(row["status"]),
        error_message=row["error_message"],
        created_at=datetime.fromisoformat(row["created_at"]),
        completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
        id=row["id"]
    )


def list_upload_jobs(
    status: Optional[str] = None,
    limit: int = 20,
    db_path: str = "blueprint_imager.db"
) -> List[HuggingFaceUploadJob]:
    """List upload jobs, optionally filtered by status."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    if status and status != "all":
        cursor.execute(
            "SELECT * FROM huggingface_upload_jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?",
            (status, limit)
        )
    else:
        cursor.execute(
            "SELECT * FROM huggingface_upload_jobs ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )

    rows = cursor.fetchall()
    conn.close()

    jobs = []
    for row in rows:
        jobs.append(HuggingFaceUploadJob(
            repo_id=row["repo_id"],
            source_directory=Path(row["source_directory"]),
            total_files=row["total_files"],
            successful_uploads=row["successful_uploads"],
            failed_uploads=row["failed_uploads"],
            status=HFUploadStatus(row["status"]),
            error_message=row["error_message"],
            created_at=datetime.fromisoformat(row["created_at"]),
            completed_at=datetime.fromisoformat(row["completed_at"]) if row["completed_at"] else None,
            id=row["id"]
        ))

    return jobs


def save_upload_failure(failure: HFUploadFailure, db_path: str = "blueprint_imager.db") -> int:
    """
    Save an upload failure to the database.

    Returns the failure ID.
    """
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute("""
        INSERT INTO huggingface_upload_failures (
            upload_job_id, file_path, error_message,
            error_code, retry_count, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    """, (
        failure.upload_job_id,
        str(failure.file_path),
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
) -> List[HFUploadFailure]:
    """Retrieve all failures for an upload job."""
    conn = get_connection(db_path)
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM huggingface_upload_failures WHERE upload_job_id = ? ORDER BY created_at",
        (job_id,)
    )

    rows = cursor.fetchall()
    conn.close()

    failures = []
    for row in rows:
        failures.append(HFUploadFailure(
            upload_job_id=row["upload_job_id"],
            file_path=Path(row["file_path"]),
            error_message=row["error_message"],
            error_code=row["error_code"],
            retry_count=row["retry_count"],
            created_at=datetime.fromisoformat(row["created_at"]),
            id=row["id"]
        ))

    return failures
