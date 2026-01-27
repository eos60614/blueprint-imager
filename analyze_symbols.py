#!/usr/bin/env python3
"""Analyze HVAC symbols by clustering geometry and associating text labels."""

import pdfplumber
from PIL import Image, ImageDraw, ImageFont
from pathlib import Path
from collections import defaultdict
from dataclasses import dataclass
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
        return self.x1 - self.x0

    @property
    def height(self):
        return self.y1 - self.y0

    @property
    def area(self):
        return self.width * self.height

    def distance_to(self, other):
        cx1, cy1 = self.center
        cx2, cy2 = other.center
        return math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2)

    def overlaps(self, other, margin=0):
        return not (
            self.x1 + margin < other.x0 or
            other.x1 + margin < self.x0 or
            self.y1 + margin < other.y0 or
            other.y1 + margin < self.y0
        )


@dataclass
class GeometryCluster:
    bbox: BoundingBox
    lines: list
    curves: list
    rects: list
    nearby_text: list = None

    @property
    def geometry_count(self):
        return len(self.lines) + len(self.curves) + len(self.rects)

    def __post_init__(self):
        if self.nearby_text is None:
            self.nearby_text = []


def extract_geometry_with_bounds(page):
    """Extract all geometry with bounding boxes."""
    elements = []

    # Lines
    for line in (page.lines or []):
        x0, x1 = min(line['x0'], line['x1']), max(line['x0'], line['x1'])
        y0, y1 = min(line['top'], line['bottom']), max(line['top'], line['bottom'])
        # Ensure non-zero dimensions
        if x0 == x1:
            x1 = x0 + 1
        if y0 == y1:
            y1 = y0 + 1
        elements.append({
            'type': 'line',
            'bbox': BoundingBox(x0, y0, x1, y1),
            'data': line
        })

    # Curves
    for curve in (page.curves or []):
        pts = curve.get('pts', [])
        if pts:
            xs = [p[0] for p in pts]
            ys = [p[1] for p in pts]
            elements.append({
                'type': 'curve',
                'bbox': BoundingBox(min(xs), min(ys), max(xs), max(ys)),
                'data': curve
            })

    # Rects
    for rect in (page.rects or []):
        elements.append({
            'type': 'rect',
            'bbox': BoundingBox(rect['x0'], rect['top'], rect['x1'], rect['bottom']),
            'data': rect
        })

    return elements


def cluster_geometry(elements, distance_threshold=30):
    """Cluster nearby geometry elements into potential symbols."""
    if not elements:
        return []

    # Simple clustering: merge overlapping/nearby elements
    clusters = []
    used = set()

    for i, elem in enumerate(elements):
        if i in used:
            continue

        # Start new cluster
        cluster_elements = [elem]
        cluster_bbox = elem['bbox']
        used.add(i)

        # Find nearby elements
        changed = True
        while changed:
            changed = False
            for j, other in enumerate(elements):
                if j in used:
                    continue

                # Check if nearby
                expanded_bbox = BoundingBox(
                    cluster_bbox.x0 - distance_threshold,
                    cluster_bbox.y0 - distance_threshold,
                    cluster_bbox.x1 + distance_threshold,
                    cluster_bbox.y1 + distance_threshold
                )

                if expanded_bbox.overlaps(other['bbox']):
                    cluster_elements.append(other)
                    used.add(j)
                    # Expand cluster bbox
                    cluster_bbox = BoundingBox(
                        min(cluster_bbox.x0, other['bbox'].x0),
                        min(cluster_bbox.y0, other['bbox'].y0),
                        max(cluster_bbox.x1, other['bbox'].x1),
                        max(cluster_bbox.y1, other['bbox'].y1)
                    )
                    changed = True

        # Create cluster
        lines = [e['data'] for e in cluster_elements if e['type'] == 'line']
        curves = [e['data'] for e in cluster_elements if e['type'] == 'curve']
        rects = [e['data'] for e in cluster_elements if e['type'] == 'rect']

        clusters.append(GeometryCluster(
            bbox=cluster_bbox,
            lines=lines,
            curves=curves,
            rects=rects
        ))

    return clusters


