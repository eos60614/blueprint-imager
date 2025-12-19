"""Unit tests for tile_calculator service."""
import pytest
from src.models.area_selection import AreaSelection
from src.services.tile_calculator import (
    TileCoord,
    calculate_tiles_for_area,
    calculate_grid_dimensions,
    get_tile_set_for_area,
)


class TestCalculateTilesForArea:
    """Tests for calculate_tiles_for_area function."""

    def test_full_page_returns_all_tiles(self):
        """Without area selection, should return all tiles for the page."""
        # Page that would generate a 2x2 grid
        # With tile_size=1920, overlap=250, stride=1670
        # Width 3000 -> cols = ceil((3000-250)/1670) = ceil(1.65) = 2
        # Height 3000 -> rows = ceil((3000-250)/1670) = ceil(1.65) = 2
        page_width = 3000
        page_height = 3000

        tiles = calculate_tiles_for_area(page_width, page_height, area=None)

        assert len(tiles) == 4  # 2x2 grid
        rows = {t.row for t in tiles}
        cols = {t.col for t in tiles}
        assert rows == {0, 1}
        assert cols == {0, 1}

    def test_small_area_single_tile(self):
        """Small area should return single tile that contains it."""
        page_width = 5000
        page_height = 5000

        # Area in top-left corner, smaller than one tile
        area = AreaSelection(page_num=1, x=100, y=100, width=500, height=500)

        tiles = calculate_tiles_for_area(page_width, page_height, area)

        # Should only get the top-left tile (0,0)
        assert len(tiles) == 1
        assert tiles[0].row == 0
        assert tiles[0].col == 0
        assert tiles[0].x == 0
        assert tiles[0].y == 0

    def test_area_spanning_multiple_tiles(self):
        """Area spanning multiple tiles should return all intersecting tiles."""
        page_width = 5000
        page_height = 5000

        # Area that spans from tile (0,0) to tile (1,1)
        # stride = 1670, so area from 1000 to 2500 spans tiles 0 and 1 in both dims
        area = AreaSelection(page_num=1, x=1000, y=1000, width=1500, height=1500)

        tiles = calculate_tiles_for_area(page_width, page_height, area)

        # Should get 4 tiles (2x2 that intersect)
        assert len(tiles) == 4
        tile_positions = {(t.row, t.col) for t in tiles}
        assert tile_positions == {(0, 0), (0, 1), (1, 0), (1, 1)}

    def test_area_at_page_boundary(self):
        """Area at page edge should work correctly."""
        page_width = 3500
        page_height = 3500

        # Area at bottom-right of page
        area = AreaSelection(page_num=1, x=2500, y=2500, width=1000, height=1000)

        tiles = calculate_tiles_for_area(page_width, page_height, area)

        # Should get tiles that cover bottom-right
        assert len(tiles) >= 1
        # All tiles should have valid positions
        for tile in tiles:
            assert tile.x >= 0
            assert tile.y >= 0
            assert tile.x < page_width
            assert tile.y < page_height

    def test_tiny_page_single_tile(self):
        """Page smaller than tile size should still produce one tile."""
        page_width = 1000
        page_height = 1000

        tiles = calculate_tiles_for_area(page_width, page_height, area=None)

        assert len(tiles) == 1
        assert tiles[0].row == 0
        assert tiles[0].col == 0
        assert tiles[0].x == 0
        assert tiles[0].y == 0

    def test_area_covering_entire_page(self):
        """Area covering full page should return all tiles."""
        page_width = 3000
        page_height = 3000

        # Area covers entire page
        area = AreaSelection(page_num=1, x=0, y=0, width=page_width, height=page_height)

        tiles_with_area = calculate_tiles_for_area(page_width, page_height, area)
        tiles_no_area = calculate_tiles_for_area(page_width, page_height, area=None)

        # Should return same tiles
        assert len(tiles_with_area) == len(tiles_no_area)

    def test_tile_coordinates_match_image_tiler_logic(self):
        """Tile positions should match ImageTiler's logic (clamped to page bounds)."""
        page_width = 3500
        page_height = 3500
        tile_size = 1920
        overlap = 250
        stride = tile_size - overlap  # 1670

        tiles = calculate_tiles_for_area(page_width, page_height, area=None)

        for tile in tiles:
            # Each tile's position should be clamped to keep tile within page
            expected_x = min(tile.col * stride, max(0, page_width - tile_size))
            expected_y = min(tile.row * stride, max(0, page_height - tile_size))
            assert tile.x == expected_x
            assert tile.y == expected_y

    def test_custom_tile_size_and_overlap(self):
        """Should work with custom tile size and overlap."""
        page_width = 4000
        page_height = 4000
        tile_size = 1000
        overlap = 100
        stride = tile_size - overlap  # 900

        tiles = calculate_tiles_for_area(
            page_width, page_height, area=None,
            tile_size=tile_size, overlap=overlap
        )

        # Calculate expected grid
        # cols = ceil((4000-100)/900) = ceil(4.33) = 5
        # rows = ceil((4000-100)/900) = ceil(4.33) = 5
        assert len(tiles) == 25  # 5x5 grid


