"""
Roboflow client for uploading images to Roboflow datasets.
Uses presigned S3 URLs to upload directly without local storage.
"""

import random
import urllib.parse
from typing import List, Optional
import requests

from ..config import config


class RoboflowClient:
    """Client for uploading images to Roboflow via the API."""

    API_URL = "https://api.roboflow.com"

    # Split ratios: 70% train, 20% valid, 10% test
    SPLIT_WEIGHTS = [
        ("train", 70),
        ("valid", 20),
        ("test", 10),
    ]

    def __init__(
        self,
        api_key: Optional[str] = None,
        project_name: Optional[str] = None
    ):
        self.api_key = api_key or config.ROBOFLOW_API_KEY
        self.project_name = project_name or config.ROBOFLOW_PROJECT_NAME

        if not self.api_key:
            raise ValueError("Roboflow API key is required")
        if not self.project_name:
            raise ValueError("Roboflow project name is required")

    def _get_random_split(self) -> str:
        """Get a random split based on weighted distribution (70/20/10)."""
        total = sum(weight for _, weight in self.SPLIT_WEIGHTS)
        rand = random.randint(1, total)
        cumulative = 0
        for split, weight in self.SPLIT_WEIGHTS:
            cumulative += weight
            if rand <= cumulative:
                return split
        return "train"  # Fallback

    def upload_image(
        self,
        presigned_url: str,
        image_name: str,
        split: Optional[str] = None
    ) -> dict:
        """
        Upload a single image to Roboflow using a presigned S3 URL.

        Args:
            presigned_url: Presigned S3 URL for the image
            image_name: Name for the image in Roboflow
            split: Dataset split (train/valid/test). If None, assigned randomly.

        Returns:
            dict with 'success' (bool) and 'error' (str or None)
        """
        if split is None:
            split = self._get_random_split()

        # Build the upload URL
        upload_url = "".join([
            self.API_URL + "/dataset/" + self.project_name + "/upload",
            "?api_key=" + self.api_key,
            "&name=" + urllib.parse.quote_plus(image_name),
            "&split=" + split,
            "&image=" + urllib.parse.quote_plus(presigned_url),
        ])

        try:
            response = requests.post(upload_url, timeout=30)

            if response.status_code == 200:
                return {"success": True, "error": None, "split": split}
            else:
                error_msg = response.content.decode('utf-8')
                return {"success": False, "error": error_msg, "split": split}

        except requests.exceptions.Timeout:
            return {"success": False, "error": "Request timed out", "split": split}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e), "split": split}

    def upload_batch(
        self,
        tiles: List[dict]
    ) -> dict:
        """
        Upload multiple tiles to Roboflow with random split assignment.

        Args:
            tiles: List of dicts with 'presigned_url' and 'image_name'

        Returns:
            dict with:
                - total: Total number of tiles
                - successful: Number successfully uploaded
                - failed: Number that failed
                - errors: List of error messages
                - splits: Dict with counts per split {train: N, valid: N, test: N}
        """
        total = len(tiles)
        successful = 0
        failed = 0
        errors = []
        splits = {"train": 0, "valid": 0, "test": 0}

        for tile in tiles:
            result = self.upload_image(
                presigned_url=tile['presigned_url'],
                image_name=tile['image_name']
            )

            if result['success']:
                successful += 1
                splits[result['split']] += 1
            else:
                failed += 1
                error_msg = f"{tile['image_name']}: {result['error']}"
                errors.append(error_msg)

        return {
            "total": total,
            "successful": successful,
            "failed": failed,
            "errors": errors,
            "splits": splits,
        }
