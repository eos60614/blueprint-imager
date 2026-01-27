#!/usr/bin/env python3
"""
LLM-based schedule parser.
Sends PDF image + extracted text to Claude API for structured parsing.
"""

import anthropic
import pdfplumber
from pdf2image import convert_from_path
from pathlib import Path
import json
import base64
import io
import sys


def extract_text_with_positions(pdf_path: str) -> list:
    """Extract text with coordinates from PDF."""
    all_words = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            words = page.extract_words() or []
            for word in words:
                all_words.append({
                    "text": word["text"],
                    "x": round((word["x0"] + word["x1"]) / 2, 1),
                    "y": round((word["top"] + word["bottom"]) / 2, 1),
                    "page": page_num + 1
                })

    return all_words


def render_pdf_to_base64(pdf_path: str, page_num: int = 0, dpi: int = 150) -> str:
    """Render PDF page to base64 PNG."""
    images = convert_from_path(pdf_path, dpi=dpi, first_page=page_num+1, last_page=page_num+1)
    if not images:
        return None

    buffer = io.BytesIO()
    images[0].save(buffer, format="PNG")
    return base64.standard_b64encode(buffer.getvalue()).decode("utf-8")


def format_text_for_prompt(words: list, max_items: int = 800) -> str:
    """Format extracted text for the prompt."""
    # Sort by y then x (reading order)
    sorted_words = sorted(words, key=lambda w: (w["y"], w["x"]))

    lines = []
    for w in sorted_words[:max_items]:
        lines.append(f'"{w["text"]}" at ({w["x"]}, {w["y"]})')

    result = "\n".join(lines)
    if len(sorted_words) > max_items:
        result += f"\n... and {len(sorted_words) - max_items} more text items"

    return result


def parse_schedule_with_llm(pdf_path: str, client: anthropic.Anthropic) -> dict:
    """Send PDF to Claude for parsing."""
    print(f"Processing: {Path(pdf_path).name}")

    # Extract text
    print("  Extracting text...")
    words = extract_text_with_positions(pdf_path)
    text_content = format_text_for_prompt(words)
    print(f"  Found {len(words)} text items")

    # Render image
    print("  Rendering PDF...")
    image_b64 = render_pdf_to_base64(pdf_path, page_num=0, dpi=150)

    # Build prompt
    prompt = f"""You are analyzing a mechanical equipment schedule from a construction drawing PDF.

I'm providing you with:
1. An image of the PDF (you can see the visual table layouts)
2. Extracted text with exact (x,y) coordinates from PDF vectors - this text is 100% accurate

Your task:
1. Look at the image to understand the table structures
2. Use the text coordinates to identify which values belong to which columns
3. Output structured JSON with ALL equipment from ALL schedules on this sheet

EXTRACTED TEXT WITH COORDINATES:
{text_content}

---

Output a JSON object with this structure:
{{
  "sheet_number": "M-801 or similar",
  "sheet_title": "title from title block",
  "schedules": [
    {{
      "schedule_name": "e.g., SPLIT SYSTEM SCHEDULE",
      "columns": ["list of column headers"],
      "equipment": [
        {{
          "tag": "equipment tag like AC-1",
          "data": {{
            "column_name": "value",
            ...
          }}
        }}
      ]
    }}
  ]
}}

IMPORTANT:
- Extract ALL schedules visible on the sheet
- Extract ALL equipment rows from each schedule
- Use exact text from the extraction (don't paraphrase)
- If a cell is empty, use null
- Include units where shown (CFM, MBH, tons, etc.)

Output ONLY valid JSON, no other text."""

    # Call Claude
    print("  Calling Claude API...")
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=8000,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": "image/png",
                            "data": image_b64
                        }
                    },
                    {
                        "type": "text",
                        "text": prompt
                    }
                ]
            }
        ]
    )

    # Parse response
    response_text = response.content[0].text

    # Try to extract JSON from response
    try:
        # Handle case where response might have markdown code blocks
        if "```json" in response_text:
            json_str = response_text.split("```json")[1].split("```")[0]
        elif "```" in response_text:
            json_str = response_text.split("```")[1].split("```")[0]
        else:
            json_str = response_text

        result = json.loads(json_str.strip())
        print("  Successfully parsed response")
        return result

    except json.JSONDecodeError as e:
        print(f"  Warning: Could not parse JSON: {e}")
        return {"raw_response": response_text, "error": str(e)}


def main():
    # Check for API key
    import os
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("Error: ANTHROPIC_API_KEY environment variable not set")
        print("\nTo use this script:")
        print("  export ANTHROPIC_API_KEY=your_key_here")
        print("  python llm_schedule_parser.py test_files/M-801_*.pdf")
        sys.exit(1)

    client = anthropic.Anthropic(api_key=api_key)

    # Process files
    test_dir = Path("test_files")
    output_dir = test_dir / "llm_parsed"
    output_dir.mkdir(exist_ok=True)

    # Default to schedule files
    if len(sys.argv) > 1:
        pdf_files = [Path(p) for p in sys.argv[1:]]
    else:
        pdf_files = [
            test_dir / "M-801_ MECHANICAL SCHEDULES Rev.3 markup.pdf",
        ]

    for pdf_path in pdf_files:
        if not pdf_path.exists():
            print(f"File not found: {pdf_path}")
            continue

        result = parse_schedule_with_llm(str(pdf_path), client)

        # Save result
        output_file = output_dir / f"{pdf_path.stem}_parsed.json"
        with open(output_file, "w") as f:
            json.dump(result, f, indent=2)
        print(f"  Saved: {output_file}")

        # Print summary
        if "schedules" in result:
            print(f"\n  Found {len(result['schedules'])} schedules:")
            for sched in result["schedules"]:
                equip_count = len(sched.get("equipment", []))
                print(f"    - {sched.get('schedule_name', 'Unknown')}: {equip_count} items")


if __name__ == "__main__":
    main()
