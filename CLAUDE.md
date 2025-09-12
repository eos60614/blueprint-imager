# Claude Code Context - Blueprint Imager

## Project Overview
PDF to Image converter for YOLO training. Converts mechanical drawings (M-series from Procore and manual uploads) to tiled PNG images at 600 DPI with 1920×1920 tiles and 13% overlap.

## Current Feature
**Branch**: 001-need-an-application  
**Status**: Planning complete, ready for implementation  
**Spec**: `/specs/001-need-an-application/spec.md`

## Tech Stack
- **Language**: Python 3.11+
- **Framework**: FastAPI (API), Click (CLI)
- **PDF Processing**: pdf2image with Poppler
- **Image Processing**: Pillow (PIL)
- **Database**: SQLite
- **HTTP Client**: httpx
- **File Uploads**: python-multipart

## Project Structure
```
src/
├── models/       # Data models (drawing, image, job)
├── services/     # Core logic (pdf_processor, image_tiler, procore_client)
├── cli/          # Command-line interface
└── lib/          # Shared utilities

tests/
├── contract/     # API contract tests
├── integration/  # Feature integration tests
└── unit/         # Unit tests
```

## Key Requirements
1. Convert PDFs at 600 DPI to PNG (RGB, lossless)
2. Generate 1920×1920 tiles with 250px overlap (stride=1670)
3. Filter M-series drawings from Procore
4. OAuth integration with Procore sandbox
5. Bulk ZIP downloads of converted images
6. No speed requirements - quality over performance

## Procore Configuration
```env
PROCORE_CLIENT_ID="RFLeKXReUoqaHmIX6nCSOJ_FCZeBt6GU1WH9hT0ltDc"
PROCORE_CLIENT_SECRET="lJaoBeu4FrbKb_CuGiqJkUQveLxT7uhS-y8dYMlczdI"
PROCORE_API_BASE_URL="https://sandbox.procore.com"
PROCORE_AUTH_BASE_URL="https://login-sandbox.procore.com"
PROCORE_COMPANY_ID="4276435"
```

## Development Commands
```bash
# Initialize database
python -m src.cli.main init-db

# Convert single PDF
python -m src.cli.main convert sample.pdf --output-dir ./output

# Procore operations
python -m src.cli.main procore-auth
python -m src.cli.main procore-list --project-id 123456
python -m src.cli.main procore-convert --project-id 123456 --series M

# Start API server
python -m src.cli.main serve --port 3001
```

## Testing Approach
1. TDD: Write failing tests first (RED-GREEN-Refactor)
2. Order: Contract → Integration → E2E → Unit
3. Use real PDFs and images (no mocks)
4. Test with actual Procore sandbox

## Next Steps
1. Run `/tasks` command to generate implementation tasks
2. Implement contract tests (must fail initially)
3. Build data models and services
4. Implement CLI and API endpoints
5. Run quickstart validation

## Recent Changes
- Created feature specification with all requirements
- Planned implementation with Python/FastAPI/SQLite
- Designed data model and API contracts
- Set up project structure

---
*Context for Claude Code - Last updated: 2025-09-12*