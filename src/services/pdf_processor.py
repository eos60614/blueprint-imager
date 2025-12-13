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
        """Get information about a PDF including page count."""
        pdf_path = Path(pdf_path)

        if not pdf_path.exists():
            raise FileNotFoundError(f"PDF file not found: {pdf_path}")

        # Use pdfinfo to get page count without rendering all pages
        from pdf2image.pdf2image import pdfinfo_from_path

        try:
            info = pdfinfo_from_path(str(pdf_path))
            page_count = info.get('Pages', 0)
        except Exception:
            # Fallback: render first page and count by converting
            with tempfile.TemporaryDirectory() as temp_dir:
                images = convert_from_path(
                    str(pdf_path),
                    dpi=72,  # Low DPI just to count pages
                    fmt='png',
                    output_folder=temp_dir
                )
                page_count = len(images)

        # Get first page dimensions at target DPI
        width, height = 0, 0
        if page_count > 0:
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
                    width = first_image.width
                    height = first_image.height

        return {
            "page_count": page_count,
            "width": width,
            "height": height,
            "dpi": self.dpi
        }