"""
PostgreSQL database connection and utilities.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional

from .config import config


def get_connection():
    """Get a PostgreSQL database connection."""
    return psycopg2.connect(
        host=config.DATABASE_HOST,
        port=config.DATABASE_PORT,
        database=config.DATABASE_NAME,
        user=config.DATABASE_USER,
        password=config.DATABASE_PASSWORD
    )


@contextmanager
def get_db():
    """Context manager for database connections with automatic cleanup."""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor(dict_cursor: bool = False):
    """Context manager for database cursors."""
    with get_db() as conn:
        cursor_factory = RealDictCursor if dict_cursor else None
        cursor = conn.cursor(cursor_factory=cursor_factory)
        try:
            yield cursor
            conn.commit()
        finally:
            cursor.close()


def init_database():
    """Initialize the database schema."""
    with get_db() as conn:
        cursor = conn.cursor()

        # Drawings table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS drawings (
                id SERIAL PRIMARY KEY,
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

        # Images table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS images (
                id SERIAL PRIMARY KEY,
                drawing_id INTEGER NOT NULL REFERENCES drawings(id),
                file_path TEXT NOT NULL,
                tile_index INTEGER NOT NULL,
                row INTEGER NOT NULL,
                "column" INTEGER NOT NULL,
                width INTEGER NOT NULL,
                height INTEGER NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Jobs table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS jobs (
                id SERIAL PRIMARY KEY,
                project_id TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                total_drawings INTEGER DEFAULT 0,
                processed_drawings INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                source TEXT DEFAULT 'procore',
                upload_id INTEGER,
                selected_pages TEXT,
                total_pages INTEGER DEFAULT 0,
                processed_pages INTEGER DEFAULT 0,
                dpi INTEGER DEFAULT 600,
                tile_size INTEGER DEFAULT 1920,
                overlap INTEGER DEFAULT 250
            )
        ''')

        # Auth tokens table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS auth_tokens (
                id SERIAL PRIMARY KEY,
                access_token TEXT NOT NULL,
                refresh_token TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Uploads table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS uploads (
                id SERIAL PRIMARY KEY,
                s3_bucket TEXT NOT NULL,
                s3_key TEXT NOT NULL,
                file_name TEXT NOT NULL,
                file_size INTEGER NOT NULL,
                page_count INTEGER,
                status TEXT NOT NULL DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')

        # Job pages table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS job_pages (
                id SERIAL PRIMARY KEY,
                job_id INTEGER NOT NULL REFERENCES jobs(id),
                page_number INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                tile_count INTEGER DEFAULT 0,
                error_message TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(job_id, page_number)
            )
        ''')

        # Create indexes
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uploads_s3_key ON uploads(s3_key)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_uploads_status ON uploads(status)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_job_pages_job_id ON job_pages(job_id)')

        # Add procore drawing columns to jobs table (T029)
        # These columns store metadata for jobs sourced from Procore database
        cursor.execute('''
            DO $$
            BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'jobs' AND column_name = 'procore_drawing_ids'
                ) THEN
                    ALTER TABLE jobs ADD COLUMN procore_drawing_ids JSONB;
                END IF;
                IF NOT EXISTS (
                    SELECT 1 FROM information_schema.columns
                    WHERE table_name = 'jobs' AND column_name = 'procore_s3_keys'
                ) THEN
                    ALTER TABLE jobs ADD COLUMN procore_s3_keys JSONB;
                END IF;
            END $$;
        ''')

        conn.commit()
