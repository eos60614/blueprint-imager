"""
Logging configuration for Roboflow operations.

Provides structured logging with appropriate levels and formatting.
"""

import logging
import sys
from pathlib import Path


def setup_logging(
    level: str = "INFO",
    log_file: str = None,
    format_string: str = None
) -> logging.Logger:
    """
    Setup logging configuration for Roboflow operations.

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_file: Optional file path for log output
        format_string: Optional custom format string

    Returns:
        Configured logger instance
    """
    # Create logger
    logger = logging.getLogger("roboflow")
    logger.setLevel(getattr(logging, level.upper()))

    # Remove existing handlers
    logger.handlers.clear()

    # Default format
    if format_string is None:
        format_string = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

    formatter = logging.Formatter(format_string)

    # Console handler (stdout for INFO+, stderr for WARNING+)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)

    # File handler (if specified)
    if log_file:
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)

        file_handler = logging.FileHandler(log_file)
        file_handler.setLevel(logging.DEBUG)  # Log everything to file
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)

    return logger


def get_logger(name: str = "roboflow") -> logging.Logger:
    """
    Get a logger instance.

    Args:
        name: Logger name (default: "roboflow")

    Returns:
        Logger instance
    """
    logger = logging.getLogger(name)

    # Setup default configuration if logger hasn't been configured
    if not logger.handlers:
        setup_logging()

    return logger


# Create default logger instance
logger = get_logger()
