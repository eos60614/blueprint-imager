from dataclasses import dataclass
from typing import List


@dataclass
class AreaSelection:
    """Rectangular area selection on a PDF page.

    Coordinates are relative to the PDF page at native resolution (e.g., 600 DPI).
    """
    page_num: int      # 1-indexed page number
    x: int             # Left edge in pixels (native DPI)
    y: int             # Top edge in pixels (native DPI)
    width: int         # Width in pixels
    height: int        # Height in pixels

    def to_dict(self) -> dict:
        """Convert to dictionary for JSON serialization."""
        return {
            'pageNum': self.page_num,
            'x': self.x,
            'y': self.y,
            'width': self.width,
            'height': self.height
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'AreaSelection':
        """Create from dictionary (e.g., from JSON request)."""
        return cls(
            page_num=data['pageNum'],
            x=data['x'],
            y=data['y'],
            width=data['width'],
            height=data['height']
        )

    def clamp_to_bounds(self, page_width: int, page_height: int) -> 'AreaSelection':
        """Return a new AreaSelection clamped to page boundaries."""
        x = max(0, min(self.x, page_width - 1))
        y = max(0, min(self.y, page_height - 1))
        width = min(self.width, page_width - x)
        height = min(self.height, page_height - y)
        return AreaSelection(
            page_num=self.page_num,
            x=x,
            y=y,
            width=max(1, width),
            height=max(1, height)
        )

    @property
    def right(self) -> int:
        """Right edge x coordinate."""
        return self.x + self.width

    @property
    def bottom(self) -> int:
        """Bottom edge y coordinate."""
        return self.y + self.height
