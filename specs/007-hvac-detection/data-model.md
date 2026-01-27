# Data Model: HVAC Component Detection

## Python Dataclasses

### Core Extraction Models

```python
from dataclasses import dataclass, field
from typing import Optional
from enum import Enum

class DetectionMethod(Enum):
    TEXT = "text"
    GEOMETRY = "geometry"
    ML = "ml"
    HYBRID = "hybrid"

class ComponentType(Enum):
    FIRE_DAMPER = "fire_damper"
    VOLUME_DAMPER = "volume_damper"
    VAV_BOX = "vav_box"
    DIFFUSER_SUPPLY = "diffuser_supply"
    DIFFUSER_RETURN = "diffuser_return"
    EXHAUST_FAN = "exhaust_fan"
    UNIT_HEATER = "unit_heater"
    DUCTWORK = "ductwork"
    FLEX_DUCT = "flex_duct"
    UNKNOWN = "unknown"

@dataclass
class BoundingBox:
    """Pixel coordinates of detected region."""
    x: float          # Left edge
    y: float          # Top edge
    width: float
    height: float

    @property
    def x2(self) -> float:
        return self.x + self.width

    @property
    def y2(self) -> float:
        return self.y + self.height

    @property
    def center(self) -> tuple[float, float]:
        return (self.x + self.width / 2, self.y + self.height / 2)

    def iou(self, other: "BoundingBox") -> float:
        """Calculate intersection over union."""
        x1 = max(self.x, other.x)
        y1 = max(self.y, other.y)
        x2 = min(self.x2, other.x2)
        y2 = min(self.y2, other.y2)

        if x2 <= x1 or y2 <= y1:
            return 0.0

        intersection = (x2 - x1) * (y2 - y1)
        union = (self.width * self.height) + (other.width * other.height) - intersection
        return intersection / union if union > 0 else 0.0
```

### Text Extraction Models

```python
@dataclass
class ExtractedChar:
    """Single character from PDF text extraction."""
    char: str
    x: float
    y: float
    width: float
    height: float
    font_size: float
    rotation: float = 0.0  # Degrees

@dataclass
class ExtractedText:
    """Clustered text from PDF."""
    text: str
    bbox: BoundingBox
    confidence: float = 1.0
    rotation: float = 0.0
    chars: list[ExtractedChar] = field(default_factory=list)

    @property
    def is_equipment_tag(self) -> bool:
        """Check if text matches equipment tag pattern."""
        import re
        patterns = [
            r'^FD-?\d+',      # Fire damper
            r'^VD-?\d+',      # Volume damper
            r'^MD-?\d+',      # Manual damper
            r'^VAV-?\d+[A-Z]?', # VAV box
            r'^SD-?\d+',      # Supply diffuser
            r'^RD-?\d+',      # Return diffuser
            r'^CD-?\d+',      # Ceiling diffuser
            r'^LD-?\d+',      # Linear diffuser
            r'^EF-?\d+',      # Exhaust fan
            r'^UH-?\d+',      # Unit heater
        ]
        return any(re.match(p, self.text, re.IGNORECASE) for p in patterns)
```

### Geometry Extraction Models

```python
@dataclass
class Line:
    """Line segment from PDF geometry."""
    x1: float
    y1: float
    x2: float
    y2: float
    stroke_width: float = 1.0

    @property
    def length(self) -> float:
        return ((self.x2 - self.x1)**2 + (self.y2 - self.y1)**2)**0.5

    @property
    def angle(self) -> float:
        """Angle in degrees from horizontal."""
        import math
        return math.degrees(math.atan2(self.y2 - self.y1, self.x2 - self.x1))

@dataclass
class Rectangle:
    """Rectangle from PDF geometry."""
    x: float
    y: float
    width: float
    height: float
    stroke_width: float = 1.0
    fill: Optional[str] = None

@dataclass
class Curve:
    """Polyline or bezier curve from PDF."""
    points: list[tuple[float, float]]
    closed: bool = False
    stroke_width: float = 1.0

@dataclass
class ExtractedGeometry:
    """All geometry from a PDF page."""
    lines: list[Line] = field(default_factory=list)
    rectangles: list[Rectangle] = field(default_factory=list)
    curves: list[Curve] = field(default_factory=list)
```

