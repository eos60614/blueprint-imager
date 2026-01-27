# Feature Specification: HVAC Component Detection

## Overview

Detect and locate HVAC components (fire dampers, volume dampers, diffusers, VAVs, duct runs, etc.) from CAD-exported mechanical blueprint PDFs. Uses a three-layer extraction strategy: text extraction, geometry extraction, then ML-based object detection.

## User Story

As a mechanical engineer or estimator, I want to automatically extract HVAC component locations and counts from blueprint PDFs so that I can validate designs, generate material lists, and reduce manual counting errors.

## Input Specifications

- **Format**: CAD-exported PDFs (AutoCAD, Revit, etc.)
- **Size**: ARCH E (42" x 30") typical, varies
- **Content**: Mechanical floor plans with HVAC equipment, ductwork, and schedules
- **Key insight**: CAD exports preserve vector data and text coordinates

## Three-Layer Detection Strategy

### Layer 1: Text Extraction (Highest Priority)

CAD exports preserve text as positioned text objects. Extract equipment tags directly.

**Target patterns:**
- Fire dampers: `FD-\d+`, `FD\d+`
- Volume dampers: `VD-\d+`, `MD-\d+`
- VAV boxes: `VAV-\d+[A-Z]?`
- Exhaust fans: `EF-\d+`
- Diffusers: `SD-\d+`, `CD-\d+`, `LD-\d+`
- Unit heaters: `UH-\d+`

**Challenges:**
- Text often "exploded" into individual characters
- Requires spatial clustering (Y-coordinate buckets, X-gap merging)

**Output:** Component tag with bounding box coordinates

### Layer 2: Geometry Extraction

Extract vector geometry that represents physical elements.

**Targets:**
- Ductwork: Parallel lines or rectangles
- Equipment symbols: Consistent geometric fingerprints
- Connection points: Line intersections

**Output:** Geometric primitives with classification hints

### Layer 3: Object Detection (ML Fallback)

YOLOv8 single-class detectors ("hound pack") for components that can't be extracted.

**Architecture:**
- One model per component type (not multi-class)
- Same architecture, input/output format across all hounds
- Independent training, hot-swappable

**Pipeline:**
```
PDF → Rasterize (300 DPI) → Tile (1024x1024, overlap) → Run hounds → Merge detections
```

**Training requirements per hound:**
- 100-200 annotated instances minimum
- YOLOv8x base model
- 100 epochs, 1024px input size

## Schedule-Driven Detection

Mechanical schedules serve as ground truth manifests.

**Workflow:**
1. Extract/OCR mechanical schedule from drawing
2. Parse component types and quantities
3. Activate only relevant detection hounds
4. Cross-validate: schedule says 8 FDs, found 7 → flag discrepancy

**Benefits:**
- Reduces false positives (won't "find" components not on schedule)
- Validates detection completeness
- Tag locations hint at detection regions

## Acceptance Criteria

### Layer 1: Text Extraction
- [ ] Extract positioned text from CAD PDF
- [ ] Cluster exploded characters into words
- [ ] Match equipment tag patterns via regex
- [ ] Return tag + bounding box coordinates
- [ ] Handle rotated text (90°, 180°, 270°)

### Layer 2: Geometry Extraction
- [ ] Extract line segments, rectangles, curves
- [ ] Identify parallel line pairs (potential ductwork)
- [ ] Identify closed polygons (potential symbols)
- [ ] Export geometry with coordinates

### Layer 3: Object Detection
- [ ] Tile PDF at configurable DPI and tile size
- [ ] Run single-class YOLO models independently
- [ ] Merge overlapping detections (NMS)
- [ ] Return detections with confidence scores
- [ ] Support adding/removing hounds without code changes

### Schedule Integration
- [ ] Parse mechanical schedule table
- [ ] Extract component types and counts
- [ ] Validate detection counts against schedule
- [ ] Generate discrepancy report

### API Integration
- [ ] POST /api/extract/text - Extract text with coordinates
- [ ] POST /api/extract/geometry - Extract vector geometry
- [ ] POST /api/detect/components - Run hound pack
- [ ] POST /api/schedule/parse - Parse mechanical schedule
- [ ] POST /api/validate - Cross-validate detections vs schedule

## Hardware Requirements

- **Training**: NVIDIA GPU with 24GB+ VRAM (5090 with 32GB ideal)
- **Inference**: NVIDIA GPU with 8GB+ VRAM (can batch on CPU if needed)
- **Storage**: ~500MB per trained hound model

## Component Types (Initial Set)

| Component | Tag Pattern | Detection Method |
|-----------|-------------|------------------|
| Fire Damper | FD-### | Text + ML |
| Volume Damper | VD-###, MD-### | Text + ML |
| VAV Box | VAV-###A/B | Text + ML |
| Diffuser (Supply) | SD-### | Text + ML |
| Diffuser (Return) | RD-### | Text + ML |
| Exhaust Fan | EF-### | Text + ML |
| Unit Heater | UH-### | Text + ML |
| Ductwork | N/A | Geometry + ML |
| Flex Duct | N/A | ML only |

## Non-Goals (v1)

- 3D model generation
- BIM integration
- Real-time video detection
- Non-HVAC MEP systems (electrical, plumbing)

## Dependencies

- pdfplumber (text/geometry extraction)
- ultralytics (YOLOv8)
- OpenCV (image processing)
- pytesseract (OCR fallback for rasterized schedules)

## Success Metrics

- Text extraction accuracy: >95% for non-exploded text
- Character clustering accuracy: >90% for exploded text
- Detection recall: >85% per component type
- Detection precision: >80% per component type
- Schedule validation: Flag 100% of count mismatches
