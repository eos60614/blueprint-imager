from pathlib import Path
from typing import List, Tuple
from PIL import Image
import math

# Increase decompression bomb limit for large mechanical drawings
Image.MAX_IMAGE_PIXELS = 500000000  # 500 million pixels


class ImageTiler:
    def __init__(self, tile_size: int = 1920, overlap: int = 250):
        self.tile_size = tile_size
        self.overlap = overlap
        self.stride = tile_size - overlap  # 1670
        
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
                    "height": self.tile_size
                })
                
                tile_index += 1
        
        return tiles
    
    def calculate_tiles_count(self, width: int, height: int) -> Tuple[int, int, int]:
        cols = math.ceil((width - self.overlap) / self.stride)
        rows = math.ceil((height - self.overlap) / self.stride)
        total = cols * rows
        return rows, cols, total