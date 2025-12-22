import click
import os
import json
import webbrowser
from pathlib import Path
from typing import Optional
from ..services import PDFProcessor, ImageTiler, ProcoreClient
from ..models import Drawing, Image as ImageModel, Job
from ..db import init_database, get_db
from ..config import config
import uvicorn
import tempfile
import zipfile


@click.group()
def cli():
    pass


@cli.command()
def init_db():
    """Initialize the PostgreSQL database schema."""
    try:
        init_database()
        click.echo(f"Database initialized at {config.DATABASE_HOST}:{config.DATABASE_PORT}/{config.DATABASE_NAME}")
    except Exception as e:
        click.echo(f"Failed to initialize database: {e}", err=True)
        raise click.Abort()


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
def procore_auth():
    """Authenticate with Procore and save tokens."""
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

        with get_db() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO auth_tokens (access_token, refresh_token)
                VALUES (%s, %s)
            ''', (token_data['access_token'], token_data.get('refresh_token')))

        click.echo("Authentication successful! Tokens saved to database.")
    except Exception as e:
        click.echo(f"Authentication failed: {e}", err=True)


@cli.command()
@click.option('--project-id', required=True, help='Procore project ID')
def procore_list(project_id):
    """List M-series drawings from a Procore project."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
        row = cursor.fetchone()

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
def procore_convert(project_id, series, output_dir):
    """Convert M-series drawings from a Procore project to tiled images."""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute('SELECT access_token, refresh_token FROM auth_tokens ORDER BY id DESC LIMIT 1')
        row = cursor.fetchone()

        if not row:
            click.echo("No authentication tokens found. Run 'procore-auth' first.", err=True)
            return

        client = ProcoreClient()
        client.set_tokens(row[0], row[1])

        cursor.execute('''
            INSERT INTO jobs (project_id, status) VALUES (%s, 'processing') RETURNING id
        ''', (project_id,))
        job_id = cursor.fetchone()[0]

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        try:
            drawings = client.list_drawings(project_id)
            m_series = client.filter_m_series_drawings(drawings)

            cursor.execute('UPDATE jobs SET total_drawings = %s WHERE id = %s', (len(m_series), job_id))

            click.echo(f"Processing {len(m_series)} M-series drawings...")

            processor = PDFProcessor()
            tiler = ImageTiler()

            for i, drawing in enumerate(m_series):
                drawing_id = drawing['id']
                drawing_name = drawing.get('name', f'drawing_{drawing_id}')

                click.echo(f"\n[{i+1}/{len(m_series)}] Processing: {drawing_name}")

                cursor.execute('''
                    INSERT INTO drawings (project_id, document_id, name, series, status)
                    VALUES (%s, %s, %s, %s, 'processing') RETURNING id
                ''', (project_id, str(drawing_id), drawing_name, series))
                db_drawing_id = cursor.fetchone()[0]

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
                                INSERT INTO images (drawing_id, file_path, tile_index, row, "column", width, height)
                                VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ''', (db_drawing_id, tile['file_path'], tile['tile_index'],
                                  tile['row'], tile['column'], tile['width'], tile['height']))

                    cursor.execute('UPDATE drawings SET status = %s, file_path = %s WHERE id = %s',
                                  ('completed', str(drawing_dir), db_drawing_id))
                    cursor.execute('UPDATE jobs SET processed_drawings = processed_drawings + 1 WHERE id = %s',
                                  (job_id,))

                    os.unlink(pdf_path)
                    click.echo(f"  Completed: {len(tiles)} tiles created")

                except Exception as e:
                    cursor.execute('UPDATE drawings SET status = %s WHERE id = %s', ('failed', db_drawing_id))
                    click.echo(f"  Failed: {e}")

            cursor.execute('UPDATE jobs SET status = %s WHERE id = %s', ('completed', job_id))
            click.echo(f"\nJob completed! Output saved to: {output_dir}")

        except Exception as e:
            cursor.execute('UPDATE jobs SET status = %s, error_message = %s WHERE id = %s',
                          ('failed', str(e), job_id))
            click.echo(f"Job failed: {e}", err=True)


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


@cli.command()
@click.option('--dry-run', is_flag=True, help='Show what would be deleted without deleting')
@click.option('--ttl-hours', default=None, type=int, help='Override TTL hours (default from config)')
def cleanup_tiles(dry_run, ttl_hours):
    """Clean up tile directories older than TTL (default 24 hours).

    This command should be run periodically (e.g., via cron) to clean up
    old tile files from local storage.

    Example cron entry (run every hour):
        0 * * * * cd /path/to/project && python -m src.cli.main cleanup-tiles
    """
    import shutil
    from datetime import datetime, timedelta

    ttl = ttl_hours if ttl_hours is not None else config.TILE_TTL_HOURS
    storage_path = Path(config.LOCAL_TILE_STORAGE_PATH)

    if not storage_path.exists():
        click.echo(f"Tile storage path does not exist: {storage_path}")
        return

    cutoff_time = datetime.now() - timedelta(hours=ttl)
    deleted_count = 0
    total_size = 0

    click.echo(f"Scanning for tiles older than {ttl} hours...")
    click.echo(f"Storage path: {storage_path}")
    click.echo(f"Cutoff time: {cutoff_time}")

    # Each subdirectory is a job_id
    for job_dir in storage_path.iterdir():
        if not job_dir.is_dir():
            continue

        # Check the modification time of the directory
        dir_mtime = datetime.fromtimestamp(job_dir.stat().st_mtime)

        if dir_mtime < cutoff_time:
            # Calculate directory size
            dir_size = sum(f.stat().st_size for f in job_dir.rglob('*') if f.is_file())
            total_size += dir_size

            if dry_run:
                click.echo(f"[DRY RUN] Would delete: {job_dir} (modified: {dir_mtime}, size: {dir_size / 1024 / 1024:.2f} MB)")
            else:
                try:
                    shutil.rmtree(job_dir)
                    click.echo(f"Deleted: {job_dir} (modified: {dir_mtime}, size: {dir_size / 1024 / 1024:.2f} MB)")
                    deleted_count += 1
                except Exception as e:
                    click.echo(f"Failed to delete {job_dir}: {e}", err=True)

    if dry_run:
        click.echo(f"\n[DRY RUN] Would delete {deleted_count} directories, freeing {total_size / 1024 / 1024:.2f} MB")
    else:
        click.echo(f"\nCleanup complete: deleted {deleted_count} directories, freed {total_size / 1024 / 1024:.2f} MB")


if __name__ == '__main__':
    cli()