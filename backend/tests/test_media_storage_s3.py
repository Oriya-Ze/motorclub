import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.config import Settings
from app.media.factory import get_media_storage, reset_media_storage_cache
from app.media.s3 import S3MediaStorage
from tests.conftest import reload_settings


@pytest.mark.asyncio
async def test_s3_create_upload_request_presigned_put(monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_MEDIA_BUCKET", "test-bucket")
    monkeypatch.setenv("MEDIA_BASE_URL", "https://media.example.com")
    monkeypatch.setenv("ENVIRONMENT", "local")
    reload_settings()

    mock_client = MagicMock()
    mock_client.generate_presigned_url.return_value = "https://s3.example.com/presigned"

    with patch("app.media.s3.boto3.client", return_value=mock_client):
        storage = S3MediaStorage()
        user_id = uuid.uuid4()
        request = await storage.create_upload_request(
            user_id=user_id,
            purpose="story",
            content_type="video/mp4",
            size_bytes=2048,
            original_filename="clip.mp4",
        )

    assert request.upload_method == "PUT"
    assert request.upload_url == "https://s3.example.com/presigned"
    assert request.storage_key.startswith(f"users/{user_id}/stories/")
    assert request.required_headers == {"Content-Type": "video/mp4"}
    mock_client.generate_presigned_url.assert_called_once()


def test_s3_factory_requires_bucket(monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_MEDIA_BUCKET", "")
    monkeypatch.setenv("ENVIRONMENT", "local")
    reset_media_storage_cache()

    with pytest.raises(ValueError, match="S3_MEDIA_BUCKET"):
        Settings()

    monkeypatch.setenv("S3_MEDIA_BUCKET", "test-bucket")
    reload_settings()
    with patch("app.media.s3.boto3.client", return_value=MagicMock()):
        storage = get_media_storage()
    assert isinstance(storage, S3MediaStorage)


def test_s3_resolve_url_uses_media_base_url(monkeypatch) -> None:
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_MEDIA_BUCKET", "test-bucket")
    monkeypatch.setenv("MEDIA_BASE_URL", "https://media.example.com")
    reload_settings()
    with patch("app.media.s3.boto3.client", return_value=MagicMock()):
        storage = S3MediaStorage()
    key = f"users/{uuid.uuid4()}/posts/abc.jpg"
    assert storage.resolve_url(key) == f"https://media.example.com/{key}"
