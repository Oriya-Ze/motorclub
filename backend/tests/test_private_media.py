import uuid
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import get_user_model
from app.main import app
from app.media.keys import generate_storage_key, is_private_storage_key, public_storage_key
from app.models import User
from app.services.image_moderation import scan_bytes
from app.services.media_gate import (
    delete_media_object,
    promote_private_image,
    read_media_bytes,
    restore_public_image,
    takedown_public_image,
    write_local_bytes,
)
from tests.conftest import reload_settings


def test_image_keys_are_private_until_promoted(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    monkeypatch.setenv("REKOGNITION_MOCK_DECISION", "approved")
    reload_settings()
    from app.config import settings
    key = generate_storage_key(user_id=uuid.uuid4(), purpose="product", extension=".jpg", private=True)
    assert is_private_storage_key(key)
    write_local_bytes(key, b"jpeg-bytes")
    assert not (Path(settings.upload_dir) / key).exists()
    public = promote_private_image(key)
    assert public == public_storage_key(key)
    assert read_media_bytes(public) == b"jpeg-bytes"
    assert not (Path(settings.private_upload_dir) / key).exists()


def test_takedown_removes_public_original_and_thumbnails(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("MEDIA_DISTRIBUTION_ID", "")
    reload_settings()
    from app.config import settings

    key = generate_storage_key(user_id=uuid.uuid4(), purpose="product", extension=".jpg", private=True)
    write_local_bytes(key, b"approved-bytes")
    public = promote_private_image(key)
    parts = public.split("/")
    media_id = parts[-1].rsplit(".", 1)[0]
    thumb = f"users/{parts[1]}/images/{media_id}/thumb.webp"
    display = f"users/{parts[1]}/images/{media_id}/display.webp"
    write_local_bytes(thumb, b"thumb")
    write_local_bytes(display, b"display")
    removed = takedown_public_image(public)
    assert f"/{public}" in removed
    assert f"/{thumb}" in removed
    assert f"/{display}" in removed
    assert not (Path(settings.upload_dir) / public).exists()
    assert not (Path(settings.upload_dir) / thumb).exists()
    restored = restore_public_image(public)
    assert f"/{public}" in restored
    assert read_media_bytes(public) == b"approved-bytes"
    assert read_media_bytes(thumb) == b"thumb"


def test_takedown_invalidates_cloudfront_when_distribution_is_configured(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "s3")
    monkeypatch.setenv("S3_MEDIA_BUCKET", "motorclub-test-media")
    monkeypatch.setenv("AWS_REGION", "eu-central-1")
    monkeypatch.setenv("MEDIA_DISTRIBUTION_ID", "E123TEST")
    reload_settings()
    calls: list[dict] = []

    class FakeS3:
        def head_object(self, **kwargs):
            return {}

        def get_object(self, **kwargs):
            class Body:
                def read(self, _n=None):
                    return b"bytes"

            return {"Body": Body()}

        def put_object(self, **kwargs):
            return {}

        def delete_object(self, **kwargs):
            return {}

    class FakeCloudFront:
        def create_invalidation(self, **kwargs):
            calls.append(kwargs)
            return {}

    def client(name, **kwargs):
        if name == "cloudfront":
            return FakeCloudFront()
        return FakeS3()

    monkeypatch.setattr("boto3.client", client)
    from app.services.media_gate import takedown_public_image

    key = "users/11111111-1111-1111-1111-111111111111/products/abc.jpg"
    takedown_public_image(key)
    assert calls
    items = calls[0]["InvalidationBatch"]["Paths"]["Items"]
    assert "/users/11111111-1111-1111-1111-111111111111/products/abc.jpg" in items
    assert any(item.endswith("/thumb.webp") for item in items)
    assert calls[0]["DistributionId"] == "E123TEST"


def test_rejected_image_stays_out_of_public_dir(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    reload_settings()
    from app.config import settings
    key = generate_storage_key(user_id=uuid.uuid4(), purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"secret")
    delete_media_object(key)
    assert not (Path(settings.private_upload_dir) / key).exists()
    assert not (Path(settings.upload_dir) / public_storage_key(key)).exists()


def test_mock_mode_cannot_approve_outside_local(monkeypatch):
    import app.config as config_module

    monkeypatch.setattr(config_module.settings, "environment", "production")
    monkeypatch.setattr(config_module.settings, "rekognition_mode", "mock")
    decision = scan_bytes(b"abc")
    assert decision.decision == "error"
    assert decision.error_message == "mock_forbidden_outside_local"


@pytest.mark.asyncio
async def test_other_user_cannot_read_private_file(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("JWT_SECRET", "dev-secret")
    reload_settings()
    owner = User(id=uuid.uuid4(), email="a@example.com", username="a", full_name="A", password_hash="x", is_active=True)
    stranger = User(id=uuid.uuid4(), email="b@example.com", username="b", full_name="B", password_hash="x", is_active=True)
    key = generate_storage_key(user_id=owner.id, purpose="avatar", extension=".jpg", private=True)
    write_local_bytes(key, b"avatar-bytes")

    async def as_stranger() -> User:
        return stranger

    app.dependency_overrides[get_user_model] = as_stranger
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        denied = await client.get("/api/v1/media/private-file", params={"key": key})
    app.dependency_overrides.clear()
    assert denied.status_code == 403

    async def as_owner() -> User:
        return owner

    app.dependency_overrides[get_user_model] = as_owner
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        allowed = await client.get("/api/v1/media/private-file", params={"key": key})
    app.dependency_overrides.clear()
    assert allowed.status_code == 200
    assert allowed.content == b"avatar-bytes"
