import click
import sqlite3
import os
import json
import webbrowser
from pathlib import Path
from typing import Optional
from ..services import PDFProcessor, ImageTiler, ProcoreClient
from ..models import Drawing, Image as ImageModel, Job
import uvicorn
import tempfile
import zipfile


@click.group()
def cli():
    pass


@cli.command()
@click.option('--db-path', default='blueprint_imager.db', help='Path to SQLite database')
def init_db(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS drawings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            document_id TEXT NOT NULL,
            name TEXT NOT NULL,
            series TEXT,
            file_path TEXT,
            status TEXT DEFAULT 'pending',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS images (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            drawing_id INTEGER NOT NULL,
            file_path TEXT NOT NULL,
            tile_index INTEGER NOT NULL,
            row INTEGER NOT NULL,
            column INTEGER NOT NULL,
            width INTEGER NOT NULL,
            height INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (drawing_id) REFERENCES drawings (id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            total_drawings INTEGER DEFAULT 0,
            processed_drawings INTEGER DEFAULT 0,
            error_message TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS auth_tokens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            access_token TEXT NOT NULL,
            refresh_token TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()
    
    click.echo(f"Database initialized at {db_path}")


@cli.command()
@click.argument('pdf_path', type=click.Path(exists=True))
@click.option('--output-dir', default='./output', help='Output directory for images')
@click.option('--dpi', default=600, help='DPI for PDF conversion')
@click.option('--tile-size', default=1920, help='Tile size in pixels')
@click.option('--overlap', default=250, help='Overlap between tiles in pixels')
def convert(pdf_path, output_dir, dpi, tile_size, overlap):
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    click.echo(f"Converting PDF: {pdf_path}")
    
    processor = PDFProcessor(dpi=dpi)
    tiler = ImageTiler(tile_size=tile_size, overlap=overlap)
    
    images_dir = output_dir / "pages"
    tiles_dir = output_dir / "tiles"
    
    click.echo("Converting PDF to images...")
    image_paths = processor.convert_to_images(pdf_path, str(images_dir))
    click.echo(f"Created {len(image_paths)} page images")
    
    all_tiles = []
    for image_path in image_paths:
        click.echo(f"Tiling image: {Path(image_path).name}")
        tiles = tiler.tile_image(image_path, str(tiles_dir))
        all_tiles.extend(tiles)
        click.echo(f"  Created {len(tiles)} tiles")
    
    click.echo(f"\nConversion complete!")
    click.echo(f"Total pages: {len(image_paths)}")
    click.echo(f"Total tiles: {len(all_tiles)}")
    click.echo(f"Output directory: {output_dir}")


@cli.command()
@click.option('--db-path', default='blueprint_imager.db', help='Path to SQLite database')
def procore_auth(db_path):
    client = ProcoreClient()
    auth_url = client.get_authorization_url()
    
    click.echo("Opening browser for Procore authentication...")
    click.echo(f"Authorization URL: {auth_url}")
    webbrowser.open(auth_url)
    
    click.echo("\nAfter authorizing, you'll be redirected to http://localhost:3001/auth/callback")
    click.echo("Copy the 'code' parameter from the URL and paste it here:")
    
    code = click.prompt("Authorization code")
    
    try:
        token_data = client.exchange_code_for_token(code)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO auth_tokens (access_token, refresh_token)
            VALUES (?, ?)
        ''', (token_data['access_token'], token_data.get('refresh_token')))
        conn.commit()
        conn.close()
        
        click.echo("Authentication successful! Tokens saved to database.")
    except Exception as e:
        click.echo(f"Authentication failed: {e}", err=True)


@cli.command()
@click.option('--project-id', required=True, help='Procore project ID')
@click.option('--db-path', default='blueprint_imager.db', help='Path to SQLite database')
def procore_list(project_id, db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        click.echo("No authentication tokens found. Run 'procore-auth' first.", err=True)
        return
    
    client = ProcoreClient()
    client.set_tokens(row[0], row[1])
    
    try:
        drawings = client.list_drawings(project_id)
        m_series = client.filter_m_series_drawings(drawings)
        
        click.echo(f"Found {len(drawings)} total drawings")
        click.echo(f"Found {len(m_series)} M-series drawings\n")
        
        for drawing in m_series:
            click.echo(f"ID: {drawing['id']}")
            click.echo(f"  Name: {drawing.get('name', 'N/A')}")
            click.echo(f"  Number: {drawing.get('number', 'N/A')}")
            click.echo(f"  Discipline: {drawing.get('discipline', {}).get('name', 'N/A')}")
            click.echo()
    except Exception as e:
        click.echo(f"Failed to list drawings: {e}", err=True)


@cli.command()
@click.option('--project-id', required=True, help='Procore project ID')
@click.option('--series', default='M', help='Drawing series to filter')
@click.option('--output-dir', default='./procore_output', help='Output directory')
@click.option('--db-path', default='blueprint_imager.db', help='Path to SQLite database')
def procore_convert(project_id, series, output_dir, db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        click.echo("No authentication tokens found. Run 'procore-auth' first.", err=True)
        return
    
    client = ProcoreClient()
    client.set_tokens(row[0], row[1])
    
    cursor.execute('''
        INSERT INTO jobs (project_id, status)
        VALUES (?, 'processing')
    ''', (project_id,))
    job_id = cursor.lastrowid
    conn.commit()
    
    output_dir = Path(output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    
    try:
        drawings = client.list_drawings(project_id)
        m_series = client.filter_m_series_drawings(drawings)
        
        cursor.execute('UPDATE jobs SET total_drawings = ? WHERE id = ?', (len(m_series), job_id))
        conn.commit()
        
        click.echo(f"Processing {len(m_series)} M-series drawings...")
        
        processor = PDFProcessor()
        tiler = ImageTiler()
        
        for i, drawing in enumerate(m_series):
            drawing_id = drawing['id']
            drawing_name = drawing.get('name', f'drawing_{drawing_id}')
            
            click.echo(f"\n[{i+1}/{len(m_series)}] Processing: {drawing_name}")
            
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
                
                drawing_dir = output_dir / f"drawing_{drawing_id}"
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
                click.echo(f"  ✓ Completed: {len(tiles)} tiles created")
                
            except Exception as e:
                cursor.execute('UPDATE drawings SET status = ? WHERE id = ?', ('failed', db_drawing_id))
                conn.commit()
                click.echo(f"  ✗ Failed: {e}")
        
        cursor.execute('UPDATE jobs SET status = ? WHERE id = ?', ('completed', job_id))
        conn.commit()
        click.echo(f"\nJob completed! Output saved to: {output_dir}")
        
    except Exception as e:
        cursor.execute('UPDATE jobs SET status = ?, error_message = ? WHERE id = ?', 
                      ('failed', str(e), job_id))
        conn.commit()
        click.echo(f"Job failed: {e}", err=True)
    finally:
        conn.close()


@cli.command()
@click.option('--host', default='0.0.0.0', help='Host to bind to')
@click.option('--port', default=3001, help='Port to bind to')
@click.option('--reload', is_flag=True, help='Enable auto-reload')
def serve(host, port, reload):
    click.echo(f"Starting API server on {host}:{port}")
    uvicorn.run(
        "src.api.main:app",
        host=host,
        port=port,
        reload=reload
    )


if __name__ == '__main__':
    cli()