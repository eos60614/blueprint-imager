from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import sqlite3
import tempfile
import zipfile
import io
import os
from pathlib import Path
from datetime import datetime

from ..services import PDFProcessor, ImageTiler, ProcoreClient
from ..models import Drawing, Image as ImageModel, Job
from .upload import router as upload_router
from .convert import router as convert_router
from .jobs import router as jobs_router
from .roboflow import router as roboflow_router
from .tiles import router as tiles_router

app = FastAPI(title="Blueprint Imager API", version="2.0.0")

# Include routers
app.include_router(upload_router)
app.include_router(convert_router)
app.include_router(jobs_router)
app.include_router(roboflow_router)
app.include_router(tiles_router)

# Configure CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local frontend dev
        "https://*.vercel.app",   # Vercel preview deployments
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ConvertRequest(BaseModel):
    dpi: int = 600
    tile_size: int = 1920
    overlap: int = 250


class ProcoreAuthRequest(BaseModel):
    code: str


class ProcoreConvertRequest(BaseModel):
    project_id: str
    series: str = "M"


class JobResponse(BaseModel):
    id: int
    project_id: str
    status: str
    total_drawings: int
    processed_drawings: int
    progress: float
    error_message: Optional[str] = None
    created_at: str


class DrawingResponse(BaseModel):
    id: int
    project_id: str
    document_id: str
    name: str
    series: str
    status: str
    created_at: str


def get_db():
    return sqlite3.connect('blueprint_imager.db')


@app.get("/")
def read_root():
    return {"message": "Blueprint Imager API", "version": "1.0.0"}


@app.post("/convert")
async def convert_pdf(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    dpi: int = Query(600),
    tile_size: int = Query(1920),
    overlap: int = Query(250)
):
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="File must be a PDF")
    
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
        content = await file.read()
        tmp_pdf.write(content)
        tmp_pdf_path = tmp_pdf.name
    
    with tempfile.TemporaryDirectory() as output_dir:
        output_path = Path(output_dir)
        
        processor = PDFProcessor(dpi=dpi)
        tiler = ImageTiler(tile_size=tile_size, overlap=overlap)
        
        images_dir = output_path / "pages"
        tiles_dir = output_path / "tiles"
        
        try:
            image_paths = processor.convert_to_images(tmp_pdf_path, str(images_dir))
            
            all_tiles = []
            for image_path in image_paths:
                tiles = tiler.tile_image(image_path, str(tiles_dir))
                all_tiles.extend(tiles)
            
            zip_buffer = io.BytesIO()
            with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
                for tile in all_tiles:
                    tile_path = Path(tile['file_path'])
                    arcname = f"tiles/{tile_path.name}"
                    zip_file.write(tile_path, arcname)
            
            zip_buffer.seek(0)
            
            return StreamingResponse(
                zip_buffer,
                media_type="application/zip",
                headers={"Content-Disposition": f"attachment; filename={Path(file.filename).stem}_tiles.zip"}
            )
            
        finally:
            os.unlink(tmp_pdf_path)


@app.get("/procore/auth/url")
def get_auth_url():
    client = ProcoreClient()
    return {"auth_url": client.get_authorization_url()}


