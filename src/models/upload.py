from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Upload:
    """Represents a user-uploaded PDF file stored in S3."""

    id: Optional[int] = None
    s3_bucket: str = ""
    s3_key: str = ""
    file_name: str = ""
    file_size: int = 0
    page_count: Optional[int] = None
    status: str = "pending"  # pending, ready, processing, completed, failed
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @property
    def is_ready(self) -> bool:
        """Check if upload is ready for processing."""
        return self.status == "ready" and self.page_count is not None and self.page_count > 0


# SQL schema for uploads table
UPLOADS_TABLE_SQL = '''
CREATE TABLE IF NOT EXISTS uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    s3_bucket TEXT NOT NULL,
    s3_key TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    page_count INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
'''

UPLOADS_INDEXES_SQL = [
    'CREATE INDEX IF NOT EXISTS idx_uploads_s3_key ON uploads(s3_key)',
    'CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status)'
]
