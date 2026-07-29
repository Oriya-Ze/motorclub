import uuid

import pytest
from fastapi import HTTPException

from app.media.local import LocalMediaStorage
from tests.conftest import reload_settings


@pytest.mark.asyncio
async def test_local_create_upload_request_returns_multipart() -> None:
    storage = LocalMediaStorage()
    user_id = uuid.uuid4()
    request = await storage.create_upload_request(
        user_id=user_id,
        purpose="post",
        content_type="image/jpeg",
        size_bytes=1024,
        original_filename="photo.jpg",
    )
    assert request.upload_method == "multipart"
    assert request.upload_path == "/api/v1/uploads"
    assert request.storage_key is None
    assert request.media_type == "image"


@pytest.mark.asyncio
async def test_local_save_multipart_file(tmp_upload_dir) -> None:
    storage = LocalMediaStorage()
    saved = storage.save_multipart_file(
        content_type="image/jpeg",
        data=b"fake-jpeg-bytes",
        original_filename="photo.jpg",
    )
    assert saved.url.startswith("/uploads/images/")
    assert saved.media_type == "image"


def test_local_save_rejects_oversized_file(tmp_upload_dir, monkeypatch) -> None:
    monkeypatch.setenv("MAX_IMAGE_UPLOAD_BYTES", "10")
    reload_settings()
    storage = LocalMediaStorage()
    with pytest.raises(HTTPException) as exc:
        storage.save_multipart_file(
            content_type="image/jpeg",
            data=b"x" * 20,
            original_filename="photo.jpg",
        )
    assert exc.value.status_code == 400


def test_local_resolve_legacy_upload_path() -> None:
    storage = LocalMediaStorage()
    assert storage.resolve_url("/uploads/images/test.jpg") == "/uploads/images/test.jpg"
