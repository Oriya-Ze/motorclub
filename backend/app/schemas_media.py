from typing import Literal

from pydantic import BaseModel, Field

from app.media.base import MediaPurpose, MediaType, UploadMethod


class MediaUploadRequestCreate(BaseModel):
    purpose: MediaPurpose
    content_type: str = Field(min_length=3, max_length=100)
    size_bytes: int = Field(gt=0)
    filename: str | None = Field(default=None, max_length=255)


class MediaUploadRequestResponse(BaseModel):
    storage_key: str | None = None
    media_type: MediaType
    purpose: MediaPurpose
    upload_method: UploadMethod
    upload_url: str | None = None
    upload_path: str | None = None
    required_headers: dict[str, str] = Field(default_factory=dict)
    expires_in: int | None = None


class UploadFileResponse(BaseModel):
    url: str
    type: Literal["image", "video"]


class UploadMultipleResponse(BaseModel):
    files: list[UploadFileResponse]
