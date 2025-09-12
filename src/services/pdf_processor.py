import os
from pathlib import Path
from typing import List, Optional
from pdf2image import convert_from_path
from PIL import Image
import tempfile

# Increase decompression bomb limit for large mechanical drawings
Image.MAX_IMAGE_PIXELS = 500000000  # 500 million pixels


class PDFProcessor:
    def __init__(self, dpi: int = 600):
        self.dpi = dpi
        
    def convert_to_images(self, pdf_path: str, output_dir: str) -> List[str]:
        pdf_path = Path(pdf_path)
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        images = convert_from_path(
            str(pdf_path),
            dpi=self.dpi,
            fmt='png',
            use_cropbox=False,
            transparent=False
        )
        
        image_paths = []
        base_name = pdf_path.stem
        
        for i, image in enumerate(images):
            if image.mode != 'RGB':
                image = image.convert('RGB')
            
            image_path = output_dir / f"{base_name}_page_{i+1}.png"
            image.save(str(image_path), 'PNG', compress_level=0)
            image_paths.append(str(image_path))
        
        return image_paths
    
    def get_pdf_info(self, pdf_path: str) -> dict:
        pdf_path = Path(pdf_path)
        
        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")
        
        with tempfile.TemporaryDirectory() as temp_dir:
            images = convert_from_path(
                str(pdf_path),
                dpi=self.dpi,
                fmt='png',
                output_folder=temp_dir,
                first_page=1,
                last_page=1
            )
            
            if images:
                first_image = images[0]
                return {
                    "page_count": len(images),
                    "width": first_image.width,
                    "height": first_image.height,
                    "dpi": self.dpi
                }
            
        return {"page_count": 0, "width": 0, "height": 0, "dpi": self.dpi}