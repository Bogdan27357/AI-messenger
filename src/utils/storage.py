"""MinIO object storage client for document management."""

import logging
from io import BytesIO
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from src.core.config import settings

logger = logging.getLogger(__name__)


class StorageClient:
    """MinIO S3-compatible storage for documents, KPs, receipts."""

    def __init__(self):
        self._client: Minio | None = None

    @property
    def client(self) -> Minio:
        if self._client is None:
            self._client = Minio(
                endpoint=settings.minio.endpoint,
                access_key=settings.minio.access_key,
                secret_key=settings.minio.secret_key,
                secure=settings.minio.secure,
            )
            self._ensure_bucket()
        return self._client

    def _ensure_bucket(self) -> None:
        bucket = settings.minio.bucket
        if not self._client.bucket_exists(bucket):
            self._client.make_bucket(bucket)
            logger.info("Created MinIO bucket: %s", bucket)

    def upload_file(self, file_path: str, object_name: str) -> str:
        """Upload a local file to MinIO.

        Returns the object path in the bucket.
        """
        path = Path(file_path)
        self.client.fput_object(
            settings.minio.bucket,
            object_name,
            file_path,
            content_type=self._guess_content_type(path.suffix),
        )
        logger.info("Uploaded %s -> %s/%s", file_path, settings.minio.bucket, object_name)
        return f"{settings.minio.bucket}/{object_name}"

    def upload_bytes(self, data: bytes, object_name: str, content_type: str = "application/octet-stream") -> str:
        """Upload bytes to MinIO."""
        self.client.put_object(
            settings.minio.bucket,
            object_name,
            BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return f"{settings.minio.bucket}/{object_name}"

    def download_file(self, object_name: str, local_path: str) -> str:
        """Download a file from MinIO."""
        self.client.fget_object(settings.minio.bucket, object_name, local_path)
        return local_path

    def get_bytes(self, object_name: str) -> bytes:
        """Get file content as bytes."""
        response = self.client.get_object(settings.minio.bucket, object_name)
        try:
            return response.read()
        finally:
            response.close()
            response.release_conn()

    def list_objects(self, prefix: str = "") -> list[str]:
        """List objects with the given prefix."""
        objects = self.client.list_objects(settings.minio.bucket, prefix=prefix, recursive=True)
        return [obj.object_name for obj in objects]

    def delete_object(self, object_name: str) -> None:
        """Delete an object from storage."""
        self.client.remove_object(settings.minio.bucket, object_name)

    @staticmethod
    def _guess_content_type(suffix: str) -> str:
        mapping = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".csv": "text/csv",
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".html": "text/html",
        }
        return mapping.get(suffix.lower(), "application/octet-stream")


storage_client = StorageClient()
