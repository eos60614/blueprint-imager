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
    MAX_FILE_SIZE: int = int(os.environ.get('MAX_FILE_SIZE', str(100 * 1024 * 1024)))  # 100MB

    # Procore (existing)
    PROCORE_CLIENT_ID: str = os.environ.get('PROCORE_CLIENT_ID', '')
    PROCORE_CLIENT_SECRET: str = os.environ.get('PROCORE_CLIENT_SECRET', '')
    PROCORE_API_BASE_URL: str = os.environ.get('PROCORE_API_BASE_URL', 'https://sandbox.procore.com')
    PROCORE_AUTH_BASE_URL: str = os.environ.get('PROCORE_AUTH_BASE_URL', 'https://login-sandbox.procore.com')
    PROCORE_COMPANY_ID: str = os.environ.get('PROCORE_COMPANY_ID', '')

    # CORS (comma-separated list of allowed origins)
    CORS_ORIGINS: list = os.environ.get(
        'CORS_ORIGINS',
        'http://localhost:3000,https://*.vercel.app'
    ).split(',')


config = Config()
