# Quickstart: Procore-PostgreSQL Drawings Integration

**Feature Branch**: `007-procore-postgres-drawings`
**Date**: 2026-01-18

## Overview

This guide helps you get started with the Procore-PostgreSQL drawings integration feature, which allows browsing and processing M-series mechanical drawings from an external Procore database.

## Prerequisites

### System Requirements
- Python 3.11+
- Node.js 18+ (for frontend)
- Docker (optional, for containerized deployment)
- Poppler (for PDF processing)

### Access Requirements
- Read-only credentials for Procore PostgreSQL database (`procore_int_v2`)
- AWS credentials with access to Procore S3 bucket
- Network access to RDS endpoint

## Environment Setup

### 1. Backend Configuration

Add the following to your `.env` file:

```bash
# External Procore PostgreSQL Database
PROCORE_DB_HOST=database-3.czsyw64yw006.us-east-2.rds.amazonaws.com
PROCORE_DB_PORT=5432
PROCORE_DB_NAME=procore_int_v2
PROCORE_DB_USER=readonly_user
PROCORE_DB_PASSWORD=your_password_here

# Procore Drawings S3 Bucket
PROCORE_S3_BUCKET=procore-drawings-bucket

# Existing AWS credentials (same for both S3 buckets)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-2
```

### 2. Verify Database Connection

Test the connection to the external database:

```bash
# Using psql
PGPASSWORD=your_password psql -h database-3.czsyw64yw006.us-east-2.rds.amazonaws.com -p 5432 -U readonly_user -d procore_int_v2 -c "SELECT COUNT(*) FROM drawings WHERE discipline = 'M';"
```

Expected output: A count of M-series drawings in the database.

### 3. Install Dependencies

```bash
# Backend
pip install -r requirements.txt

# Frontend
cd frontend && npm install
```

## Running the Application

### Development Mode

```bash
# Terminal 1: Backend (port 3001)
python -m src.cli.main serve --port 3001

# Terminal 2: Frontend (port 3000)
cd frontend && npm run dev
```

### Docker Mode

```bash
docker-compose up -d
```

## Using the Feature

### Browse Drawings

1. Navigate to `http://localhost:3000/browse`
2. Use the project dropdown to filter by project
3. Use the search box to find specific drawings by number or title
4. Click on a drawing to view details

### Process Drawings

1. Select up to 10 drawings using the checkboxes
2. Click "Process Selected"
3. Adjust processing settings (DPI, tile size, overlap) if needed
4. Click "Start Processing"
5. Monitor progress in the status panel
6. Download tiles when complete

## API Quick Reference

### List Projects

```bash
curl http://localhost:3001/api/procore/projects
```

Response:
```json
{
  "projects": [
    {
      "id": 123456,
      "name": "Office Tower Phase 2",
      "projectNumber": "2024-001",
      "active": true
    }
  ],
  "total": 1
}
```

### List Drawings

```bash
# All M-series drawings
curl "http://localhost:3001/api/procore/drawings"

# Filter by project
curl "http://localhost:3001/api/procore/drawings?project_id=123456"

# Search by drawing number
curl "http://localhost:3001/api/procore/drawings?search=M-101"

# Pagination
curl "http://localhost:3001/api/procore/drawings?page=2&limit=25"
```

### Process Drawings

```bash
curl -X POST http://localhost:3001/api/procore/process \
  -H "Content-Type: application/json" \
  -d '{
    "drawingIds": [789, 790, 791],
    "dpi": 600,
    "tileSize": 1920,
    "overlap": 250
  }'
```

Response:
```json
{
  "jobId": 42,
  "status": "processing",
  "totalDrawings": 3,
  "message": "Processing 3 drawings"
}
```

### Check Job Status

```bash
curl http://localhost:3001/api/jobs/42
```

## Common Issues

### Database Connection Errors

**Error**: "Unable to connect to Procore database"

**Solutions**:
1. Check VPN connection if database is on private network
2. Verify credentials in `.env` file
3. Confirm security group allows your IP
4. Test with psql directly

### S3 Access Denied

**Error**: "Access denied when downloading drawing file"

**Solutions**:
1. Verify AWS credentials have access to Procore bucket
2. Check IAM policy includes `s3:GetObject` on the bucket
3. Confirm bucket name in `PROCORE_S3_BUCKET` is correct

### Drawing Has No File

**Warning**: "Drawing M-102 does not have a file available"

This means the drawing exists in the database but `s3_key` is null. The file may not have been synced from Procore yet. Wait for the next sync cycle or contact the Procore integration admin.

### Processing Timeout

**Error**: Large drawings timing out during processing

**Solutions**:
1. Process fewer drawings per batch (max 10)
2. Increase worker timeout settings
3. Check available disk space for temp files

## Testing

### Run Backend Tests

```bash
# All tests
pytest

# Just Procore integration tests
pytest tests/integration/test_procore_db_client.py

# Contract tests
pytest tests/contract/test_procore_browse_api.py
```

### Run Frontend Tests

```bash
cd frontend

# Unit tests
npm run test

# E2E tests (requires backend running)
npm run test:e2e
```

## File Locations

| Component | Path |
|-----------|------|
| Procore DB Client | `src/services/procore_db_client.py` |
| Browse API Router | `src/api/procore_browse.py` |
| Drawing Models | `src/models/procore_drawing.py` |
| Frontend Browse Page | `frontend/src/app/browse/page.tsx` |
| Drawing List Component | `frontend/src/components/DrawingList/` |
| TypeScript Types | `frontend/src/types/procore.ts` |

## Next Steps

- [ ] Review the full [Implementation Plan](./plan.md)
- [ ] Check [Data Model](./data-model.md) for database schema details
- [ ] See [API Contract](./contracts/procore-browse-api.yaml) for complete endpoint documentation
- [ ] Run `/speckit.tasks` to generate implementation tasks
