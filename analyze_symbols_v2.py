#!/usr/bin/env python3
"""Analyze HVAC symbols - v2 with better clustering."""

import pdfplumber
from PIL import Image, ImageDraw
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass, field
import json
import re
import math


@dataclass
class BoundingBox:
    x0: float
    y0: float
    x1: float
    y1: float

    @property
    def center(self):
        return ((self.x0 + self.x1) / 2, (self.y0 + self.y1) / 2)

    @property
    def width(self):
        return abs(self.x1 - self.x0)

    @property
    def height(self):
        return abs(self.y1 - self.y0)

    @property
    def area(self):
        return self.width * self.height


def find_text_with_equipment_tags(page):
    """Find text that looks like equipment tags with their positions."""
    words = page.extract_words() or []

    # Equipment tag patterns
    patterns = [
        (r'^(FD-?\d+[A-Z]?)$', 'fire_damper'),
        (r'^(MD-?\d+[A-Z]?)$', 'motor_damper'),
        (r'^(VD-?\d+[A-Z]?)$', 'volume_damper'),
        (r'^(VAV-?\d+[A-Z]?)$', 'vav'),
        (r'^(AHU-?\d+[A-Z]?)$', 'ahu'),
        (r'^(RTU-?\d+[A-Z]?)$', 'rtu'),
        (r'^(FCU-?\d+[A-Z]?)$', 'fcu'),
        (r'^(EF-?\d+[A-Z]?)$', 'exhaust_fan'),
        (r'^(SF-?\d+[A-Z]?)$', 'supply_fan'),
        (r'^(RF-?\d+[A-Z]?)$', 'return_fan'),
        (r'^(CWP-?\d+[A-Z]?)$', 'chw_pump'),
        (r'^(HWP-?\d+[A-Z]?)$', 'hw_pump'),
        (r'^(CH-?\d+[A-Z]?)$', 'chiller'),
        (r'^(B-?\d+[A-Z]?)$', 'boiler'),
        (r'^(AC-?\d+[A-Z]?)$', 'ac_unit'),
        (r'^(CU-?\d+[A-Z]?)$', 'condensing_unit'),
        (r'^(P-?\d+[A-Z]?)$', 'pump'),
        (r'^(V-?\d+[A-Z]?)$', 'valve'),
    ]

    equipment_tags = []
    for word in words:
        text = word['text'].upper().strip()
        for pattern, eq_type in patterns:
            if re.match(pattern, text):
                equipment_tags.append({
                    'tag': text,
                    'type': eq_type,
                    'bbox': BoundingBox(word['x0'], word['top'], word['x1'], word['bottom']),
                    'center': ((word['x0'] + word['x1']) / 2, (word['top'] + word['bottom']) / 2)
                })
                break

    return equipment_tags


def find_geometry_near_point(page, center, radius=100):
    """Find all geometry within radius of a point."""
    cx, cy = center
    nearby = {'lines': [], 'curves': [], 'rects': []}

    for line in (page.lines or []):
        lx = (line['x0'] + line['x1']) / 2
        ly = (line['top'] + line['bottom']) / 2
        if math.sqrt((lx - cx)**2 + (ly - cy)**2) < radius:
            nearby['lines'].append(line)

    for curve in (page.curves or []):
        pts = curve.get('pts', [])
        if pts:
            px = sum(p[0] for p in pts) / len(pts)
            py = sum(p[1] for p in pts) / len(pts)
            if math.sqrt((px - cx)**2 + (py - cy)**2) < radius:
                nearby['curves'].append(curve)

    for rect in (page.rects or []):
        rx = (rect['x0'] + rect['x1']) / 2
        ry = (rect['top'] + rect['bottom']) / 2
        if math.sqrt((rx - cx)**2 + (ry - cy)**2) < radius:
            nearby['rects'].append(rect)

    return nearby


def find_symbol_candidates(page, min_curves=2, max_size=200):
    """Find isolated geometry clusters that look like symbols."""
    candidates = []

    # Look for curve clusters (symbols are often drawn with curves)
    curves = page.curves or []
    used_curves = set()

    for i, curve in enumerate(curves):
        if i in used_curves:
            continue

        pts = curve.get('pts', [])
        if not pts:
            continue

        # Get curve center and bounds
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cx, cy = sum(xs)/len(xs), sum(ys)/len(ys)

        # Find nearby curves
        cluster_curves = [curve]
        cluster_indices = {i}

        for j, other in enumerate(curves):
            if j in used_curves or j == i:
                continue
            other_pts = other.get('pts', [])
            if not other_pts:
                continue
            oxs = [p[0] for p in other_pts]
            oys = [p[1] for p in other_pts]
            ocx, ocy = sum(oxs)/len(oxs), sum(oys)/len(oys)

            # If close enough, add to cluster
            if math.sqrt((cx - ocx)**2 + (cy - ocy)**2) < 50:
                cluster_curves.append(other)
                cluster_indices.add(j)

        if len(cluster_curves) >= min_curves:
            # Calculate cluster bounds
            all_pts = []
            for c in cluster_curves:
                all_pts.extend(c.get('pts', []))

            if all_pts:
                xs = [p[0] for p in all_pts]
                ys = [p[1] for p in all_pts]
                bbox = BoundingBox(min(xs), min(ys), max(xs), max(ys))

                # Filter by size
                if bbox.width < max_size and bbox.height < max_size:
                    used_curves.update(cluster_indices)
                    candidates.append({
                        'bbox': bbox,
                        'center': bbox.center,
                        'curves': len(cluster_curves),
                        'type': 'curve_cluster'
                    })

    return candidates


