from dataclasses import dataclass
from datetime import datetime
from typing import Optional, List


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
    
    @property
    def progress(self) -> float:
        if self.total_drawings == 0:
            return 0.0
        return (self.processed_drawings / self.total_drawings) * 100