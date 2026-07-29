import io

import pytest
from httpx import ASGITransport, AsyncClient

from app.deps import get_user_model
from app.main import app
from tests.conftest import reload_settings


@pytest.fixture
async def unauthenticated_client() -> AsyncClient:
    app.dependency_overrides.pop(get_user_model, None)
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_upload_request_unauthenticated(unauthenticated_client: AsyncClient) -> None:
    response = await unauthenticated_client.post(
        "/api/v1/media/upload-requests",
        json={
            "purpose": "post",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
            "filename": "photo.jpg",
        },
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_upload_request_local_multipart(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/media/upload-requests",
        json={
            "purpose": "post",
            "content_type": "image/jpeg",
            "size_bytes": 1024,
            "filename": "photo.jpg",
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["upload_method"] == "multipart"
    assert body["upload_path"] == "/api/v1/uploads"
    assert body["media_type"] == "image"
    assert body["purpose"] == "post"
    assert body["storage_key"] is None


@pytest.mark.asyncio
async def test_upload_request_rejects_unsupported_mime(client: AsyncClient) -> None:
    response = await client.post(
        "/api/v1/media/upload-requests",
        json={
            "purpose": "post",
            "content_type": "application/pdf",
            "size_bytes": 1024,
            "filename": "doc.pdf",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_multipart_upload_validates_actual_size(client: AsyncClient, tmp_upload_dir, monkeypatch) -> None:
    monkeypatch.setenv("MAX_IMAGE_UPLOAD_BYTES", str(1024))
    reload_settings()
    large = b"x" * 1025
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("big.jpg", io.BytesIO(large), "image/jpeg")},
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_multipart_upload_success(client: AsyncClient, tmp_upload_dir) -> None:
    response = await client.post(
        "/api/v1/uploads",
        files={"file": ("photo.jpg", io.BytesIO(b"jpeg-data"), "image/jpeg")},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["type"] == "image"
    assert body["url"].startswith("/uploads/images/")


@pytest.mark.asyncio
async def test_multipart_multiple_upload(client: AsyncClient, tmp_upload_dir) -> None:
    response = await client.post(
        "/api/v1/uploads/multiple",
        files=[
            ("files", ("a.jpg", io.BytesIO(b"a"), "image/jpeg")),
            ("files", ("b.jpg", io.BytesIO(b"b"), "image/jpeg")),
        ],
    )
    assert response.status_code == 200
    assert len(response.json()["files"]) == 2