def extract_text_with_bounds(page):
    """Extract text words with bounding boxes."""
    words = page.extract_words() or []
    text_elements = []

    for word in words:
        text_elements.append({
            'text': word['text'],
            'bbox': BoundingBox(word['x0'], word['top'], word['x1'], word['bottom'])
        })

    return text_elements


def associate_text_with_clusters(clusters, text_elements, max_distance=50):
    """Associate nearby text labels with geometry clusters."""
    for cluster in clusters:
        for text in text_elements:
            if cluster.bbox.distance_to(text['bbox']) < max_distance:
                cluster.nearby_text.append(text['text'])
            elif cluster.bbox.overlaps(text['bbox'], margin=max_distance):
                cluster.nearby_text.append(text['text'])


def identify_symbol_type(cluster):
    """Try to identify what type of HVAC symbol this might be."""
    text = ' '.join(cluster.nearby_text).upper()

    # Equipment tag patterns
    patterns = {
        'valve': r'\b(V-\d+|BV|CV|PRV|BALL|GATE|CHECK)\b',
        'damper': r'\b(FD-?\d*|MD-?\d*|VD-?\d*|DAMPER|FIRE)\b',
        'diffuser': r'\b(SD-?\d*|RD-?\d*|DIFFUSER|GRILLE|REGISTER)\b',
        'vav': r'\b(VAV-?\d*[A-Z]?)\b',
        'pump': r'\b(P-?\d+|CWP-?\d+|HWP-?\d+|PUMP)\b',
        'fan': r'\b(SF-?\d+|EF-?\d+|RF-?\d+|FAN)\b',
        'ahu': r'\b(AHU-?\d+|RTU-?\d+|FCU-?\d+)\b',
        'chiller': r'\b(CH-?\d+|CHILLER)\b',
        'boiler': r'\b(B-?\d+|BOILER)\b',
        'coil': r'\b(HC|CC|COIL|HEATING|COOLING)\b',
        'sensor': r'\b(TS|PS|FS|SENSOR|TEMP|PRESS)\b',
    }

    detected_types = []
    for symbol_type, pattern in patterns.items():
        if re.search(pattern, text):
            detected_types.append(symbol_type)

    # Geometry-based heuristics
    num_curves = len(cluster.curves)
    num_lines = len(cluster.lines)
    num_rects = len(cluster.rects)
    bbox = cluster.bbox

    # Small circular cluster (curves, small area) = valve or fitting
    if num_curves > 2 and bbox.area < 1000 and bbox.width / max(bbox.height, 1) < 2:
        if 'valve' not in detected_types:
            detected_types.append('valve_candidate')

    # Rectangle with curves = equipment box
    if num_rects >= 1 and num_curves > 0 and bbox.area > 5000:
        if not detected_types:
            detected_types.append('equipment_candidate')

    # Parallel lines (ductwork)
    if num_lines >= 4 and num_curves == 0 and bbox.width > 100 or bbox.height > 100:
        if not detected_types:
            detected_types.append('ductwork_candidate')

    return detected_types if detected_types else ['unknown']


