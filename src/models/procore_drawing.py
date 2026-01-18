"""
Procore drawing models for read-only access to external database.
"""

from dataclasses import dataclass
from typing import List, Optional


@dataclass
class ProcoreProject:
    """Read-only model for Procore project from external database."""

    id: int
    name: str
    display_name: Optional[str] = None
    project_number: Optional[str] = None
    active: bool = True
    city: Optional[str] = None
    state_code: Optional[str] = None

    @classmethod
    def from_row(cls, row: dict) -> 'ProcoreProject':
        """Create instance from database row dict."""
        return cls(
            id=row['id'],
            name=row['name'],
            display_name=row.get('display_name'),
            project_number=row.get('project_number'),
            active=row.get('active', True),
            city=row.get('city'),
            state_code=row.get('state_code'),
        )


@dataclass
class ProcoreDrawing:
    """Read-only model for Procore drawing with current revision."""

    id: int
    project_id: int
    drawing_number: str
    title: Optional[str] = None
    discipline: Optional[str] = None
    drawing_area_name: Optional[str] = None

    # From current revision (joined)
    revision_id: Optional[int] = None
    revision_number: Optional[str] = None
    s3_key: Optional[str] = None
    filename: Optional[str] = None
    file_size: Optional[int] = None

    # From project (joined)
    project_name: Optional[str] = None
    project_number: Optional[str] = None

    @property
    def has_file(self) -> bool:
        """Check if drawing has an available file."""
        return self.s3_key is not None

    @property
    def display_name(self) -> str:
        """Human-readable display name."""
        if self.title:
            return f"{self.drawing_number} - {self.title}"
        return self.drawing_number

    @classmethod
    def from_row(cls, row: dict) -> 'ProcoreDrawing':
        """Create instance from database row dict."""
        return cls(
            id=row['id'],
            project_id=row['project_id'],
            drawing_number=row['drawing_number'],
            title=row.get('title'),
            discipline=row.get('discipline'),
            drawing_area_name=row.get('drawing_area_name'),
            revision_id=row.get('revision_id'),
            revision_number=row.get('revision_number'),
            s3_key=row.get('s3_key'),
            filename=row.get('filename'),
            file_size=row.get('file_size'),
            project_name=row.get('project_name'),
            project_number=row.get('project_number'),
        )


@dataclass
class ProcoreDrawingList:
    """Paginated list of drawings."""

    drawings: List[ProcoreDrawing]
    total: int
    page: int
    limit: int
    has_more: bool

    @property
    def total_pages(self) -> int:
        """Calculate total number of pages."""
        return (self.total + self.limit - 1) // self.limit
