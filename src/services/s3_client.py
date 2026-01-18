import uuid
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from ..config import config


def get_procore_s3_client() -> 'S3Client':
    """Create an S3Client configured for the Procore S3 bucket."""
    return S3Client(
        bucket_name=config.PROCORE_S3_BUCKET,
        access_key_id=config.PROCORE_AWS_ACCESS_KEY_ID,
        secret_access_key=config.PROCORE_AWS_SECRET_ACCESS_KEY
    )


class S3Client:
    def __init__(
        self,
        bucket_name: Optional[str] = None,
        region: Optional[str] = None,
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None
    ):
        self.bucket_name = bucket_name or config.S3_BUCKET_NAME
        self.region = region or config.AWS_REGION

        session_kwargs = {}
        # Use provided credentials or fall back to config
        key_id = access_key_id or config.AWS_ACCESS_KEY_ID
        secret_key = secret_access_key or config.AWS_SECRET_ACCESS_KEY

        if key_id and secret_key:
            session_kwargs['aws_access_key_id'] = key_id
            session_kwargs['aws_secret_access_key'] = secret_key

        # Use virtual-hosted-style URLs with region for proper signing
        self.s3 = boto3.client(
            's3',
            region_name=self.region,
            config=boto3.session.Config(
                signature_version='s3v4',
                s3={'addressing_style': 'virtual'}
            ),
            **session_kwargs
        )

    def generate_presigned_upload_url(
        self,
        file_name: str,
        content_type: str = 'application/pdf',
        expires_in: int = 900
    ) -> dict:
        """
        Generate a presigned URL for uploading a file directly to S3.

        Args:
            file_name: Original filename (used for metadata)
            content_type: MIME type of the file
            expires_in: URL expiration time in seconds (default: 15 minutes)

        Returns:
            dict with uploadUrl, s3Key, and expiresIn
        """
        upload_id = str(uuid.uuid4())
        s3_key = f"uploads/{upload_id}/document.pdf"

        presigned_url = self.s3.generate_presigned_url(
            'put_object',
            Params={
                'Bucket': self.bucket_name,
                'Key': s3_key,
                'ContentType': content_type,
                'Metadata': {
                    'original-filename': file_name
                }
            },
            ExpiresIn=expires_in
        )

        return {
            'uploadUrl': presigned_url,
            's3Key': s3_key,
            'expiresIn': expires_in
        }

    def generate_presigned_download_url(
        self,
        s3_key: str,
        download_filename: Optional[str] = None,
        expires_in: int = 3600
    ) -> str:
        """
        Generate a presigned URL for downloading a file from S3.

        Args:
            s3_key: S3 object key
            download_filename: Filename for Content-Disposition header
            expires_in: URL expiration time in seconds (default: 1 hour)

        Returns:
            Presigned download URL
        """
        params = {
            'Bucket': self.bucket_name,
            'Key': s3_key
        }

        if download_filename:
            params['ResponseContentDisposition'] = f'attachment; filename="{download_filename}"'

        return self.s3.generate_presigned_url(
            'get_object',
            Params=params,
            ExpiresIn=expires_in
        )

    def check_object_exists(self, s3_key: str) -> bool:
        """Check if an object exists in S3."""
        try:
            self.s3.head_object(Bucket=self.bucket_name, Key=s3_key)
            return True
        except ClientError as e:
            if e.response['Error']['Code'] == '404':
                return False
            raise

    def get_object_size(self, s3_key: str) -> int:
        """Get the size of an object in bytes."""
        response = self.s3.head_object(Bucket=self.bucket_name, Key=s3_key)
        return response['ContentLength']

    def download_file(self, s3_key: str, local_path: str) -> None:
        """Download a file from S3 to a local path."""
        self.s3.download_file(self.bucket_name, s3_key, local_path)

    def upload_file(self, local_path: str, s3_key: str, content_type: Optional[str] = None) -> None:
        """Upload a file to S3."""
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type

        self.s3.upload_file(local_path, self.bucket_name, s3_key, ExtraArgs=extra_args or None)

    def upload_fileobj(self, fileobj, s3_key: str, content_type: Optional[str] = None) -> None:
        """Upload a file-like object to S3."""
        extra_args = {}
        if content_type:
            extra_args['ContentType'] = content_type

        self.s3.upload_fileobj(fileobj, self.bucket_name, s3_key, ExtraArgs=extra_args or None)

    def upload_bytes(self, data: bytes, s3_key: str, content_type: Optional[str] = None) -> None:
        """Upload bytes directly to S3."""
        import io
        fileobj = io.BytesIO(data)
        self.upload_fileobj(fileobj, s3_key, content_type)

    def download_bytes(self, s3_key: str) -> bytes:
        """Download an S3 object as bytes."""
        import io
        fileobj = io.BytesIO()
        self.s3.download_fileobj(self.bucket_name, s3_key, fileobj)
        fileobj.seek(0)
        return fileobj.read()

    def list_objects(self, prefix: str) -> list:
        """List objects with a given prefix."""
        response = self.s3.list_objects_v2(
            Bucket=self.bucket_name,
            Prefix=prefix
        )
        return response.get('Contents', [])

    def delete_object(self, s3_key: str) -> None:
        """Delete an object from S3."""
        self.s3.delete_object(Bucket=self.bucket_name, Key=s3_key)