def visualize_clusters(page, clusters, output_path, scale=0.5):
    """Create visualization with labeled clusters."""
    width = int(page.width * scale)
    height = int(page.height * scale)

    img = Image.new('RGB', (width, height), 'white')
    draw = ImageDraw.Draw(img)

    # Draw all geometry faintly
    for line in (page.lines or []):
        x0, y0 = line['x0'] * scale, line['top'] * scale
        x1, y1 = line['x1'] * scale, line['bottom'] * scale
        draw.line([x0, y0, x1, y1], fill='#e0e0e0', width=1)

    for curve in (page.curves or []):
        pts = curve.get('pts', [])
        if len(pts) >= 2:
            scaled_pts = [(p[0] * scale, p[1] * scale) for p in pts]
            for i in range(len(scaled_pts) - 1):
                draw.line([scaled_pts[i], scaled_pts[i + 1]], fill='#e0e0e0', width=1)

    # Color map for symbol types
    colors = {
        'valve': '#ef4444',      # red
        'damper': '#f97316',     # orange
        'diffuser': '#eab308',   # yellow
        'vav': '#22c55e',        # green
        'pump': '#3b82f6',       # blue
        'fan': '#8b5cf6',        # purple
        'ahu': '#ec4899',        # pink
        'chiller': '#06b6d4',    # cyan
        'boiler': '#f43f5e',     # rose
        'coil': '#84cc16',       # lime
        'sensor': '#14b8a6',     # teal
        'valve_candidate': '#fca5a5',
        'equipment_candidate': '#93c5fd',
        'ductwork_candidate': '#d1d5db',
        'unknown': '#9ca3af',
    }

    # Draw clusters with bounding boxes
    interesting_clusters = []
    for cluster in clusters:
        # Filter: only show clusters with some complexity
        if cluster.geometry_count < 3:
            continue
        if cluster.bbox.area < 100:
            continue
        # Skip very large clusters (probably background)
        if cluster.bbox.area > page.width * page.height * 0.1:
            continue

        symbol_types = identify_symbol_type(cluster)
        color = colors.get(symbol_types[0], '#9ca3af')

        bbox = cluster.bbox
        x0, y0 = bbox.x0 * scale, bbox.y0 * scale
        x1, y1 = bbox.x1 * scale, bbox.y1 * scale

        # Draw bounding box
        draw.rectangle([x0, y0, x1, y1], outline=color, width=2)

        # Draw label
        label = symbol_types[0]
        if cluster.nearby_text:
            label = f"{cluster.nearby_text[0][:10]}"
        draw.text((x0, y0 - 12), label, fill=color)

        if symbol_types[0] not in ['unknown', 'ductwork_candidate']:
            interesting_clusters.append({
                'bbox': [bbox.x0, bbox.y0, bbox.x1, bbox.y1],
                'types': symbol_types,
                'text': cluster.nearby_text[:5],
                'geometry_count': cluster.geometry_count
            })

    img.save(output_path)
    return interesting_clusters


def analyze_pdf(pdf_path: str, output_dir: Path):
    """Full analysis pipeline for a PDF."""
    output_dir.mkdir(exist_ok=True)
    stem = Path(pdf_path).stem

    results = {
        'file': Path(pdf_path).name,
        'pages': []
    }

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            print(f"  Analyzing page {page_num + 1}...")

            # Extract geometry and text
            elements = extract_geometry_with_bounds(page)
            text_elements = extract_text_with_bounds(page)

            # Cluster geometry
            clusters = cluster_geometry(elements, distance_threshold=20)

            # Associate text with clusters
            associate_text_with_clusters(clusters, text_elements, max_distance=40)

            # Visualize
            viz_path = output_dir / f"{stem}_page{page_num + 1}_symbols.png"
            interesting = visualize_clusters(page, clusters, viz_path, scale=0.5)

            # Summarize
            symbol_counts = defaultdict(int)
            for cluster in clusters:
                for stype in identify_symbol_type(cluster):
                    symbol_counts[stype] += 1

            page_result = {
                'page': page_num + 1,
                'total_clusters': len(clusters),
                'symbol_counts': dict(symbol_counts),
                'identified_symbols': interesting[:20]  # Top 20
            }
            results['pages'].append(page_result)

            print(f"    Found {len(clusters)} clusters, {len(interesting)} identified symbols")
            print(f"    Symbol types: {dict(symbol_counts)}")

    # Save results
    with open(output_dir / f"{stem}_analysis.json", 'w') as f:
        json.dump(results, f, indent=2)

    return results


if __name__ == "__main__":
    test_dir = Path("test_files")
    output_dir = test_dir / "analysis"

    # Analyze most interesting files
    target_files = [
        "M-301_ ANNEX & SERVICE WING LEVEL 1 - HVAC PIPING PLAN Rev.3 markup.pdf",
        "M0.022_ MECHANICAL CONTROL DIAGRAMS Rev.2 markup.pdf",
        "M203_ OVERALL FLOOR PLAN - DUCT WORK - LEVEL 03 Rev.0 markup.pdf",
        "M504_ MECHANICAL DETAILS Rev.1.pdf",
    ]

    for filename in target_files:
        pdf_path = test_dir / filename
        if pdf_path.exists():
            print(f"\nAnalyzing: {filename}")
            analyze_pdf(str(pdf_path), output_dir)

    print(f"\nAnalysis complete. Results saved to: {output_dir}")
