"""
Progress reporting utilities for long-running operations.

Provides progress tracking with percentage, elapsed time, and ETA calculations.
"""

import time
from typing import Optional
from collections import deque


class ProgressTracker:
    """Track progress of batch operations with ETA calculation."""

    def __init__(self, total: int, description: str = "Processing"):
        """
        Initialize progress tracker.

        Args:
            total: Total number of items to process
            description: Description of the operation
        """
        self.total = total
        self.current = 0
        self.description = description
        self.start_time = time.time()
        self.last_update_time = self.start_time

        # Track recent completion times for ETA calculation (rolling average)
        self.recent_durations = deque(maxlen=10)

    def update(self, increment: int = 1):
        """Update progress by incrementing current count."""
        now = time.time()
        duration = now - self.last_update_time

        if duration > 0:  # Avoid division by zero
            self.recent_durations.append(duration / increment)

        self.current += increment
        self.last_update_time = now

    @property
    def percentage(self) -> float:
        """Calculate progress percentage."""
        if self.total == 0:
            return 0.0
        return (self.current / self.total) * 100

    @property
    def elapsed_time(self) -> float:
        """Get elapsed time in seconds."""
        return time.time() - self.start_time

    @property
    def elapsed_time_str(self) -> str:
        """Get formatted elapsed time string (e.g., '5m 23s')."""
        return self._format_duration(self.elapsed_time)

    @property
    def eta(self) -> Optional[float]:
        """
        Calculate estimated time remaining in seconds.

        Returns None if not enough data for accurate estimate.
        """
        if self.current == 0 or not self.recent_durations:
            return None

        remaining = self.total - self.current
        if remaining <= 0:
            return 0.0

        # Use average duration from recent operations
        avg_duration = sum(self.recent_durations) / len(self.recent_durations)
        return remaining * avg_duration

    @property
    def eta_str(self) -> str:
        """Get formatted ETA string (e.g., '10m 12s')."""
        eta = self.eta
        if eta is None:
            return "calculating..."
        return self._format_duration(eta)

    @property
    def is_complete(self) -> bool:
        """Check if processing is complete."""
        return self.current >= self.total

    def _format_duration(self, seconds: float) -> str:
        """
        Format duration in seconds to human-readable string.

        Examples:
            - 65 seconds -> "1m 5s"
            - 3665 seconds -> "1h 1m 5s"
        """
        if seconds < 0:
            seconds = 0

        hours = int(seconds // 3600)
        minutes = int((seconds % 3600) // 60)
        secs = int(seconds % 60)

        parts = []
        if hours > 0:
            parts.append(f"{hours}h")
        if minutes > 0:
            parts.append(f"{minutes}m")
        parts.append(f"{secs}s")

        return " ".join(parts)

    def format_progress(self) -> str:
        """
        Format progress line for display.

        Returns string like:
        "Uploading: 350/1000 images (35.0%) | 5m 23s elapsed | ETA: 10m 12s"
        """
        return (
            f"{self.description}: {self.current}/{self.total} "
            f"({self.percentage:.1f}%) | "
            f"{self.elapsed_time_str} elapsed | "
            f"ETA: {self.eta_str}"
        )

    def print_progress(self, end: str = "\r"):
        """Print progress line (with carriage return for in-place update)."""
        print(self.format_progress(), end=end, flush=True)

    def print_final(self):
        """Print final progress line with newline."""
        self.print_progress(end="\n")


def format_bytes(bytes_count: int) -> str:
    """
    Format byte count to human-readable string.

    Examples:
        - 1024 -> "1.0 KB"
        - 1048576 -> "1.0 MB"
        - 1073741824 -> "1.0 GB"
    """
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if bytes_count < 1024.0:
            return f"{bytes_count:.1f} {unit}"
        bytes_count /= 1024.0
    return f"{bytes_count:.1f} PB"


def format_rate(items_per_second: float, item_name: str = "items") -> str:
    """
    Format processing rate.

    Examples:
        - 50.5 -> "50.5 items/s"
        - 0.5 -> "30.0 items/min"
    """
    if items_per_second >= 1.0:
        return f"{items_per_second:.1f} {item_name}/s"
    else:
        items_per_minute = items_per_second * 60
        return f"{items_per_minute:.1f} {item_name}/min"