@app.post("/procore/auth/callback")
def handle_auth_callback(request: ProcoreAuthRequest):
    client = ProcoreClient()
    
    try:
        token_data = client.exchange_code_for_token(request.code)
        
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO auth_tokens (access_token, refresh_token)
            VALUES (?, ?)
        ''', (token_data['access_token'], token_data.get('refresh_token')))
        conn.commit()
        conn.close()
        
        return {"message": "Authentication successful", "access_token": token_data['access_token'][:10] + "..."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/procore/projects")
def list_projects():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Not authenticated with Procore")
    
    client = ProcoreClient()
    client.set_tokens(row[0], row[1])
    
    try:
        projects = client.list_projects()
        return projects
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/procore/projects/{project_id}/drawings")
def list_drawings(project_id: str, series: Optional[str] = None):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=401, detail="Not authenticated with Procore")
    
    client = ProcoreClient()
    client.set_tokens(row[0], row[1])
    
    try:
        drawings = client.list_drawings(project_id)
        
        if series and series.upper() == "M":
            drawings = client.filter_m_series_drawings(drawings)
        
        return drawings
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/procore/convert")
async def convert_procore_drawings(
    background_tasks: BackgroundTasks,
    request: ProcoreConvertRequest
):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=401, detail="Not authenticated with Procore")
    
    cursor.execute('''
        INSERT INTO jobs (project_id, status)
        VALUES (?, 'pending')
    ''', (request.project_id,))
    job_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    background_tasks.add_task(
        process_procore_project,
        job_id,
        request.project_id,
        request.series,
        row[0],
        row[1]
    )
    
    return {"job_id": job_id, "status": "pending"}


def process_procore_project(job_id: int, project_id: str, series: str, access_token: str, refresh_token: str):
    conn = get_db()
    cursor = conn.cursor()
    
    try:
        cursor.execute('UPDATE jobs SET status = ? WHERE id = ?', ('processing', job_id))
        conn.commit()
        
        client = ProcoreClient()
        client.set_tokens(access_token, refresh_token)
        
        drawings = client.list_drawings(project_id)
        if series.upper() == "M":
            drawings = client.filter_m_series_drawings(drawings)
        
        cursor.execute('UPDATE jobs SET total_drawings = ? WHERE id = ?', (len(drawings), job_id))
        conn.commit()
        
        processor = PDFProcessor()
        tiler = ImageTiler()
        
        output_base = Path(f"./procore_output/job_{job_id}")
        output_base.mkdir(parents=True, exist_ok=True)
        
        for drawing in drawings:
            drawing_id = drawing['id']
            drawing_name = drawing.get('name', f'drawing_{drawing_id}')
            
            cursor.execute('''
                INSERT INTO drawings (project_id, document_id, name, series, status)
                VALUES (?, ?, ?, ?, 'processing')
            ''', (project_id, str(drawing_id), drawing_name, series))
            db_drawing_id = cursor.lastrowid
            conn.commit()
            
            try:
                with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp_pdf:
                    pdf_path = tmp_pdf.name
                    client.download_drawing(project_id, str(drawing_id), pdf_path)
                
                drawing_dir = output_base / f"drawing_{drawing_id}"
                images_dir = drawing_dir / "pages"
                tiles_dir = drawing_dir / "tiles"
                
                image_paths = processor.convert_to_images(pdf_path, str(images_dir))
                
                for image_path in image_paths:
                    tiles = tiler.tile_image(image_path, str(tiles_dir))
                    
                    for tile in tiles:
                        cursor.execute('''
                            INSERT INTO images (drawing_id, file_path, tile_index, row, column, width, height)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        ''', (db_drawing_id, tile['file_path'], tile['tile_index'], 
                              tile['row'], tile['column'], tile['width'], tile['height']))
                
                cursor.execute('UPDATE drawings SET status = ?, file_path = ? WHERE id = ?', 
                              ('completed', str(drawing_dir), db_drawing_id))
                cursor.execute('UPDATE jobs SET processed_drawings = processed_drawings + 1 WHERE id = ?', 
                              (job_id,))
                conn.commit()
                
                os.unlink(pdf_path)
                
            except Exception as e:
                cursor.execute('UPDATE drawings SET status = ? WHERE id = ?', ('failed', db_drawing_id))
                conn.commit()
        
        cursor.execute('UPDATE jobs SET status = ? WHERE id = ?', ('completed', job_id))
        conn.commit()
        
    except Exception as e:
        cursor.execute('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?', 
                      ('failed', str(e), job_id))
        conn.commit()
    finally:
        conn.close()


@app.get("/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, project_id, status, total_drawings, processed_drawings, error_message, created_at
        FROM jobs WHERE id = ?
    ''', (job_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Job not found")
    
    progress = 0.0
    if row[3] > 0:
        progress = (row[4] / row[3]) * 100
    
    return JobResponse(
        id=row[0],
        project_id=row[1],
        status=row[2],
        total_drawings=row[3],
        processed_drawings=row[4],
        progress=progress,
        error_message=row[5],
        created_at=row[6]
    )


@app.get("/jobs/{job_id}/download")
def download_job_results(job_id: int):
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('SELECT status FROM jobs WHERE id = ?', (job_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Job not found")
    
    if row[0] != 'completed':
        conn.close()
        raise HTTPException(status_code=400, detail="Job is not completed")
    
    cursor.execute('SELECT file_path FROM drawings WHERE id IN (SELECT drawing_id FROM images WHERE drawing_id IN (SELECT id FROM drawings WHERE project_id = (SELECT project_id FROM jobs WHERE id = ?)))', (job_id,))
    drawing_paths = cursor.fetchall()
    conn.close()
    
    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for (drawing_path,) in drawing_paths:
            if drawing_path and os.path.exists(drawing_path):
                tiles_dir = Path(drawing_path) / "tiles"
                if tiles_dir.exists():
                    for tile_file in tiles_dir.glob("*.png"):
                        arcname = f"job_{job_id}/{tiles_dir.parent.name}/{tile_file.name}"
                        zip_file.write(tile_file, arcname)
    
    zip_buffer.seek(0)
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=job_{job_id}_results.zip"}
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}