#!/usr/bin/env python3
"""Visualize vector geometry extracted from HVAC PDFs."""

import pdfplumber
from PIL import Image, ImageDraw
from pathlib import Path
import colorsys


def visualize_pdf_geometry(pdf_path: str, output_dir: Path, scale: float = 0.5):
    """Render PDF geometry as images."""
    output_dir.mkdir(exist_ok=True)

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            # Create image canvas
            width = int(page.width * scale)
            height = int(page.height * scale)

            # White background
            img = Image.new('RGB', (width, height), 'white')
            draw = ImageDraw.Draw(img)

            # Draw rectangles (gray, filled ones lighter)
            rects = page.rects or []
            for rect in rects:
                x0 = rect.get('x0', 0) * scale
                y0 = rect.get('top', 0) * scale
                x1 = rect.get('x1', 0) * scale
                y1 = rect.get('bottom', 0) * scale

                if rect.get('fill'):
                    draw.rectangle([x0, y0, x1, y1], fill='#e0e0e0', outline='#888888')
                else:
                    draw.rectangle([x0, y0, x1, y1], outline='#888888')

            # Draw lines (blue)
            lines = page.lines or []
            for line in lines:
                x0 = line.get('x0', 0) * scale
                y0 = line.get('top', 0) * scale
                x1 = line.get('x1', 0) * scale
                y1 = line.get('bottom', 0) * scale
                lw = max(1, int((line.get('linewidth') or 0.5) * scale))
                draw.line([x0, y0, x1, y1], fill='#2563eb', width=lw)

            # Draw curves (red/orange) - connect points
            curves = page.curves or []
            for curve in curves:
                pts = curve.get('pts', [])
                if len(pts) >= 2:
                    scaled_pts = [(p[0] * scale, p[1] * scale) for p in pts]
                    for i in range(len(scaled_pts) - 1):
                        draw.line([scaled_pts[i], scaled_pts[i+1]], fill='#dc2626', width=1)

            # Save
            stem = Path(pdf_path).stem
            output_file = output_dir / f"{stem}_page{page_num + 1}_geometry.png"
            img.save(output_file)
            print(f"Saved: {output_file}")

            # Also create separate layer images
            create_layer_images(page, output_dir, stem, page_num + 1, scale)


def create_layer_images(page, output_dir: Path, stem: str, page_num: int, scale: float):
    """Create separate images for each geometry type."""
    width = int(page.width * scale)
    height = int(page.height * scale)

    # Lines only (ductwork, piping)
    img_lines = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img_lines)
    for line in (page.lines or []):
        x0 = line.get('x0', 0) * scale
        y0 = line.get('top', 0) * scale
        x1 = line.get('x1', 0) * scale
        y1 = line.get('bottom', 0) * scale
        lw = max(1, int((line.get('linewidth') or 0.5) * scale))
        draw.line([x0, y0, x1, y1], fill='#2563eb', width=lw)
    img_lines.save(output_dir / f"{stem}_page{page_num}_lines.png")

    # Curves only (symbols, connectors)
    img_curves = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img_curves)
    for curve in (page.curves or []):
        pts = curve.get('pts', [])
        if len(pts) >= 2:
            scaled_pts = [(p[0] * scale, p[1] * scale) for p in pts]
            for i in range(len(scaled_pts) - 1):
                draw.line([scaled_pts[i], scaled_pts[i+1]], fill='#dc2626', width=1)
    img_curves.save(output_dir / f"{stem}_page{page_num}_curves.png")

    # Rects only (equipment boxes, tables)
    img_rects = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img_rects)
    for rect in (page.rects or []):
        x0 = rect.get('x0', 0) * scale
        y0 = rect.get('top', 0) * scale
        x1 = rect.get('x1', 0) * scale
        y1 = rect.get('bottom', 0) * scale
        if rect.get('fill'):
            draw.rectangle([x0, y0, x1, y1], fill='#22c55e', outline='#16a34a')
        else:
            draw.rectangle([x0, y0, x1, y1], outline='#16a34a', width=2)
    img_rects.save(output_dir / f"{stem}_page{page_num}_rects.png")


if __name__ == "__main__":
    test_dir = Path("test_files")
    output_dir = test_dir / "visualizations"

    for pdf_file in sorted(test_dir.glob("*.pdf")):
        print(f"\nVisualizing: {pdf_file.name}")
        try:
            visualize_pdf_geometry(str(pdf_file), output_dir, scale=0.5)
        except Exception as e:
            print(f"  ERROR: {e}")

    print(f"\nAll visualizations saved to: {output_dir}")
