"""
Configuration management for Blueprint Imager.
Loads settings from environment variables.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env file if it exists
env_path = Path(__file__).parent.parent / '.env'
if env_path.exists():
    load_dotenv(env_path)


class Config:
    """Application configuration loaded from environment variables."""

    # PostgreSQL Database
    DATABASE_HOST: str = os.environ.get('DATABASE_HOST', 'localhost')
    DATABASE_PORT: int = int(os.environ.get('DATABASE_PORT', '5432'))
    DATABASE_NAME: str = os.environ.get('DATABASE_NAME', 'mechdrawings')
    DATABASE_USER: str = os.environ.get('DATABASE_USER', 'postgres')
    DATABASE_PASSWORD: str = os.environ.get('DATABASE_PASSWORD', '')

    @property
    def DATABASE_URL(self) -> str:
        """PostgreSQL connection URL."""
        return f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"

    # AWS S3
    AWS_ACCESS_KEY_ID: str = os.environ.get('AWS_ACCESS_KEY_ID', '')
    AWS_SECRET_ACCESS_KEY: str = os.environ.get('AWS_SECRET_ACCESS_KEY', '')
    AWS_REGION: str = os.environ.get('AWS_REGION', 'us-east-2')
    S3_BUCKET_NAME: str = os.environ.get('S3_BUCKET_NAME', 'dwg-sets')

    # PDF Processing
    PDF_DPI: int = int(os.environ.get('PDF_DPI', '600'))
    TILE_SIZE: int = int(os.environ.get('TILE_SIZE', '1920'))
    TILE_OVERLAP: int = int(os.environ.get('TILE_OVERLAP', '250'))

    # Upload limits
    MAX_FILE_SIZE: int = int(os.environ.get('MAX_FILE_SIZE', str(500 * 1024 * 1024)))  # 500MB

    # Procore OAuth (existing)
    PROCORE_CLIENT_ID: str = os.environ.get('PROCORE_CLIENT_ID', '')
    PROCORE_CLIENT_SECRET: str = os.environ.get('PROCORE_CLIENT_SECRET', '')
    PROCORE_API_BASE_URL: str = os.environ.get('PROCORE_API_BASE_URL', 'https://sandbox.procore.com')
    PROCORE_AUTH_BASE_URL: str = os.environ.get('PROCORE_AUTH_BASE_URL', 'https://login-sandbox.procore.com')
    PROCORE_COMPANY_ID: str = os.environ.get('PROCORE_COMPANY_ID', '')

    # Procore PostgreSQL Database (external, read-only)
    # Supports both URI format (procore_int_v2_DB_URI) and individual vars
    _PROCORE_DB_URI: str = os.environ.get('procore_int_v2_DB_URI', '')

    @property
    def PROCORE_DB_HOST(self) -> str:
        if self._PROCORE_DB_URI:
            # Parse from URI: postgresql://user:pass@host:port/dbname
            from urllib.parse import urlparse
            parsed = urlparse(self._PROCORE_DB_URI)
            return parsed.hostname or ''
        return os.environ.get('PROCORE_DB_HOST', '')

    @property
    def PROCORE_DB_PORT(self) -> int:
        if self._PROCORE_DB_URI:
            from urllib.parse import urlparse
            parsed = urlparse(self._PROCORE_DB_URI)
            return parsed.port or 5432
        return int(os.environ.get('PROCORE_DB_PORT', '5432'))

    @property
    def PROCORE_DB_NAME(self) -> str:
        if self._PROCORE_DB_URI:
            from urllib.parse import urlparse
            parsed = urlparse(self._PROCORE_DB_URI)
            return parsed.path.lstrip('/') if parsed.path else 'procore_int_v2'
        return os.environ.get('PROCORE_DB_NAME', 'procore_int_v2')

    @property
    def PROCORE_DB_USER(self) -> str:
        if self._PROCORE_DB_URI:
            from urllib.parse import urlparse
            parsed = urlparse(self._PROCORE_DB_URI)
            return parsed.username or ''
        return os.environ.get('PROCORE_DB_USER', '')

    @property
    def PROCORE_DB_PASSWORD(self) -> str:
        if self._PROCORE_DB_URI:
            from urllib.parse import urlparse
            parsed = urlparse(self._PROCORE_DB_URI)
            return parsed.password or ''
        return os.environ.get('PROCORE_DB_PASSWORD', '')

    # Procore S3 Bucket (for drawing files)
    PROCORE_S3_BUCKET: str = os.environ.get('procore_int_v2_S3_BUCKET_NAME', os.environ.get('PROCORE_S3_BUCKET', ''))
    PROCORE_AWS_ACCESS_KEY_ID: str = os.environ.get('procore_int_v2_AWS_ACCESS_KEY_ID', '')
    PROCORE_AWS_SECRET_ACCESS_KEY: str = os.environ.get('procore_int_v2_AWS_SECRET_ACCESS_KEY', '')

    # CORS (comma-separated list of allowed origins)
    CORS_ORIGINS: list = os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,https://*.vercel.app'
    ).split(',')

    # Roboflow
    ROBOFLOW_API_KEY: str = os.environ.get('ROBOFLOW_API_KEY', '')
    ROBOFLOW_PROJECT_NAME: str = os.environ.get('ROBOFLOW_PROJECT_NAME', '')

    # Local Tile Storage
    LOCAL_TILE_STORAGE_PATH: str = os.environ.get('LOCAL_TILE_STORAGE_PATH', '/var/data/tiles')
    TILE_TTL_HOURS: int = int(os.environ.get('TILE_TTL_HOURS', '24'))


config = Config()
