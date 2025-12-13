# Quickstart: PDF Upload Frontend with Page Selection

**Branch**: `002-i-want-to` | **Date**: 2025-12-12

## Prerequisites

### Development Environment

- Node.js 18+ (for frontend)
- Python 3.11+ (for backend)
- Poppler (for PDF processing)
- AWS CLI configured with appropriate credentials

### AWS Resources

1. S3 bucket: `blueprint-imager-uploads` (or configured name)
2. IAM user/role with S3 permissions:
   - `s3:PutObject` on `uploads/*`
   - `s3:GetObject` on `uploads/*` and `output/*`
   - `s3:DeleteObject` on `uploads/*` and `output/*`

### Environment Variables

Create `.env.local` in `frontend/`:

```bash
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:3001

# AWS Configuration (server-side only)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=blueprint-imager-uploads
```

Create or update `.env` in project root for backend:

```bash
# Existing Procore config...

# S3 Configuration (new)
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
S3_BUCKET_NAME=blueprint-imager-uploads
```

## Quick Setup

### 1. Backend Setup (existing + extensions)

```bash
# From project root
cd /home/niravsapra/projects/blueprint-imager

# Install new dependencies
pip install boto3

# Initialize database (includes new tables)
python -m src.cli.main init-db

# Start backend server
python -m src.cli.main serve --port 3001
```

### 2. Frontend Setup (new)

```bash
# From project root
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Frontend will be available at http://localhost:3000

### 3. S3 Bucket Setup

```bash
# Create bucket (if not exists)
aws s3 mb s3://blueprint-imager-uploads --region us-east-1

# Configure CORS
aws s3api put-bucket-cors --bucket blueprint-imager-uploads --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST"],
      "AllowedOrigins": ["http://localhost:3000", "https://*.vercel.app"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}'

# Enable versioning (optional, for safety)
aws s3api put-bucket-versioning --bucket blueprint-imager-uploads --versioning-configuration Status=Enabled
```

## Validation Checklist

Run these checks to verify the implementation:

### Backend API Checks

```bash
# 1. Health check
curl http://localhost:3001/health
# Expected: {"status": "healthy", "timestamp": "..."}

# 2. Get presigned URL
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "test.pdf", "fileSize": 1000, "contentType": "application/pdf"}'
# Expected: {"uploadUrl": "https://...", "s3Key": "uploads/.../document.pdf", "expiresIn": 900}

# 3. Test file size validation
curl -X POST http://localhost:3001/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"fileName": "huge.pdf", "fileSize": 200000000, "contentType": "application/pdf"}'
# Expected: {"error": "File too large", "message": "Maximum file size is 100MB"}
```

### Frontend Checks

1. **File Upload UI**
   - [ ] Drag-drop zone visible on page load
   - [ ] Click to select file works
   - [ ] Rejects non-PDF files with error message
   - [ ] Rejects files > 100MB with error message
   - [ ] Shows upload progress bar during upload

2. **Page Selection**
   - [ ] Page count displayed after upload
   - [ ] Thumbnails render for all pages
   - [ ] Can enter range "1-5" and see pages 1-5 selected
   - [ ] Can enter individual "3, 7" and see pages 3, 7 selected
   - [ ] Can combine "1-5, 8, 12-15"
   - [ ] Invalid ranges show error message
   - [ ] Pages exceeding count show error message

3. **Processing**
   - [ ] Submit button disabled until pages selected
   - [ ] Progress displays during conversion
   - [ ] Download button appears when complete
   - [ ] ZIP file downloads with correct tiles

### End-to-End Test

```bash
# Full workflow test with sample PDF
cd frontend

# Run E2E tests
npm run test:e2e

# Or manual test:
# 1. Open http://localhost:3000
# 2. Upload a sample PDF (e.g., tests/fixtures/sample.pdf)
# 3. Enter page selection "1-3"
# 4. Click Submit
# 5. Wait for processing to complete
# 6. Download ZIP and verify tiles exist
```

## Deployment

### Deploy Frontend to Vercel

```bash
cd frontend

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard:
# - NEXT_PUBLIC_API_URL = your backend URL
# - AWS_ACCESS_KEY_ID
# - AWS_SECRET_ACCESS_KEY
# - AWS_REGION
# - S3_BUCKET_NAME
```

### Backend Deployment Notes

The backend needs to be accessible from:
1. Vercel frontend (for API calls)
2. Browser (for CORS preflight)

Ensure backend CORS is configured:

```python
# In src/api/main.py
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://*.vercel.app",
        "https://your-domain.com"
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Troubleshooting

### Common Issues

1. **CORS errors in browser**
   - Check S3 bucket CORS configuration
   - Check backend CORS middleware
   - Verify origin URLs match exactly

2. **Presigned URL expired**
   - URLs expire after 15 minutes
   - Frontend should request new URL on retry

3. **PDF thumbnails not rendering**
   - Check browser console for pdf.js errors
   - Verify PDF is valid (try opening in browser)
   - Check if PDF has non-standard encoding

4. **Large file upload timeout**
   - Ensure upload goes directly to S3 (not through Vercel)
   - Check network connection stability
   - Consider implementing resumable uploads for very large files

5. **Processing job stuck**
   - Check backend logs for errors
   - Verify Poppler is installed
   - Check S3 permissions for output bucket

## Sample Files

Place test fixtures in `frontend/tests/fixtures/`:

- `sample.pdf` - Small multi-page PDF for basic testing
- `large-drawing.pdf` - Large mechanical drawing (< 100MB)
- `corrupt.pdf` - Invalid PDF for error testing
- `empty.pdf` - Zero-page PDF for edge case testing