### Detection Models

```python
@dataclass
class Detection:
    """Single component detection."""
    component_type: ComponentType
    bbox: BoundingBox
    confidence: float
    method: DetectionMethod
    tag: Optional[str] = None  # Equipment tag if extracted
    tile_index: Optional[int] = None  # Source tile for ML detections

    def to_dict(self) -> dict:
        return {
            "component_type": self.component_type.value,
            "bbox": {
                "x": self.bbox.x,
                "y": self.bbox.y,
                "width": self.bbox.width,
                "height": self.bbox.height,
            },
            "confidence": self.confidence,
            "method": self.method.value,
            "tag": self.tag,
        }

@dataclass
class DetectionResult:
    """All detections for a page/drawing."""
    page_number: int
    detections: list[Detection] = field(default_factory=list)
    processing_time_ms: float = 0.0

    def by_type(self, component_type: ComponentType) -> list[Detection]:
        return [d for d in self.detections if d.component_type == component_type]

    def count_by_type(self) -> dict[ComponentType, int]:
        counts = {}
        for d in self.detections:
            counts[d.component_type] = counts.get(d.component_type, 0) + 1
        return counts
```

### Schedule Models

```python
@dataclass
class ScheduleEntry:
    """Single entry from mechanical schedule."""
    tag: str
    component_type: ComponentType
    description: Optional[str] = None
    size: Optional[str] = None
    cfm: Optional[int] = None  # Airflow
    manufacturer: Optional[str] = None
    model: Optional[str] = None

@dataclass
class MechanicalSchedule:
    """Parsed mechanical schedule."""
    title: str
    entries: list[ScheduleEntry] = field(default_factory=list)
    source_bbox: Optional[BoundingBox] = None  # Location in PDF

    def count_by_type(self) -> dict[ComponentType, int]:
        counts = {}
        for e in self.entries:
            counts[e.component_type] = counts.get(e.component_type, 0) + 1
        return counts

@dataclass
class ValidationResult:
    """Cross-validation of detections vs schedule."""
    component_type: ComponentType
    schedule_count: int
    detected_count: int
    matched_tags: list[str] = field(default_factory=list)
    missing_tags: list[str] = field(default_factory=list)
    extra_detections: int = 0

    @property
    def is_valid(self) -> bool:
        return self.schedule_count == self.detected_count and not self.missing_tags
```

### Hound (Model) Configuration

```python
@dataclass
class HoundConfig:
    """Configuration for a single detection model."""
    name: str
    component_type: ComponentType
    model_path: str
    confidence_threshold: float = 0.5
    nms_threshold: float = 0.4
    enabled: bool = True

    @classmethod
    def from_dict(cls, d: dict) -> "HoundConfig":
        return cls(
            name=d["name"],
            component_type=ComponentType(d["component_type"]),
            model_path=d["model_path"],
            confidence_threshold=d.get("confidence_threshold", 0.5),
            nms_threshold=d.get("nms_threshold", 0.4),
            enabled=d.get("enabled", True),
        )

@dataclass
class HoundPackConfig:
    """Configuration for all detection models."""
    hounds: list[HoundConfig] = field(default_factory=list)
    tile_size: int = 1024
    tile_overlap: int = 128
    rasterize_dpi: int = 300

    def active_hounds(self) -> list[HoundConfig]:
        return [h for h in self.hounds if h.enabled]

    def hounds_for_types(self, types: list[ComponentType]) -> list[HoundConfig]:
        return [h for h in self.hounds if h.enabled and h.component_type in types]
```

## Database Schema Additions