class TestCalculateGridDimensions:
    """Tests for calculate_grid_dimensions function."""

    def test_basic_grid_calculation(self):
        """Should calculate correct grid dimensions."""
        rows, cols, total = calculate_grid_dimensions(5000, 5000)

        # With default tile_size=1920, overlap=250, stride=1670
        # cols = ceil((5000-250)/1670) = ceil(2.84) = 3
        # rows = ceil((5000-250)/1670) = ceil(2.84) = 3
        assert cols == 3
        assert rows == 3
        assert total == 9

    def test_small_page_minimum_one_tile(self):
        """Small page should have at least 1x1 grid."""
        rows, cols, total = calculate_grid_dimensions(500, 500)

        assert rows == 1
        assert cols == 1
        assert total == 1


class TestGetTileSetForArea:
    """Tests for get_tile_set_for_area function."""

    def test_returns_set_of_tuples(self):
        """Should return set of (row, col) tuples."""
        page_width = 5000
        page_height = 5000
        area = AreaSelection(page_num=1, x=0, y=0, width=2000, height=2000)

        tile_set = get_tile_set_for_area(area, page_width, page_height)

        assert isinstance(tile_set, set)
        # All elements should be tuples of (row, col)
        for item in tile_set:
            assert isinstance(item, tuple)
            assert len(item) == 2


class TestAreaSelection:
    """Tests for AreaSelection model."""

    def test_to_dict(self):
        """Should convert to dict with camelCase keys."""
        area = AreaSelection(page_num=1, x=100, y=200, width=300, height=400)

        result = area.to_dict()

        assert result == {
            'pageNum': 1,
            'x': 100,
            'y': 200,
            'width': 300,
            'height': 400
        }

    def test_from_dict(self):
        """Should create from dict with camelCase keys."""
        data = {'pageNum': 2, 'x': 50, 'y': 75, 'width': 500, 'height': 600}

        area = AreaSelection.from_dict(data)

        assert area.page_num == 2
        assert area.x == 50
        assert area.y == 75
        assert area.width == 500
        assert area.height == 600

    def test_clamp_to_bounds(self):
        """Should clamp area to page boundaries."""
        # Area extends beyond page
        area = AreaSelection(page_num=1, x=900, y=900, width=500, height=500)

        clamped = area.clamp_to_bounds(1000, 1000)

        assert clamped.x == 900
        assert clamped.y == 900
        assert clamped.width == 100  # Clamped to fit within page
        assert clamped.height == 100

    def test_right_and_bottom_properties(self):
        """Should calculate right and bottom edges."""
        area = AreaSelection(page_num=1, x=100, y=200, width=300, height=400)

        assert area.right == 400
        assert area.bottom == 600
