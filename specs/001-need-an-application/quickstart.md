# Quickstart Guide: PDF Drawing to Image Converter

## Prerequisites

- Python 3.11+
- Poppler utilities (for PDF processing)
- 10GB+ free disk space for image processing

## Installation

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y poppler-utils

# Clone repository
git clone https://github.com/eos60614/blueprint-imager.git
cd blueprint-imager

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install Python dependencies
pip install -r requirements.txt

# Initialize database
python -m src.cli.main init-db
```

## Configuration

Create a `.env` file in the project root:

```bash
# Procore OAuth (Development Sandbox)
PROCORE_CLIENT_ID="RFLeKXReUoqaHmIX6nCSOJ_FCZeBt6GU1WH9hT0ltDc"
PROCORE_CLIENT_SECRET="lJaoBeu4FrbKb_CuGiqJkUQveLxT7uhS-y8dYMlczdI"
PROCORE_REDIRECT_URI="urn:ietf:wg:oauth:2.0:oob"
PROCORE_API_BASE_URL="https://sandbox.procore.com"
PROCORE_AUTH_BASE_URL="https://login-sandbox.procore.com"
PROCORE_COMPANY_ID="4276435"

# Application settings
DPI=600
TILE_SIZE=1920
TILE_OVERLAP=250
MAX_FILE_SIZE_MB=500
STORAGE_PATH=./storage
```

## Quick Test - CLI Mode

### 1. Convert a Single PDF

```bash
# Upload and convert a PDF to tiled images
python -m src.cli.main convert sample.pdf --output-dir ./output

# Expected output:
# ✓ PDF loaded: 5 pages
# ✓ Converting page 1/5 at 600 DPI...
# ✓ Converting page 2/5 at 600 DPI...
# ✓ Tiling images (1920x1920 with 13% overlap)...
# ✓ Generated 47 tiles total
# ✓ Creating ZIP archive...
# ✓ Output saved to: ./output/sample_tiles.zip
```

### 2. Fetch and Convert M-Series from Procore

```bash
# Authenticate with Procore
python -m src.cli.main procore-auth

# List available M-series drawings
python -m src.cli.main procore-list --project-id 123456

# Convert M-series drawings
python -m src.cli.main procore-convert --project-id 123456 --series M

# Expected output:
# ✓ Authenticated with Procore
# ✓ Found 12 M-series drawings
# ✓ Downloading M-101.pdf...
# ✓ Downloading M-102.pdf...
# ✓ Processing 12 documents...
# ✓ Generated 523 tiles total
# ✓ Output saved to: ./output/procore_m_series.zip
```

## Quick Test - API Mode

### 1. Start the API Server

```bash
python -m src.cli.main serve --port 8000

# Or using uvicorn directly:
uvicorn src.api.main:app --reload --port 8000
```

### 2. Upload and Convert via API

```bash
# Upload a PDF
curl -X POST http://localhost:8000/upload \
  -F "file=@sample.pdf" \
  -F "drawing_number=M-101"

# Response:
# {
#   "id": "abc123",
#   "filename": "sample.pdf",
#   "page_count": 5,
#   "status": "pending"
# }

# Start conversion
curl -X POST http://localhost:8000/convert \
  -H "Content-Type: application/json" \
  -d '{"document_ids": ["abc123"]}'

# Response:
# {
#   "id": "job456",
#   "status": "queued",
#   "total_documents": 1
# }

# Check status
curl http://localhost:8000/status/job456

# Response:
# {
#   "id": "job456",
#   "status": "completed",
#   "progress_percentage": 100,
#   "processed_pages": 5
# }

# Download results
curl http://localhost:8000/download/job456 -o results.zip
```

## Validation Checklist

### Basic Functionality
- [ ] PDF uploads successfully
- [ ] Images generated at 600 DPI
- [ ] PNG format with RGB color mode
- [ ] Tiles are exactly 1920×1920 pixels
- [ ] ~13% overlap between tiles (250px with 1670px stride)
- [ ] Full-page images archived alongside tiles
- [ ] ZIP file contains all images

### Procore Integration  
- [ ] OAuth authentication works
- [ ] M-series drawings filtered correctly
- [ ] Downloads from Procore successful
- [ ] Batch processing handles multiple documents

### Performance
- [ ] Large PDFs (100+ pages) process without memory errors
- [ ] Progress tracking updates during processing
- [ ] Batch jobs can run overnight without timeout

### Data Management
- [ ] Uploaded files deleted when requested
- [ ] Generated images persist until deleted
- [ ] Job status tracked accurately
- [ ] Database queries perform efficiently

## Troubleshooting

### Common Issues

**"Poppler not found" error**
```bash
# Install poppler
sudo apt-get install poppler-utils
# Or on Mac:
brew install poppler
```

**"Out of memory" during processing**
```bash
# Increase process limits
ulimit -v unlimited
# Or process fewer pages at once
python -m src.cli.main convert large.pdf --batch-size 10
```

**"OAuth error" with Procore**
```bash
# Check credentials in .env
# Ensure redirect URI matches Procore app settings
# Try re-authenticating:
python -m src.cli.main procore-auth --reset
```

## Performance Testing

```bash
# Process a large batch
python -m src.cli.main batch-test \
  --pdf-count 50 \
  --pages-per-pdf 20 \
  --measure-time

# Expected output:
# Testing with 50 PDFs, 1000 total pages
# ✓ Conversion: 45 minutes
# ✓ Tiling: 12 minutes  
# ✓ ZIP creation: 3 minutes
# ✓ Total time: 60 minutes
# ✓ Memory peak: 2.3 GB
# ✓ Output size: 8.7 GB
```

## Next Steps

1. Configure production Procore credentials
2. Set up persistent storage (S3, GCS, etc.)
3. Deploy API to production server
4. Configure monitoring and logging
5. Set up automated backups

---
*Quickstart guide v0.1.0*