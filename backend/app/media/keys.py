import re
import uuid
from dataclasses import dataclass
from uuid import UUID

from fastapi import HTTPException

from app.media.base import MediaPurpose
from app.media.validation import VALID_PURPOSES

VIDEO_SUFFIXES = (".mp4", ".mov", ".webm")

STORAGE_KEY_PATTERN = re.compile(
    r"^users/(?P<user_id>[0-9a-f-]{36})/(?P<purpose>posts|stories|vehicles|avatar|products)/"
    r"(?P<media_id>[0-9a-f-]{36})\.[a-z0-9]+$"
)

PURPOSE_TO_SEGMENT: dict[MediaPurpose, str] = {
    "post": "posts",
    "story": "stories",
    "vehicle": "vehicles",
    "avatar": "avatar",
    "product": "products",
}


def generate_storage_key(*, user_id: UUID, purpose: MediaPurpose, extension: str) -> str:
    if purpose not in VALID_PURPOSES:
        raise HTTPException(status_code=400, detail=f"Unsupported purpose: {purpose}")
    ext = extension if extension.startswith(".") else f".{extension}"
    segment = PURPOSE_TO_SEGMENT[purpose]
    return f"users/{user_id}/{segment}/{uuid.uuid4()}{ext}"


def assert_key_owned_by_user(storage_key: str, user_id: UUID) -> None:
    validate_storage_key(storage_key)
    prefix = f"users/{user_id}/"
    if not storage_key.startswith(prefix):
        raise HTTPException(status_code=403, detail="Storage key does not belong to user")


@dataclass(frozen=True)
class ParsedStorageKey:
    user_id: UUID
    purpose_segment: str
    media_id: UUID
    extension: str


def parse_storage_key(storage_key: str) -> ParsedStorageKey:
    validate_storage_key(storage_key)
    if storage_key.startswith("/uploads/"):
        raise HTTPException(status_code=400, detail="Legacy upload path cannot be parsed")
    match = STORAGE_KEY_PATTERN.match(storage_key)
    if not match:
        raise HTTPException(status_code=400, detail="Invalid storage key format")
    ext = storage_key.rsplit(".", 1)[-1].lower()
    return ParsedStorageKey(
        user_id=UUID(match.group("user_id")),
        purpose_segment=match.group("purpose"),
        media_id=UUID(match.group("media_id")),
        extension=f".{ext}",
    )


def media_id_from_storage_key(storage_key: str) -> UUID:
    return parse_storage_key(storage_key).media_id


def processed_video_dir(user_id: UUID, media_id: UUID) -> str:
    return f"users/{user_id}/videos/{media_id}"


def processed_video_key(user_id: UUID, media_id: UUID, name: str) -> str:
    return f"{processed_video_dir(user_id, media_id)}/{name}"


def is_video_storage_key(storage_key: str) -> bool:
    return storage_key.lower().endswith(VIDEO_SUFFIXES)


def validate_storage_key(storage_key: str) -> None:
    if not storage_key:
        raise HTTPException(status_code=400, detail="Invalid storage key")
    if storage_key.startswith("/uploads/"):
        return
    if storage_key.startswith("/"):
        raise HTTPException(status_code=400, detail="Invalid storage key")
    if ".." in storage_key or "\\" in storage_key:
        raise HTTPException(status_code=400, detail="Invalid storage key")
    if not STORAGE_KEY_PATTERN.match(storage_key):
        raise HTTPException(status_code=400, detail="Invalid storage key format")
