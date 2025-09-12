from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Drawing:
    id: Optional[int] = None
    project_id: str = ""
    document_id: str = ""
    name: str = ""
    series: str = ""
    file_path: Optional[str] = None
    status: str = "pending"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def is_m_series(self) -> bool:
        return self.series.upper().startswith("M")