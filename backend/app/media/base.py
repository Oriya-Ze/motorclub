"""Media storage abstraction.

Design note — future S3 Multipart Upload
-----------------------------------------
The upload-request response is intentionally provider-agnostic. Clients branch on
``upload_method`` (``PUT``, ``multipart``, and later ``s3_multipart``) rather than
hard-coding S3 semantics. For large video files, an S3 provider can extend
``create_upload_request`` to return multipart upload IDs and part URLs while keeping
the same ``POST /api/v1/media/upload-requests`` contract and ``storage_key`` field.
The React upload layer (Phase 3B) should treat ``upload_method`` as the only switch.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Literal
from uuid import UUID

MediaType = Literal["image", "video"]
MediaPurpose = Literal["post", "story", "vehicle", "avatar"]
UploadMethod = Literal["PUT", "multipart"]


@dataclass
class UploadRequest:
    media_type: MediaType
    purpose: MediaPurpose
    upload_method: UploadMethod
    storage_key: str | None = None
    upload_url: str | None = None
    upload_path: str | None = None
    required_headers: dict[str, str] = field(default_factory=dict)
    expires_in: int | None = None


class MediaStorage(ABC):
    @abstractmethod
    async def create_upload_request(
        self,
        *,
        user_id: UUID,
        purpose: MediaPurpose,
        content_type: str,
        size_bytes: int,
        original_filename: str | None,
    ) -> UploadRequest:
        """Validate metadata and return provider-specific upload instructions."""

    @abstractmethod
    def resolve_url(self, storage_key_or_legacy_path: str) -> str:
        """Turn a storage key or legacy ``/uploads/...`` path into a fetch URL."""
