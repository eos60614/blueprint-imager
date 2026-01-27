# Implementation Plan: HVAC Component Detection

## Overview

Three-phase implementation: extraction layer, detection layer, validation layer. Uses existing Roboflow integration for annotation and model training.

## Phase 1: Text Extraction Layer

**Goal:** Extract equipment tags directly from CAD PDFs

### Tasks

1. **Text Extractor Service** (`src/extraction/text_extractor.py`)
   - Use pdfplumber to extract character-level text with coordinates
   - Implement character clustering algorithm:
     - Group by Y-coordinate (±2pt tolerance)
     - Merge X-adjacent chars (gap < avg char width)
   - Handle rotated text (0°, 90°, 180°, 270°)
   - Return `ExtractedText` objects with bounding boxes

2. **Equipment Tag Matcher**
   - Regex patterns for common HVAC tags
   - Configurable pattern list (don't hardcode)
   - Flag matches with `is_equipment_tag = True`

3. **Text Extraction API** (`src/api/extract.py`)
   - `POST /api/extract/text` endpoint
   - Accept uploadId, optional page filter
   - Return texts with coordinates and tag flags

4. **Database Storage**
   - Create `extracted_texts` table
   - Store for later cross-validation

### Deliverables
- [ ] `TextExtractor` class with clustering
- [ ] Equipment tag regex matching
- [ ] `/api/extract/text` endpoint
- [ ] Unit tests for clustering edge cases

### Estimated Effort: 2-3 days

---

## Phase 2: Geometry Extraction Layer

**Goal:** Extract vector geometry for ductwork and symbol detection

### Tasks

1. **Geometry Extractor Service** (`src/extraction/geometry_extractor.py`)
   - Extract lines, rectangles, curves from pdfplumber
   - Calculate line angles and lengths
   - Identify parallel line pairs (potential ductwork)
   - Identify closed polygons (potential symbols)

2. **Ductwork Detection**
   - Find parallel line pairs within distance threshold
   - Group into duct runs
   - Calculate duct dimensions

3. **Geometry API** (`src/api/extract.py`)
   - `POST /api/extract/geometry` endpoint
   - Return structured geometry data

### Deliverables
- [ ] `GeometryExtractor` class
- [ ] Parallel line detection algorithm
- [ ] `/api/extract/geometry` endpoint
- [ ] Visualization output for debugging

### Estimated Effort: 2-3 days

---

## Phase 3: Detection Layer (Hound Pack)

**Goal:** ML-based detection for components not extractable via text/geometry

### Training Workflow (Roboflow)

1. **Dataset Preparation**
   - Use existing tile generation (Blueprint Imager)
   - Configure for detection: 1024x1024, 300 DPI, 128px overlap
   - Push tiles to Roboflow via existing `/api/roboflow/upload`

2. **Annotation in Roboflow**
   - Create one project per component type (single-class)
   - Annotate 100-200 instances per class
   - Use Roboflow's annotation tools

3. **Training in Roboflow**
   - Train YOLOv8 models directly in Roboflow
   - Export trained weights (.pt files)
   - Download to `detection/hounds/` directory

### Hound Pack Implementation

1. **Hound Wrapper** (`src/detection/hound.py`)
   ```python
   class Hound:
       def __init__(self, config: HoundConfig):
           self.model = YOLO(config.model_path)
           self.config = config

       def detect(self, image: np.ndarray) -> list[Detection]:
           results = self.model.predict(image, conf=self.config.confidence_threshold)
           return self._parse_results(results)
   ```

2. **Hound Pack Orchestrator** (`src/detection/hound_pack.py`)
   - Load all enabled hounds from config
   - Run hounds in parallel (GPU batching)
   - Collect and tag detections by source hound

3. **Detection Tiler** (`src/detection/tiler.py`)
   - Separate from existing ImageTiler (different params)
   - 1024x1024 tiles, 128px overlap
   - 300 DPI rasterization
   - Track tile origins for coordinate mapping

4. **Detection Merger** (`src/detection/merger.py`)
   - Map tile coordinates to page coordinates
   - Apply NMS per component type
   - Merge cross-tile detections

5. **Detection API** (`src/api/detect.py`)
   - `POST /api/detect/components` endpoint
   - Accept component type filters
   - Return detections with confidence scores

### Deliverables
- [ ] `Hound` class wrapping YOLO model
- [ ] `HoundPack` orchestrator
- [ ] Detection-specific tiler
- [ ] NMS and tile merging
- [ ] `/api/detect/components` endpoint
- [ ] Hound configuration file format

### Estimated Effort: 5-7 days (excluding annotation time)

---

## Phase 4: Schedule Parser

**Goal:** Extract mechanical schedules for validation

### Tasks

1. **Schedule Detector**
   - Identify schedule tables in drawings
   - Common locations: right side, title block area
   - Look for headers: "MECHANICAL SCHEDULE", "DIFFUSER SCHEDULE", etc.

2. **Table Parser**
   - Extract table structure from geometry (lines forming grid)
   - Or use text clustering to identify rows/columns
   - Map headers to columns

3. **Schedule API** (`src/api/schedule.py`)
   - `POST /api/schedule/parse` endpoint
   - Return structured schedule data

### Deliverables
- [ ] Schedule region detector
- [ ] Table structure parser
- [ ] `/api/schedule/parse` endpoint
- [ ] Database storage for schedules

### Estimated Effort: 3-4 days

---

## Phase 5: Validation Layer

**Goal:** Cross-validate detections against schedules

### Tasks

1. **Validation Service** (`src/services/validator.py`)
   - Compare detection counts to schedule counts
   - Match detected tags to schedule entries
   - Identify missing and extra detections

2. **Validation API** (`src/api/validate.py`)
   - `POST /api/validate` endpoint
   - Return detailed discrepancy report

3. **Frontend Integration**
   - Display validation results
   - Highlight discrepancies on drawing
   - Allow manual review/correction

### Deliverables
- [ ] `Validator` service
- [ ] `/api/validate` endpoint
- [ ] Validation report format
- [ ] Frontend validation UI

### Estimated Effort: 2-3 days

---

## Phase 6: Integration & Orchestration

**Goal:** Unified pipeline from PDF to validated detection

### Tasks

1. **Detection Job Service**
   - Extend job pattern from Blueprint Imager
   - Track extraction → detection → validation stages
   - Progress reporting per stage

2. **Schedule-Driven Detection**
   - Parse schedule first
   - Activate only relevant hounds
   - Use tag locations as attention hints

3. **Unified API** (`src/api/detect.py`)
   - Single endpoint for full pipeline
   - Options for partial runs (extraction only, etc.)

### Deliverables
- [ ] `DetectionJobService`
- [ ] Orchestration logic
- [ ] Unified detection endpoint
- [ ] Progress tracking

### Estimated Effort: 2-3 days

---

## Roboflow Integration Details

### Existing Integration (Blueprint Imager)

```python
# Already implemented in src/services/roboflow_client.py
class RoboflowClient:
    def upload_image(self, image_path, split="train"): ...
    def upload_batch(self, images, splits): ...
```

### New Projects Needed in Roboflow

Create separate projects for single-class detection:
- `blueprint-fire-dampers`
- `blueprint-volume-dampers`
- `blueprint-vav-boxes`
- `blueprint-diffusers`
- `blueprint-exhaust-fans`
- etc.

### Workflow

```
1. Convert PDF to tiles (existing Blueprint Imager)
2. Upload tiles to Roboflow project (existing API)
3. Annotate in Roboflow UI
4. Train in Roboflow (YOLOv8)
5. Export model weights
6. Place in detection/hounds/{component}.pt
7. Configure in hound_pack.yaml
```

### Hound Pack Configuration

```yaml
# config/hound_pack.yaml
tile_size: 1024
tile_overlap: 128
rasterize_dpi: 300

hounds:
  - name: fire_damper
    component_type: fire_damper
    model_path: detection/hounds/fire_damper.pt
    confidence_threshold: 0.5
    enabled: true

  - name: volume_damper
    component_type: volume_damper
    model_path: detection/hounds/volume_damper.pt
    confidence_threshold: 0.5
    enabled: true

  # Add more as trained...
```

---

## Testing Strategy

### Unit Tests
- Text clustering algorithm
- Regex pattern matching
- Coordinate transformation (tile → page)
- NMS algorithm
- Schedule parsing

### Integration Tests
- Full extraction pipeline on sample PDFs
- Detection pipeline with mock models
- Validation against known schedules

### Validation Tests
- Run on held-out drawings
- Compare to manual counts
- Measure precision/recall per component type

---

## Timeline Summary

| Phase | Description | Effort |
|-------|-------------|--------|
| 1 | Text Extraction | 2-3 days |
| 2 | Geometry Extraction | 2-3 days |
| 3 | Detection (Hound Pack) | 5-7 days |
| 4 | Schedule Parser | 3-4 days |
| 5 | Validation Layer | 2-3 days |
| 6 | Integration | 2-3 days |
| **Total** | | **16-23 days** |

*Note: Annotation time in Roboflow is not included. Budget 2-4 hours per component type for initial annotation.*

---

## First Steps (Immediate)

1. **Test text extraction** on a sample mechanical drawing
   ```python
   import pdfplumber
   with pdfplumber.open("sample.pdf") as pdf:
       page = pdf.pages[0]
       print(page.chars[:20])  # See what's preserved
   ```

2. **Test geometry extraction** on same drawing
   ```python
   print(len(page.lines), "lines")
   print(len(page.rects), "rectangles")
   ```

3. **Create first Roboflow project** for highest-value component (fire dampers?)

4. **Generate training tiles** using Blueprint Imager
   - Configure: 1024x1024, 300 DPI
   - Upload to Roboflow project
