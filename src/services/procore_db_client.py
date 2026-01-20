"""
Procore PostgreSQL Database Client.
Provides read-only access to the external procore_int_v2 database.
"""

import logging
import time
from contextlib import contextmanager
from typing import Generator, List, Optional

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

from src.config import config
from src.models.procore_drawing import ProcoreProject, ProcoreDrawing, ProcoreDrawingList

logger = logging.getLogger(__name__)

# Retry configuration
MAX_RETRIES = 3
INITIAL_BACKOFF = 0.5  # seconds
MAX_BACKOFF = 4.0  # seconds


class ProcoreDBClient:
    """
    Client for connecting to the external Procore PostgreSQL database.
    Uses connection pooling and enforces read-only access.
    """

    _pool: Optional[pool.ThreadedConnectionPool] = None

    @classmethod
    def get_pool(cls) -> pool.ThreadedConnectionPool:
        """Get or create the connection pool with retry logic."""
        if cls._pool is None:
            if not config.PROCORE_DB_HOST:
                raise ValueError("PROCORE_DB_HOST is not configured")

            backoff = INITIAL_BACKOFF
            last_error = None

            for attempt in range(MAX_RETRIES):
                try:
                    cls._pool = pool.ThreadedConnectionPool(
                        minconn=1,
                        maxconn=10,
                        host=config.PROCORE_DB_HOST,
                        port=config.PROCORE_DB_PORT,
                        database=config.PROCORE_DB_NAME,
                        user=config.PROCORE_DB_USER,
                        password=config.PROCORE_DB_PASSWORD,
                        options='-c default_transaction_read_only=on'
                    )
                    logger.info(
                        f"Created Procore DB connection pool to {config.PROCORE_DB_HOST}:{config.PROCORE_DB_PORT}/{config.PROCORE_DB_NAME}"
                    )
                    return cls._pool
                except psycopg2.OperationalError as e:
                    last_error = e
                    if attempt < MAX_RETRIES - 1:
                        logger.warning(
                            f"Failed to connect to Procore DB (attempt {attempt + 1}/{MAX_RETRIES}), "
                            f"retrying in {backoff:.1f}s: {e}"
                        )
                        time.sleep(backoff)
                        backoff = min(backoff * 2, MAX_BACKOFF)
                    else:
                        logger.error(f"Failed to connect to Procore DB after {MAX_RETRIES} attempts: {e}")
                        raise

        return cls._pool

    @classmethod
    @contextmanager
    def get_cursor(cls, dict_cursor: bool = True) -> Generator:
        """
        Context manager for getting a database cursor.
        Automatically returns connection to pool when done.

        Args:
            dict_cursor: If True, use RealDictCursor for dict-like row access.

        Yields:
            Database cursor.
        """
        pool_instance = cls.get_pool()
        conn = pool_instance.getconn()
        try:
            cursor_factory = RealDictCursor if dict_cursor else None
            with conn.cursor(cursor_factory=cursor_factory) as cursor:
                yield cursor
        finally:
            pool_instance.putconn(conn)

    @classmethod
    def close_pool(cls) -> None:
        """Close all connections in the pool."""
        if cls._pool is not None:
            cls._pool.closeall()
            cls._pool = None
            logger.info("Closed Procore DB connection pool")

    @classmethod
    def health_check(cls) -> bool:
        """Check if database connection is healthy."""
        try:
            with cls.get_cursor() as cursor:
                cursor.execute("SELECT 1")
                return True
        except Exception as e:
            logger.error(f"Procore DB health check failed: {e}")
            return False

    @classmethod
    def list_projects(cls) -> List[ProcoreProject]:
        """
        List all active projects that have M-series drawings with S3 files.

        Returns:
            List of ProcoreProject instances.
        """
        query = """
            SELECT DISTINCT
                p.id,
                p.name,
                p.display_name,
                p.project_number,
                p.active,
                p.city,
                p.state_code
            FROM projects p
            INNER JOIN drawings d ON d.project_id = p.id
            INNER JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.current = true
            WHERE p.active = true
              AND LOWER(d.discipline) = 'mechanical'
              AND dr.s3_key IS NOT NULL
            ORDER BY p.name
        """
        with cls.get_cursor() as cursor:
            cursor.execute(query)
            rows = cursor.fetchall()
            return [ProcoreProject.from_row(dict(row)) for row in rows]

    @classmethod
    def list_drawings(
        cls,
        project_id: Optional[int] = None,
        search: Optional[str] = None,
        page: int = 1,
        limit: int = 50
    ) -> ProcoreDrawingList:
        """
        List M-series drawings with pagination and filtering.

        Args:
            project_id: Filter by project ID.
            search: Search drawing_number or title (partial match).
            page: Page number (1-indexed).
            limit: Results per page (max 100).

        Returns:
            ProcoreDrawingList with paginated results.
        """
        limit = min(limit, 100)
        offset = (page - 1) * limit

        base_query = """
            SELECT
                d.id,
                d.project_id,
                d.drawing_number,
                d.title,
                d.discipline,
                da.name as drawing_area_name,
                dr.id as revision_id,
                dr.revision_number,
                dr.s3_key,
                dr.filename,
                dr.file_size,
                p.name as project_name,
                p.project_number
            FROM drawings d
            INNER JOIN projects p ON d.project_id = p.id
            LEFT JOIN drawing_areas da ON d.drawing_area_id = da.id
            LEFT JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.current = true
            WHERE LOWER(d.discipline) = 'mechanical'
        """

        count_query = """
            SELECT COUNT(*) as total
            FROM drawings d
            INNER JOIN projects p ON d.project_id = p.id
            WHERE LOWER(d.discipline) = 'mechanical'
        """

        params = []
        conditions = []

        if project_id is not None:
            conditions.append("d.project_id = %s")
            params.append(project_id)

        if search:
            search_pattern = f"%{search}%"
            conditions.append("(d.drawing_number ILIKE %s OR d.title ILIKE %s)")
            params.extend([search_pattern, search_pattern])

        if conditions:
            condition_str = " AND " + " AND ".join(conditions)
            base_query += condition_str
            count_query += condition_str

        base_query += " ORDER BY p.name, d.drawing_number LIMIT %s OFFSET %s"

        with cls.get_cursor() as cursor:
            # Get total count
            cursor.execute(count_query, params)
            total = cursor.fetchone()['total']

            # Get paginated results
            cursor.execute(base_query, params + [limit, offset])
            rows = cursor.fetchall()
            drawings = [ProcoreDrawing.from_row(dict(row)) for row in rows]

        has_more = (offset + len(drawings)) < total

        return ProcoreDrawingList(
            drawings=drawings,
            total=total,
            page=page,
            limit=limit,
            has_more=has_more
        )

    @classmethod
    def get_drawing(cls, drawing_id: int) -> Optional[ProcoreDrawing]:
        """
        Get a single drawing by ID.

        Args:
            drawing_id: The drawing ID.

        Returns:
            ProcoreDrawing instance or None if not found.
        """
        query = """
            SELECT
                d.id,
                d.project_id,
                d.drawing_number,
                d.title,
                d.discipline,
                da.name as drawing_area_name,
                dr.id as revision_id,
                dr.revision_number,
                dr.s3_key,
                dr.filename,
                dr.file_size,
                p.name as project_name,
                p.project_number
            FROM drawings d
            INNER JOIN projects p ON d.project_id = p.id
            LEFT JOIN drawing_areas da ON d.drawing_area_id = da.id
            LEFT JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.current = true
            WHERE d.id = %s AND LOWER(d.discipline) = 'mechanical'
        """
        with cls.get_cursor() as cursor:
            cursor.execute(query, (drawing_id,))
            row = cursor.fetchone()
            if row:
                return ProcoreDrawing.from_row(dict(row))
            return None

    @classmethod
    def get_drawings_by_ids(cls, drawing_ids: List[int]) -> List[ProcoreDrawing]:
        """
        Get multiple drawings by their IDs.

        Args:
            drawing_ids: List of drawing IDs.

        Returns:
            List of ProcoreDrawing instances.
        """
        if not drawing_ids:
            return []

        placeholders = ', '.join(['%s'] * len(drawing_ids))
        query = f"""
            SELECT
                d.id,
                d.project_id,
                d.drawing_number,
                d.title,
                d.discipline,
                da.name as drawing_area_name,
                dr.id as revision_id,
                dr.revision_number,
                dr.s3_key,
                dr.filename,
                dr.file_size,
                p.name as project_name,
                p.project_number
            FROM drawings d
            INNER JOIN projects p ON d.project_id = p.id
            LEFT JOIN drawing_areas da ON d.drawing_area_id = da.id
            LEFT JOIN drawing_revisions dr ON dr.drawing_id = d.id AND dr.current = true
            WHERE d.id IN ({placeholders}) AND LOWER(d.discipline) = 'mechanical'
        """
        with cls.get_cursor() as cursor:
            cursor.execute(query, drawing_ids)
            rows = cursor.fetchall()
            return [ProcoreDrawing.from_row(dict(row)) for row in rows]

    @classmethod
    def validate_drawings_have_files(cls, drawing_ids: List[int]) -> tuple[bool, List[str]]:
        """
        Validate that all specified drawings have s3_key available.

        Args:
            drawing_ids: List of drawing IDs to validate.

        Returns:
            Tuple of (all_valid, list_of_errors).
        """
        drawings = cls.get_drawings_by_ids(drawing_ids)

        # Check for missing drawings
        found_ids = {d.id for d in drawings}
        missing_ids = set(drawing_ids) - found_ids
        errors = []

        if missing_ids:
            for missing_id in missing_ids:
                errors.append(f"Drawing with ID {missing_id} not found")

        # Check for drawings without files
        for drawing in drawings:
            if not drawing.has_file:
                errors.append(f"Drawing {drawing.drawing_number} does not have a file available")

        return len(errors) == 0, errors
