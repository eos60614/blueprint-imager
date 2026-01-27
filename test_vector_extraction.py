#!/usr/bin/env python3
"""Test script to extract text and vector geometry from HVAC PDFs."""

import pdfplumber
import json
import re
from pathlib import Path
from collections import Counter

def extract_from_pdf(pdf_path: str) -> dict:
    """Extract text objects and vector geometry from a PDF."""
    results = {
        "file": Path(pdf_path).name,
        "pages": []
    }

    with pdfplumber.open(pdf_path) as pdf:
        results["page_count"] = len(pdf.pages)

        for i, page in enumerate(pdf.pages):
            page_data = {
                "page_num": i + 1,
                "width": page.width,
                "height": page.height,
                "text_objects": [],
                "lines": [],
                "rects": [],
                "curves": [],
            }

            # Extract text with positions (chars give us individual characters with coords)
            chars = page.chars or []
            words = page.extract_words() or []

            # Get words with bounding boxes
            for word in words[:100]:  # Limit for display
                page_data["text_objects"].append({
                    "text": word.get("text", ""),
                    "x0": round(word.get("x0", 0), 2),
                    "y0": round(word.get("top", 0), 2),
                    "x1": round(word.get("x1", 0), 2),
                    "y1": round(word.get("bottom", 0), 2),
                })

            # Extract lines (vector geometry)
            lines = page.lines or []
            page_data["line_count"] = len(lines)
            for line in lines[:50]:  # Sample
                page_data["lines"].append({
                    "x0": round(line.get("x0", 0), 2),
                    "y0": round(line.get("top", 0), 2),
                    "x1": round(line.get("x1", 0), 2),
                    "y1": round(line.get("bottom", 0), 2),
                    "linewidth": line.get("linewidth"),
                    "stroke": line.get("stroke", False),
                })

            # Extract rectangles
            rects = page.rects or []
            page_data["rect_count"] = len(rects)
            for rect in rects[:50]:  # Sample
                page_data["rects"].append({
                    "x0": round(rect.get("x0", 0), 2),
                    "y0": round(rect.get("top", 0), 2),
                    "x1": round(rect.get("x1", 0), 2),
                    "y1": round(rect.get("bottom", 0), 2),
                    "linewidth": rect.get("linewidth"),
                    "fill": rect.get("fill", False),
                    "stroke": rect.get("stroke", False),
                })

            # Extract curves (bezier paths)
            curves = page.curves or []
            page_data["curve_count"] = len(curves)
            for curve in curves[:20]:  # Sample
                page_data["curves"].append({
                    "pts": [(round(p[0], 2), round(p[1], 2)) for p in curve.get("pts", [])[:10]],
                    "linewidth": curve.get("linewidth"),
                })

            # Look for equipment tags (patterns like FD-1, VAV-2A, AHU-1, etc.)
            all_text = page.extract_text() or ""
            equipment_patterns = [
                r'\b(FD-\d+[A-Z]?)\b',      # Fire dampers
                r'\b(VAV-\d+[A-Z]?)\b',     # VAV boxes
                r'\b(AHU-\d+[A-Z]?)\b',     # Air handling units
                r'\b(FCU-\d+[A-Z]?)\b',     # Fan coil units
                r'\b(EF-\d+[A-Z]?)\b',      # Exhaust fans
                r'\b(SF-\d+[A-Z]?)\b',      # Supply fans
                r'\b(RF-\d+[A-Z]?)\b',      # Return fans
                r'\b(HWP-\d+[A-Z]?)\b',     # Hot water pumps
                r'\b(CWP-\d+[A-Z]?)\b',     # Chilled water pumps
                r'\b(B-\d+[A-Z]?)\b',       # Boilers
                r'\b(CH-\d+[A-Z]?)\b',      # Chillers
            ]

            found_tags = []
            for pattern in equipment_patterns:
                matches = re.findall(pattern, all_text, re.IGNORECASE)
                found_tags.extend(matches)

            page_data["equipment_tags"] = list(set(found_tags))
            page_data["total_words"] = len(words)
            page_data["total_chars"] = len(chars)

            results["pages"].append(page_data)

    return results


def print_summary(results: dict):
    """Print a human-readable summary of extraction results."""
    print(f"\n{'='*60}")
    print(f"FILE: {results['file']}")
    print(f"Pages: {results['page_count']}")
    print('='*60)

    for page in results["pages"]:
        print(f"\n--- Page {page['page_num']} ({page['width']:.0f} x {page['height']:.0f} pts) ---")
        print(f"  Text: {page['total_words']} words, {page['total_chars']} chars")
        print(f"  Geometry: {page['line_count']} lines, {page['rect_count']} rects, {page['curve_count']} curves")

        if page["equipment_tags"]:
            print(f"  Equipment tags found: {', '.join(sorted(page['equipment_tags']))}")

        # Sample text objects
        if page["text_objects"]:
            print(f"\n  Sample text objects (first 10):")
            for obj in page["text_objects"][:10]:
                print(f"    '{obj['text']}' at ({obj['x0']}, {obj['y0']})")

        # Sample lines
        if page["lines"]:
            print(f"\n  Sample lines (first 5):")
            for line in page["lines"][:5]:
                print(f"    ({line['x0']}, {line['y0']}) -> ({line['x1']}, {line['y1']}) width={line['linewidth']}")

        # Sample rects
        if page["rects"]:
            print(f"\n  Sample rectangles (first 5):")
            for rect in page["rects"][:5]:
                w = rect['x1'] - rect['x0']
                h = rect['y1'] - rect['y0']
                print(f"    ({rect['x0']}, {rect['y0']}) size={w:.1f}x{h:.1f} fill={rect['fill']}")


if __name__ == "__main__":
    test_dir = Path("test_files")

    for pdf_file in sorted(test_dir.glob("*.pdf")):
        print(f"\nProcessing: {pdf_file}")
        try:
            results = extract_from_pdf(str(pdf_file))
            print_summary(results)

            # Save full results to JSON
            output_file = test_dir / f"{pdf_file.stem}_extraction.json"
            with open(output_file, "w") as f:
                json.dump(results, f, indent=2)
            print(f"\n  Full results saved to: {output_file}")

        except Exception as e:
            print(f"  ERROR: {e}")
