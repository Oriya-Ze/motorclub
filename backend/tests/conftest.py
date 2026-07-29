import uuid
from collections.abc import AsyncGenerator, Generator

import pytest
from httpx import ASGITransport, AsyncClient

import app.config as config_module
from app.config import Settings
from app.deps import get_user_model
from app.main import app
from app.media.factory import reset_media_storage_cache
from app.models import User


def reload_settings() -> Settings:
    config_module.settings = Settings()
    reset_media_storage_cache()
    return config_module.settings


@pytest.fixture(autouse=True)
def _reset_settings() -> Generator[None, None, None]:
    reload_settings()
    yield
    reload_settings()


@pytest.fixture(autouse=True)
def _reset_media_storage() -> Generator[None, None, None]:
    reset_media_storage_cache()
    yield
    reset_media_storage_cache()


@pytest.fixture
def test_user() -> User:
    return User(
        id=uuid.uuid4(),
        email="uploader@example.com",
        username="uploader",
        full_name="Test Uploader",
        password_hash="hash",
        is_active=True,
    )


@pytest.fixture
def auth_headers(test_user: User) -> dict[str, str]:
    from jose import jwt

    from app.config import settings

    token = jwt.encode(
        {"sub": str(test_user.id), "email": test_user.email},
        settings.jwt_secret,
        algorithm=settings.jwt_algorithm,
    )
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def client(test_user: User) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_user_model() -> User:
        return test_user

    app.dependency_overrides[get_user_model] = override_get_user_model
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest.fixture
def tmp_upload_dir(tmp_path, monkeypatch) -> str:
    upload_dir = tmp_path / "uploads"
    upload_dir.mkdir()
    monkeypatch.setenv("UPLOAD_DIR", str(upload_dir))
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("ENVIRONMENT", "local")
    reload_settings()
    return str(upload_dir)
