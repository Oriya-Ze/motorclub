import uuid
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

import app.config as app_config
from app.media.base import MediaPurpose, MediaStorage, MediaType, UploadRequest
from app.media.validation import (
    media_type_from_content_type,
    validate_actual_size,
    validate_upload_metadata,
)


@dataclass
class SavedUpload:
    url: str
    media_type: MediaType
    storage_key: str


class LocalMediaStorage(MediaStorage):
    async def create_upload_request(
        self,
        *,
        user_id: UUID,
        purpose: MediaPurpose,
        content_type: str,
        size_bytes: int,
        original_filename: str | None,
    ) -> UploadRequest:
        media_type, _extension = validate_upload_metadata(
            content_type=content_type,
            size_bytes=size_bytes,
            original_filename=original_filename,
        )
        return UploadRequest(
            media_type=media_type,
            purpose=purpose,
            upload_method="multipart",
            upload_path="/api/v1/uploads",
            storage_key=None,
        )

    def save_multipart_file(
        self,
        *,
        content_type: str,
        data: bytes,
        original_filename: str | None,
    ) -> SavedUpload:
        media_type = media_type_from_content_type(content_type)
        validate_actual_size(len(data), media_type)
        _, extension = validate_upload_metadata(
            content_type=content_type,
            size_bytes=len(data),
            original_filename=original_filename,
        )

        filename = f"{uuid.uuid4()}{extension}"
        folder = "images" if media_type == "image" else "videos"
        dest_dir = Path(app_config.settings.upload_dir) / folder
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / filename
        dest.write_bytes(data)

        relative_url = f"/uploads/{folder}/{filename}"
        storage_key = f"{folder}/{filename}"
        return SavedUpload(
            url=relative_url,
            media_type=media_type,
            storage_key=storage_key,
        )

    def resolve_url(self, storage_key_or_legacy_path: str) -> str:
        if storage_key_or_legacy_path.startswith("http://") or storage_key_or_legacy_path.startswith("https://"):
            return storage_key_or_legacy_path
        if storage_key_or_legacy_path.startswith("/uploads/"):
            return self._local_public_url(storage_key_or_legacy_path)
        if storage_key_or_legacy_path.startswith("images/") or storage_key_or_legacy_path.startswith("videos/"):
            return self._local_public_url(f"/uploads/{storage_key_or_legacy_path}")
        if app_config.settings.media_base_url:
            return f"{app_config.settings.media_base_url.rstrip('/')}/{storage_key_or_legacy_path.lstrip('/')}"
        return f"/uploads/{storage_key_or_legacy_path.lstrip('/')}"

    @staticmethod
    def _local_public_url(relative_path: str) -> str:
        if app_config.settings.media_base_url:
            return f"{app_config.settings.media_base_url.rstrip('/')}{relative_path}"
        return relative_path
