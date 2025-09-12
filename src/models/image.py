from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class Image:
    id: Optional[int] = None
    drawing_id: int = 0
    file_path: str = ""
    tile_index: int = 0
    row: int = 0
    column: int = 0
    width: int = 1920
    height: int = 1920
    created_at: Optional[datetime] = None