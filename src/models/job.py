from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List
import json


@dataclass
class Job:
    id: Optional[int] = None
    project_id: str = ""
    status: str = "pending"  # pending, processing, completed, failed
    total_drawings: int = 0
    processed_drawings: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    error_message: Optional[str] = None
    # New fields for upload frontend support
    source: str = "procore"  # "procore" or "upload"
    upload_id: Optional[int] = None
    selected_pages: Optional[List[int]] = None
    total_pages: int = 0
    processed_pages: int = 0
    # Conversion settings (user-configurable)
    dpi: int = 600
    tile_size: int = 1920
    overlap: int = 250

    @property
    def progress(self) -> float:
        # For upload jobs, calculate based on pages
        if self.source == "upload":
            if self.total_pages == 0:
                return 0.0
            return (self.processed_pages / self.total_pages) * 100
        # For procore jobs, calculate based on drawings
        if self.total_drawings == 0:
            return 0.0
        return (self.processed_drawings / self.total_drawings) * 100

    @property
    def selected_pages_json(self) -> Optional[str]:
        """Get selected pages as JSON string for database storage."""
        if self.selected_pages is None:
            return None
        return json.dumps(self.selected_pages)

    @classmethod
    def selected_pages_from_json(cls, json_str: Optional[str]) -> Optional[List[int]]:
        """Parse selected pages from JSON string."""
        if json_str is None:
            return None
        return json.loads(json_str)


# SQL to add new columns to existing jobs table
JOBS_ALTER_SQL = [
    "ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT 'procore'",
    "ALTER TABLE jobs ADD COLUMN upload_id INTEGER REFERENCES uploads(id)",
    "ALTER TABLE jobs ADD COLUMN selected_pages TEXT",
    "ALTER TABLE jobs ADD COLUMN total_pages INTEGER DEFAULT 0",
    "ALTER TABLE jobs ADD COLUMN processed_pages INTEGER DEFAULT 0",
    # Conversion settings columns
    "ALTER TABLE jobs ADD COLUMN dpi INTEGER DEFAULT 600",
    "ALTER TABLE jobs ADD COLUMN tile_size INTEGER DEFAULT 1920",
    "ALTER TABLE jobs ADD COLUMN overlap INTEGER DEFAULT 250"
]