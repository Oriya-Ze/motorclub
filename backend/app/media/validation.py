from pathlib import Path

from fastapi import HTTPException

import app.config as app_config
from app.media.base import MediaPurpose, MediaType

ALLOWED_IMAGE_MIMES = frozenset({"image/jpeg", "image/png", "image/webp", "image/gif"})
ALLOWED_VIDEO_MIMES = frozenset({"video/mp4", "video/webm", "video/quicktime"})

MIME_TO_EXTENSIONS: dict[str, frozenset[str]] = {
    "image/jpeg": frozenset({".jpg", ".jpeg"}),
    "image/png": frozenset({".png"}),
    "image/webp": frozenset({".webp"}),
    "image/gif": frozenset({".gif"}),
    "video/mp4": frozenset({".mp4"}),
    "video/webm": frozenset({".webm"}),
    "video/quicktime": frozenset({".mov"}),
}

EXTENSION_TO_MIME: dict[str, str] = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".mov": "video/quicktime",
}

VALID_PURPOSES = frozenset({"post", "story", "vehicle", "avatar"})


def media_type_from_content_type(content_type: str) -> MediaType:
    normalized = content_type.split(";", 1)[0].strip().lower()
    if normalized in ALLOWED_IMAGE_MIMES:
        return "image"
    if normalized in ALLOWED_VIDEO_MIMES:
        return "video"
    raise HTTPException(status_code=400, detail="Unsupported file type")


def validate_purpose(purpose: str) -> MediaPurpose:
    if purpose not in VALID_PURPOSES:
        raise HTTPException(status_code=400, detail=f"Unsupported purpose: {purpose}")
    return purpose  # type: ignore[return-value]


def normalize_extension(filename: str | None, content_type: str) -> str:
    ext = Path(filename or "").suffix.lower()
    normalized_type = content_type.split(";", 1)[0].strip().lower()

    if ext:
        if ext not in EXTENSION_TO_MIME:
            raise HTTPException(status_code=400, detail="Unsupported file extension")
        expected_mime = EXTENSION_TO_MIME[ext]
        if expected_mime != normalized_type:
            raise HTTPException(status_code=400, detail="File extension does not match content type")
        allowed = MIME_TO_EXTENSIONS.get(normalized_type)
        if not allowed or ext not in allowed:
            raise HTTPException(status_code=400, detail="Unsupported file extension")
        return ext

    allowed = MIME_TO_EXTENSIONS.get(normalized_type)
    if not allowed:
        raise HTTPException(status_code=400, detail="Unsupported file type")
    return sorted(allowed)[0]


def max_upload_bytes(media_type: MediaType) -> int:
    if media_type == "image":
        return app_config.settings.max_image_upload_bytes
    return app_config.settings.max_video_upload_bytes


def validate_declared_size(size_bytes: int, media_type: MediaType) -> None:
    if size_bytes <= 0:
        raise HTTPException(status_code=400, detail="size_bytes must be positive")
    limit = max_upload_bytes(media_type)
    if size_bytes > limit:
        raise HTTPException(status_code=400, detail=f"File too large (max {limit // (1024 * 1024)}MB)")


def validate_actual_size(actual_bytes: int, media_type: MediaType) -> None:
    if actual_bytes <= 0:
        raise HTTPException(status_code=400, detail="Empty file")
    limit = max_upload_bytes(media_type)
    if actual_bytes > limit:
        raise HTTPException(status_code=400, detail=f"File too large (max {limit // (1024 * 1024)}MB)")


def validate_upload_metadata(
    *,
    content_type: str,
    size_bytes: int,
    original_filename: str | None,
) -> tuple[MediaType, str]:
    media_type = media_type_from_content_type(content_type)
    validate_declared_size(size_bytes, media_type)
    extension = normalize_extension(original_filename, content_type)
    return media_type, extension
