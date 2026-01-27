#!/usr/bin/env python3
"""
Extract text + coordinates from PDF and prepare for LLM processing.
Outputs:
  1. JSON with all text positions
  2. PNG render of the PDF
  3. Combined prompt for LLM
"""

import pdfplumber
from pdf2image import convert_from_path
from pathlib import Path
import json
import base64
import io


def extract_text_with_positions(pdf_path: str) -> dict:
    """Extract all text with bounding box coordinates."""
    result = {
        "file": Path(pdf_path).name,
        "pages": []
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            page_data = {
                "page": page_num + 1,
                "width": page.width,
                "height": page.height,
                "words": [],
                "tables_detected": []
            }

            # Extract words with positions
            words = page.extract_words(
                keep_blank_chars=False,
                x_tolerance=3,
                y_tolerance=3
            ) or []

            for word in words:
                page_data["words"].append({
                    "text": word["text"],
                    "x0": round(word["x0"], 1),
                    "y0": round(word["top"], 1),
                    "x1": round(word["x1"], 1),
                    "y1": round(word["bottom"], 1)
                })

            # Try to detect tables
            tables = page.find_tables() or []
            for i, table in enumerate(tables):
                bbox = table.bbox
                page_data["tables_detected"].append({
                    "table_id": i + 1,
                    "bbox": {
                        "x0": round(bbox[0], 1),
                        "y0": round(bbox[1], 1),
                        "x1": round(bbox[2], 1),
                        "y1": round(bbox[3], 1)
                    }
                })

            result["pages"].append(page_data)

    return result


def render_pdf_to_image(pdf_path: str, dpi: int = 150) -> list:
    """Render PDF pages to images."""
    images = convert_from_path(pdf_path, dpi=dpi)
    return images


def create_llm_prompt(text_data: dict, focus: str = "equipment_schedule") -> str:
    """Create a prompt for the LLM to parse the extracted data."""

    prompts = {
        "equipment_schedule": """You are analyzing a mechanical equipment schedule from a construction drawing.

I'm providing you with:
1. An image of the PDF page (you can see the visual layout, tables, and structure)
2. Extracted text with exact coordinates from the PDF vectors (this text is 100% accurate - no OCR)

Your task:
1. Look at the image to understand the table structure and layout
2. Use the extracted text coordinates to identify which text belongs to which columns/rows
3. Output a structured JSON with the equipment data

The extracted text with coordinates is below. Format: "text" at (x0, y0) to (x1, y1)

{text_positions}

---

Please analyze the image and extracted text above, then output a JSON structure like:

```json
{{
  "schedule_type": "string - e.g., 'Split System Schedule', 'Fan Schedule', etc.",
  "equipment": [
    {{
      "tag": "equipment tag like AC-1, CU-1, etc.",
      "type": "equipment type",
      "service_area": "where it serves",
      "capacity": "capacity with units",
      "electrical": {{
        "volts": "voltage",
        "phase": "phase",
        "amps": "amperage"
      }},
      "manufacturer": "if specified",
      "model": "if specified",
      "notes": ["any remarks or notes"]
    }}
  ]
}}
```

Focus on accuracy. If a field is not visible or unclear, use null.""",

        "general": """You are analyzing a mechanical drawing PDF.

I'm providing you with:
1. An image of the PDF page
2. Extracted text with exact coordinates (100% accurate from PDF vectors)

Text positions:
{text_positions}

---

Please analyze the content and provide a structured summary of what this drawing contains."""
    }

    # Format text positions
    text_lines = []
    for page in text_data["pages"]:
        for word in page["words"]:
            text_lines.append(
                f'"{word["text"]}" at ({word["x0"]}, {word["y0"]})'
            )

    text_positions = "\n".join(text_lines[:500])  # Limit for prompt size
    if len(text_lines) > 500:
        text_positions += f"\n... and {len(text_lines) - 500} more text items"

    return prompts.get(focus, prompts["general"]).format(text_positions=text_positions)


def prepare_for_llm(pdf_path: str, output_dir: Path, dpi: int = 150):
    """Prepare all data for LLM processing."""
    output_dir.mkdir(exist_ok=True)
    stem = Path(pdf_path).stem

    print(f"Processing: {Path(pdf_path).name}")

    # 1. Extract text with positions
    print("  Extracting text with positions...")
    text_data = extract_text_with_positions(pdf_path)

    # Save text data
    text_json_path = output_dir / f"{stem}_text.json"
    with open(text_json_path, "w") as f:
        json.dump(text_data, f, indent=2)
    print(f"  Saved: {text_json_path.name}")

    # 2. Render PDF to image
    print("  Rendering PDF to image...")
    images = render_pdf_to_image(pdf_path, dpi=dpi)

    image_paths = []
    for i, img in enumerate(images):
        img_path = output_dir / f"{stem}_page{i+1}.png"
        img.save(img_path, "PNG")
        image_paths.append(img_path)
        print(f"  Saved: {img_path.name}")

    # 3. Create LLM prompt
    print("  Creating LLM prompt...")
    prompt = create_llm_prompt(text_data, focus="equipment_schedule")

    prompt_path = output_dir / f"{stem}_prompt.txt"
    with open(prompt_path, "w") as f:
        f.write(prompt)
    print(f"  Saved: {prompt_path.name}")

    # 4. Summary
    total_words = sum(len(p["words"]) for p in text_data["pages"])
    tables_found = sum(len(p["tables_detected"]) for p in text_data["pages"])

    print(f"\n  Summary:")
    print(f"    Pages: {len(text_data['pages'])}")
    print(f"    Words extracted: {total_words}")
    print(f"    Tables detected: {tables_found}")

    return {
        "text_json": text_json_path,
        "images": image_paths,
        "prompt": prompt_path,
        "text_data": text_data
    }


def group_text_by_region(text_data: dict, regions: list) -> dict:
    """Group extracted text by defined regions (for table parsing)."""
    grouped = {r["name"]: [] for r in regions}
    grouped["other"] = []

    for page in text_data["pages"]:
        for word in page["words"]:
            wx, wy = (word["x0"] + word["x1"]) / 2, (word["y0"] + word["y1"]) / 2
            placed = False

            for region in regions:
                r = region["bbox"]
                if r["x0"] <= wx <= r["x1"] and r["y0"] <= wy <= r["y1"]:
                    grouped[region["name"]].append(word)
                    placed = True
                    break

            if not placed:
                grouped["other"].append(word)

    return grouped


if __name__ == "__main__":
    test_dir = Path("test_files")
    output_dir = test_dir / "llm_extract"

    # Process schedule sheets (they have tables)
    schedule_files = [
        "M-801_ MECHANICAL SCHEDULES Rev.3 markup.pdf",
        "M0.014_ MECHANICAL SCHEDULES Rev.3.pdf",
    ]

    for filename in schedule_files:
        pdf_path = test_dir / filename
        if pdf_path.exists():
            result = prepare_for_llm(str(pdf_path), output_dir)
            print()
