# Research Findings: PDF Drawing to Image Converter

## PDF to Image Conversion at 600 DPI

**Decision**: pdf2image library with Poppler backend  
**Rationale**: 
- Native support for DPI settings via `dpi` parameter
- Maintains quality during rasterization
- Handles large engineering drawings efficiently
- Widely used in production systems

**Alternatives Considered**:
- PyMuPDF: Good but less straightforward DPI control
- Wand/ImageMagick: Heavier dependency, more complex setup
- Camelot/PDFPlumber: Focused on text extraction, not ideal for drawings

**Implementation Notes**:
```python
from pdf2image import convert_from_path
images = convert_from_path('drawing.pdf', dpi=600, fmt='png')
```

## Procore API Integration

**Decision**: OAuth 2.0 with authorization code flow  
**Rationale**:
- Procore requires OAuth for API access
- Sandbox environment available for development
- Well-documented REST API

**Key Endpoints**:
- Authorization: `https://login-sandbox.procore.com/oauth/authorize`
- Token: `https://login-sandbox.procore.com/oauth/token`
- Drawings API: `https://sandbox.procore.com/rest/v1.0/projects/{project_id}/drawings`

**M-Series Filtering**:
- Use query parameter: `filters[drawing_number]=M*`
- Or post-process: filter where drawing_number starts with 'M'

## Image Tiling with Overlap

**Decision**: Custom tiling using Pillow (PIL)  
**Rationale**:
- Full control over tile size and overlap
- Efficient memory usage with crop operations
- No external ML dependencies needed

**Algorithm**:
```python
def tile_image(image, tile_size=1920, stride=1670):
    # stride = tile_size - overlap
    # overlap = tile_size - stride = 1920 - 1670 = 250px (~13%)
    tiles = []
    for y in range(0, image.height - tile_size + 1, stride):
        for x in range(0, image.width - tile_size + 1, stride):
            tile = image.crop((x, y, x + tile_size, y + tile_size))
            tiles.append(tile)
    return tiles
```

## YOLO Training Image Requirements

**Decision**: PNG format, RGB, 1920×1920 pixels  
**Rationale**:
- PNG preserves quality (lossless)
- RGB standard for YOLO (not RGBA)
- 1920 is common YOLO training size
- Avoids resize operations during training

**Best Practices**:
- Consistent image dimensions
- No transparency channel
- Maintain aspect ratio when possible
- Include edge tiles even if partially filled

## ZIP File Generation

**Decision**: Python zipfile with compression  
**Rationale**:
- Built-in Python library, no dependencies
- Supports streaming for large files
- ZIP64 for files >4GB

**Implementation**:
```python
import zipfile
from pathlib import Path

def create_zip(image_paths, output_path):
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        for image_path in image_paths:
            zf.write(image_path, Path(image_path).name)
```

## Additional Libraries

**FastAPI**: Modern async web framework for API  
**Click**: CLI framework for command-line interface  
**SQLite**: Lightweight database for job tracking  
**httpx**: Async HTTP client for Procore API  
**python-multipart**: File upload handling  

## Performance Considerations

- Process PDFs sequentially to manage memory
- Use generator patterns for large image sets
- Implement progress tracking for long operations
- Consider multiprocessing for CPU-bound tiling operations

## Security Considerations

- Store OAuth tokens securely (environment variables)
- Validate uploaded PDFs (file type, size limits)
- Sanitize filenames to prevent path traversal
- Use temporary directories for processing

---
*Research completed: 2025-09-12*