import re
import uuid
from uuid import UUID

from fastapi import HTTPException

from app.media.base import MediaPurpose
from app.media.validation import VALID_PURPOSES

STORAGE_KEY_PATTERN = re.compile(
    r"^users/(?P<user_id>[0-9a-f-]{36})/(?P<purpose>posts|stories|vehicles|avatar)/"
    r"(?P<media_id>[0-9a-f-]{36})\.[a-z0-9]+$"
)

PURPOSE_TO_SEGMENT: dict[MediaPurpose, str] = {
    "post": "posts",
    "story": "stories",
    "vehicle": "vehicles",
    "avatar": "avatar",
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
