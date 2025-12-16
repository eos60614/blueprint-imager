from pathlib import Path
from typing import List, Tuple
from PIL import Image
import math
import numpy as np

# Increase decompression bomb limit for large mechanical drawings
Image.MAX_IMAGE_PIXELS = 500000000  # 500 million pixels


class ImageTiler:
    def __init__(self, tile_size: int = 1920, overlap: int = 250, blank_threshold: float = 0.95):
        self.tile_size = tile_size
        self.overlap = overlap
        self.stride = tile_size - overlap  # 1670
        self.blank_threshold = blank_threshold  # % of white pixels to consider blank

    def is_tile_blank(self, tile: Image.Image, threshold: float = None) -> bool:
        """
        Check if a tile is mostly blank (white).

        A pixel is considered "white" if all RGB channels are >= 250 (near-white).
        The tile is blank if the percentage of white pixels >= threshold.

        Args:
            tile: PIL Image in RGB mode
            threshold: Override for blank_threshold (default uses self.blank_threshold)

        Returns:
            True if tile is blank (>= threshold white), False otherwise
        """
        if threshold is None:
            threshold = self.blank_threshold

        # Convert to numpy array for fast computation
        img_array = np.array(tile)

        # A pixel is "white" if all RGB channels are >= 250
        white_mask = np.all(img_array >= 250, axis=2)

        # Calculate percentage of white pixels
        white_ratio = np.mean(white_mask)

        return white_ratio >= threshold

    def tile_image(self, image_path: str, output_dir: str) -> List[dict]:
        image_path = Path(image_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if not image_path.exists():
            raise FileNotFoundError(f"Image file not found: {image_path}")
        
        img = Image.open(str(image_path))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        width, height = img.size
        tiles = []
        
        cols = math.ceil((width - self.overlap) / self.stride)
        rows = math.ceil((height - self.overlap) / self.stride)
        
        base_name = image_path.stem
        tile_index = 0
        
        for row in range(rows):
            for col in range(cols):
                x = col * self.stride
                y = row * self.stride
                
                x = min(x, width - self.tile_size)
                y = min(y, height - self.tile_size)
                x = max(0, x)
                y = max(0, y)
                
                box = (x, y, min(x + self.tile_size, width), min(y + self.tile_size, height))
                tile = img.crop(box)
                
                if tile.size != (self.tile_size, self.tile_size):
                    padded_tile = Image.new('RGB', (self.tile_size, self.tile_size), (255, 255, 255))
                    padded_tile.paste(tile, (0, 0))
                    tile = padded_tile
                
                # Check if tile is blank before saving
                is_blank = self.is_tile_blank(tile)

                tile_filename = f"{base_name}_tile_{row}_{col}.png"
                tile_path = output_dir / tile_filename
                tile.save(str(tile_path), 'PNG', compress_level=0)

                tiles.append({
                    "file_path": str(tile_path),
                    "tile_index": tile_index,
                    "row": row,
                    "column": col,
                    "x": x,
                    "y": y,
                    "width": self.tile_size,
                    "height": self.tile_size,
                    "is_blank": is_blank
                })

                tile_index += 1
        
        return tiles
    
    def calculate_tiles_count(self, width: int, height: int) -> Tuple[int, int, int]:
        cols = math.ceil((width - self.overlap) / self.stride)
        rows = math.ceil((height - self.overlap) / self.stride)
        total = cols * rows
        return rows, cols, total