def visualize_analysis(page, equipment_tags, symbol_candidates, output_path, scale=0.5):
    """Create labeled visualization."""
    width = int(page.width * scale)
    height = int(page.height * scale)

    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Draw all geometry faintly
    for line in (page.lines or []):
        x0, y0 = line['x0'] * scale, line['top'] * scale
        x1, y1 = line['x1'] * scale, line['bottom'] * scale
        draw.line([x0, y0, x1, y1], fill='#cccccc', width=1)

    for curve in (page.curves or []):
        pts = curve.get('pts', [])
        if len(pts) >= 2:
            scaled_pts = [(p[0] * scale, p[1] * scale) for p in pts]
            for i in range(len(scaled_pts) - 1):
                draw.line([scaled_pts[i], scaled_pts[i + 1]], fill='#aaaaaa', width=1)

    # Draw equipment tag locations (green boxes)
    for tag in equipment_tags:
        bbox = tag['bbox']
        x0, y0 = bbox.x0 * scale, bbox.y0 * scale
        x1, y1 = bbox.x1 * scale, bbox.y1 * scale

        # Draw box around tag
        draw.rectangle([x0 - 2, y0 - 2, x1 + 2, y1 + 2], outline='#22c55e', width=2)

        # Draw search radius
        cx, cy = tag['center']
        cx, cy = cx * scale, cy * scale
        draw.ellipse([cx - 50, cy - 50, cx + 50, cy + 50], outline='#22c55e', width=1)

        # Label
        draw.text((x0, y0 - 14), f"{tag['tag']} ({tag['type']})", fill='#166534')

    # Draw symbol candidates (red boxes)
    for cand in symbol_candidates:
        bbox = cand['bbox']
        x0, y0 = bbox.x0 * scale, bbox.y0 * scale
        x1, y1 = bbox.x1 * scale, bbox.y1 * scale
        draw.rectangle([x0, y0, x1, y1], outline='#ef4444', width=2)
        draw.text((x0, y1 + 2), f"curves:{cand['curves']}", fill='#dc2626')

    img.save(output_path)
    return img


def analyze_pdf(pdf_path: str, output_dir: Path):
    """Analyze PDF for equipment symbols."""
    output_dir.mkdir(exist_ok=True)
    stem = Path(pdf_path).stem

    results = {
        'file': Path(pdf_path).name,
        'pages': []
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            print(f"  Page {page_num + 1}:")

            # Find equipment tags in text
            equipment_tags = find_text_with_equipment_tags(page)
            print(f"    Equipment tags found: {len(equipment_tags)}")
            for tag in equipment_tags[:10]:
                print(f"      {tag['tag']} ({tag['type']}) at ({tag['center'][0]:.0f}, {tag['center'][1]:.0f})")

            # Find geometry near each tag
            for tag in equipment_tags:
                nearby = find_geometry_near_point(page, tag['center'], radius=80)
                tag['nearby_geometry'] = {
                    'lines': len(nearby['lines']),
                    'curves': len(nearby['curves']),
                    'rects': len(nearby['rects'])
                }

            # Find symbol candidates
            symbol_candidates = find_symbol_candidates(page)
            print(f"    Symbol candidates (curve clusters): {len(symbol_candidates)}")

            # Visualize
            viz_path = output_dir / f"{stem}_page{page_num + 1}_analysis.png"
            visualize_analysis(page, equipment_tags, symbol_candidates, viz_path)
            print(f"    Saved: {viz_path.name}")

            # Compile results
            page_results = {
                'page': page_num + 1,
                'equipment_tags': [
                    {
                        'tag': t['tag'],
                        'type': t['type'],
                        'x': t['center'][0],
                        'y': t['center'][1],
                        'nearby_geometry': t.get('nearby_geometry', {})
                    }
                    for t in equipment_tags
                ],
                'symbol_candidates': len(symbol_candidates),
                'total_lines': len(page.lines or []),
                'total_curves': len(page.curves or []),
                'total_rects': len(page.rects or [])
            }
            results['pages'].append(page_results)

    # Save JSON results
    json_path = output_dir / f"{stem}_analysis.json"
    with open(json_path, 'w') as f:
        json.dump(results, f, indent=2)

    return results


if __name__ == "__main__":
    test_dir = Path("test_files")
    output_dir = test_dir / "analysis"

    print("=" * 60)
    print("HVAC Symbol Analysis")
    print("=" * 60)

    for pdf_path in sorted(test_dir.glob("*.pdf")):
        print(f"\n{pdf_path.name}")
        print("-" * 60)
        analyze_pdf(str(pdf_path), output_dir)

    print(f"\n{'=' * 60}")
    print(f"Analysis complete. Results in: {output_dir}")
