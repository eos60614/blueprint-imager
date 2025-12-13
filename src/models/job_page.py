from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class JobPage:
    """Tracks per-page processing status within a conversion job."""

    id: Optional[int] = None
    job_id: int = 0
    page_number: int = 0
    status: str = "pending"  # pending, processing, completed, failed
    tile_count: int = 0
    error_message: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def is_complete(self) -> bool:
        return self.status == "completed"

    @property
    def is_failed(self) -> bool:
        return self.status == "failed"


# SQL schema for job_pages table
JOB_PAGES_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS job_pages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    page_number INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    tile_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(job_id, page_number)
)
'''

JOB_PAGES_INDEXES_SQL = [
    'CREATE INDEX IF NOT EXISTS idx_job_pages_job_id ON job_pages(job_id)'
]
