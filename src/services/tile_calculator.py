"""Tile calculation service for area-based tiling.

Calculates which tiles intersect with a given area selection.
"""
import math
from dataclasses import dataclass
from typing import List, Optional, Tuple

from src.models.area_selection import AreaSelection


@dataclass
class TileCoord:
    """Represents a tile's position in the grid and pixel space."""
    row: int       # 0-indexed row in tile grid
    col: int       # 0-indexed column in tile grid
    x: int         # Pixel x of tile top-left corner
    y: int         # Pixel y of tile top-left corner


def calculate_tiles_for_area(
    page_width: int,
    page_height: int,
    area: Optional[AreaSelection] = None,
    tile_size: int = 1920,
    overlap: int = 250
) -> List[TileCoord]:
    """
    Calculate which tiles intersect with the given area.

    If no area is provided, returns all tiles for the full page.
    Tiles that intersect with the area boundary are included (tiles fully encompass the area).

    Args:
        page_width: Width of the page in pixels (at native DPI)
        page_height: Height of the page in pixels (at native DPI)
        area: Optional area selection. If None, returns all tiles for full page.
        tile_size: Size of each tile (default 1920)
        overlap: Overlap between tiles (default 250)

    Returns:
        List of TileCoord for tiles that intersect with the area (or all tiles if no area)
    """
    stride = tile_size - overlap

    # Calculate full grid dimensions
    total_cols = math.ceil((page_width - overlap) / stride) if page_width > tile_size else 1
    total_rows = math.ceil((page_height - overlap) / stride) if page_height > tile_size else 1

    # Ensure at least 1 row and column
    total_cols = max(1, total_cols)
    total_rows = max(1, total_rows)

    tiles = []

    # If no area specified, return all tiles
    if area is None:
        for row in range(total_rows):
            for col in range(total_cols):
                tile_x, tile_y = _calculate_tile_position(
                    row, col, stride, tile_size, page_width, page_height
                )
                tiles.append(TileCoord(row=row, col=col, x=tile_x, y=tile_y))
        return tiles

    # Area boundaries
    area_right = area.x + area.width
    area_bottom = area.y + area.height

    # Find tiles that intersect with the area
    for row in range(total_rows):
        for col in range(total_cols):
            tile_x, tile_y = _calculate_tile_position(
                row, col, stride, tile_size, page_width, page_height
            )

            tile_right = tile_x + tile_size
            tile_bottom = tile_y + tile_size

            # Check intersection (any overlap between tile and area)
            if (tile_x < area_right and tile_right > area.x and
                tile_y < area_bottom and tile_bottom > area.y):
                tiles.append(TileCoord(row=row, col=col, x=tile_x, y=tile_y))

    return tiles


def _calculate_tile_position(
    row: int,
    col: int,
    stride: int,
    tile_size: int,
    page_width: int,
    page_height: int
) -> Tuple[int, int]:
    """Calculate the pixel position of a tile, clamped to page boundaries."""
    tile_x = col * stride
    tile_y = row * stride

    # Clamp to page boundaries (same logic as ImageTiler)
    tile_x = min(tile_x, max(0, page_width - tile_size))
    tile_y = min(tile_y, max(0, page_height - tile_size))
    tile_x = max(0, tile_x)
    tile_y = max(0, tile_y)

    return tile_x, tile_y


def calculate_grid_dimensions(
    page_width: int,
    page_height: int,
    tile_size: int = 1920,
    overlap: int = 250
) -> Tuple[int, int, int]:
    """
    Calculate the tile grid dimensions for a page.

    Args:
        page_width: Width of the page in pixels
        page_height: Height of the page in pixels
        tile_size: Size of each tile (default 1920)
        overlap: Overlap between tiles (default 250)

    Returns:
        Tuple of (rows, cols, total_tiles)
    """
    stride = tile_size - overlap

    cols = math.ceil((page_width - overlap) / stride) if page_width > tile_size else 1
    rows = math.ceil((page_height - overlap) / stride) if page_height > tile_size else 1

    cols = max(1, cols)
    rows = max(1, rows)

    return rows, cols, rows * cols


def get_tile_set_for_area(
    area: AreaSelection,
    page_width: int,
    page_height: int,
    tile_size: int = 1920,
    overlap: int = 250
) -> set:
    """
    Get a set of (row, col) tuples for tiles that intersect with an area.

    Useful for filtering existing tiles.

    Args:
        area: The area selection
        page_width: Width of the page in pixels
        page_height: Height of the page in pixels
        tile_size: Size of each tile
        overlap: Overlap between tiles

    Returns:
        Set of (row, col) tuples
    """
    tiles = calculate_tiles_for_area(
        page_width, page_height, area, tile_size, overlap
    )
    return {(t.row, t.col) for t in tiles}