```sql
-- Detection jobs (extends existing jobs table pattern)
CREATE TABLE detection_jobs (
    id SERIAL PRIMARY KEY,
    upload_id INTEGER REFERENCES uploads(id),
    status TEXT DEFAULT 'pending',  -- pending, extracting, detecting, validating, completed, failed
    extraction_complete BOOLEAN DEFAULT FALSE,
    detection_complete BOOLEAN DEFAULT FALSE,
    validation_complete BOOLEAN DEFAULT FALSE,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Extracted text items
CREATE TABLE extracted_texts (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES detection_jobs(id),
    page_number INTEGER NOT NULL,
    text TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    rotation FLOAT DEFAULT 0,
    is_equipment_tag BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_extracted_texts_job ON extracted_texts(job_id);
CREATE INDEX idx_extracted_texts_tag ON extracted_texts(is_equipment_tag);

-- Component detections
CREATE TABLE detections (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES detection_jobs(id),
    page_number INTEGER NOT NULL,
    component_type TEXT NOT NULL,
    x FLOAT NOT NULL,
    y FLOAT NOT NULL,
    width FLOAT NOT NULL,
    height FLOAT NOT NULL,
    confidence FLOAT NOT NULL,
    method TEXT NOT NULL,  -- text, geometry, ml, hybrid
    tag TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_detections_job ON detections(job_id);
CREATE INDEX idx_detections_type ON detections(component_type);

-- Mechanical schedules
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES detection_jobs(id),
    page_number INTEGER,
    title TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Schedule entries
CREATE TABLE schedule_entries (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    tag TEXT NOT NULL,
    component_type TEXT NOT NULL,
    description TEXT,
    size TEXT,
    cfm INTEGER,
    manufacturer TEXT,
    model TEXT
);
CREATE INDEX idx_schedule_entries_schedule ON schedule_entries(schedule_id);

-- Validation results
CREATE TABLE validation_results (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES detection_jobs(id),
    component_type TEXT NOT NULL,
    schedule_count INTEGER NOT NULL,
    detected_count INTEGER NOT NULL,
    matched_tags TEXT,  -- JSON array
    missing_tags TEXT,  -- JSON array
    extra_detections INTEGER DEFAULT 0,
    is_valid BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_validation_job ON validation_results(job_id);
```

## API Request/Response Types

### Text Extraction

```typescript
// POST /api/extract/text
interface ExtractTextRequest {
  uploadId: number;
  pages?: number[];  // Optional, defaults to all
}

interface ExtractTextResponse {
  jobId: number;
  texts: {
    pageNumber: number;
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
    isEquipmentTag: boolean;
  }[];
}
```

### Component Detection

```typescript
// POST /api/detect/components
interface DetectComponentsRequest {
  uploadId: number;
  pages?: number[];
  componentTypes?: string[];  // Filter to specific types
  useSchedule?: boolean;  // Enable schedule-driven detection
}

interface DetectComponentsResponse {
  jobId: number;
  status: "pending" | "processing" | "completed" | "failed";
  detections: {
    pageNumber: number;
    componentType: string;
    bbox: { x: number; y: number; width: number; height: number };
    confidence: number;
    method: "text" | "geometry" | "ml" | "hybrid";
    tag?: string;
  }[];
  countsByType: Record<string, number>;
}
```

### Validation

```typescript
// POST /api/validate
interface ValidateRequest {
  jobId: number;  // Detection job ID
}

interface ValidateResponse {
  jobId: number;
  results: {
    componentType: string;
    scheduleCount: number;
    detectedCount: number;
    matchedTags: string[];
    missingTags: string[];
    extraDetections: number;
    isValid: boolean;
  }[];
  overallValid: boolean;
  discrepancyCount: number;
}
```

## File Structure

```
src/
├── extraction/
│   ├── __init__.py
│   ├── text_extractor.py      # PDF text extraction + clustering
│   ├── geometry_extractor.py  # PDF vector geometry extraction
│   └── schedule_parser.py     # Mechanical schedule parsing
├── detection/
│   ├── __init__.py
│   ├── hound.py               # Single model wrapper
│   ├── hound_pack.py          # Multi-model orchestrator
│   ├── tiler.py               # PDF → detection tiles
│   └── merger.py              # Detection merging + NMS
├── models/
│   ├── extraction.py          # Text, geometry dataclasses
│   ├── detection.py           # Detection, result dataclasses
│   ├── schedule.py            # Schedule dataclasses
│   └── validation.py          # Validation dataclasses
└── api/
    ├── extract.py             # Extraction endpoints
    ├── detect.py              # Detection endpoints
    └── validate.py            # Validation endpoints
```
