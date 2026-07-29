from uuid import UUID

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from fastapi import HTTPException

import app.config as app_config
from app.media.base import MediaPurpose, MediaStorage, UploadRequest
from app.media.keys import generate_storage_key
from app.media.validation import validate_upload_metadata


class S3MediaStorage(MediaStorage):
    def __init__(self) -> None:
        if not app_config.settings.s3_media_bucket:
            raise ValueError("S3_MEDIA_BUCKET is required when MEDIA_STORAGE_PROVIDER=s3")
        self._bucket = app_config.settings.s3_media_bucket
        self._client = boto3.client("s3", region_name=app_config.settings.aws_region)

    async def create_upload_request(
        self,
        *,
        user_id: UUID,
        purpose: MediaPurpose,
        content_type: str,
        size_bytes: int,
        original_filename: str | None,
    ) -> UploadRequest:
        media_type, extension = validate_upload_metadata(
            content_type=content_type,
            size_bytes=size_bytes,
            original_filename=original_filename,
        )
        normalized_type = content_type.split(";", 1)[0].strip().lower()
        storage_key = generate_storage_key(user_id=user_id, purpose=purpose, extension=extension)

        try:
            upload_url = self._client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self._bucket,
                    "Key": storage_key,
                    "ContentType": normalized_type,
                },
                ExpiresIn=app_config.settings.s3_presigned_url_expiry_seconds,
            )
        except (BotoCoreError, ClientError) as exc:
            raise HTTPException(status_code=503, detail="Unable to create upload URL") from exc

        return UploadRequest(
            storage_key=storage_key,
            media_type=media_type,
            purpose=purpose,
            upload_method="PUT",
            upload_url=upload_url,
            required_headers={"Content-Type": normalized_type},
            expires_in=app_config.settings.s3_presigned_url_expiry_seconds,
        )

    def resolve_url(self, storage_key_or_legacy_path: str) -> str:
        if storage_key_or_legacy_path.startswith("http://") or storage_key_or_legacy_path.startswith("https://"):
            return storage_key_or_legacy_path
        if storage_key_or_legacy_path.startswith("/uploads/"):
            if app_config.settings.media_base_url:
                return f"{app_config.settings.media_base_url.rstrip('/')}{storage_key_or_legacy_path}"
            return storage_key_or_legacy_path
        if not app_config.settings.media_base_url:
            raise ValueError("MEDIA_BASE_URL is required to resolve S3 storage keys")
        return f"{app_config.settings.media_base_url.rstrip('/')}/{storage_key_or_legacy_path.lstrip('/')}"
