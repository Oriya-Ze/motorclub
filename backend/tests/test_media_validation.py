import uuid

import pytest
from fastapi import HTTPException

from app.media.keys import assert_key_owned_by_user, generate_storage_key, validate_storage_key
from app.media.validation import (
    media_type_from_content_type,
    normalize_extension,
    validate_declared_size,
    validate_upload_metadata,
)
from tests.conftest import reload_settings


def test_media_type_from_content_type_image() -> None:
    assert media_type_from_content_type("image/jpeg") == "image"


def test_media_type_from_content_type_video() -> None:
    assert media_type_from_content_type("video/mp4") == "video"


def test_unsupported_mime_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        media_type_from_content_type("application/pdf")
    assert exc.value.status_code == 400


def test_unsupported_extension_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_extension("malware.exe", "image/jpeg")
    assert exc.value.status_code == 400


def test_extension_mismatch_rejected() -> None:
    with pytest.raises(HTTPException) as exc:
        normalize_extension("photo.png", "image/jpeg")
    assert exc.value.status_code == 400


def test_oversized_declared_size_rejected(monkeypatch) -> None:
    monkeypatch.setenv("MAX_IMAGE_UPLOAD_BYTES", "100")
    reload_settings()
    with pytest.raises(HTTPException) as exc:
        validate_declared_size(101, "image")
    assert exc.value.status_code == 400


def test_validate_upload_metadata_success() -> None:
    media_type, ext = validate_upload_metadata(
        content_type="image/jpeg",
        size_bytes=1024,
        original_filename="photo.jpg",
    )
    assert media_type == "image"
    assert ext == ".jpg"


def test_generate_storage_key_uses_user_prefix() -> None:
    user_id = uuid.uuid4()
    key = generate_storage_key(user_id=user_id, purpose="post", extension=".jpg")
    assert key.startswith(f"users/{user_id}/posts/")
    assert key.endswith(".jpg")


def test_duplicate_requests_get_unique_keys() -> None:
    user_id = uuid.uuid4()
    key_a = generate_storage_key(user_id=user_id, purpose="post", extension=".jpg")
    key_b = generate_storage_key(user_id=user_id, purpose="post", extension=".jpg")
    assert key_a != key_b


def test_validate_storage_key_rejects_traversal() -> None:
    with pytest.raises(HTTPException):
        validate_storage_key("../etc/passwd")


def test_assert_key_owned_by_user_rejects_other_user() -> None:
    owner = uuid.uuid4()
    other = uuid.uuid4()
    key = generate_storage_key(user_id=owner, purpose="post", extension=".jpg")
    with pytest.raises(HTTPException) as exc:
        assert_key_owned_by_user(key, other)
    assert exc.value.status_code == 403


def test_legacy_upload_path_is_valid_key() -> None:
    validate_storage_key("/uploads/images/abc.jpg")
