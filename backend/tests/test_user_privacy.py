import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import Conversation, Post, User
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token


def _person(prefix: str) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{prefix}-{uuid.uuid4().hex[:6]}@example.com",
        username=f"{prefix}{uuid.uuid4().hex[:8]}",
        full_name=f"{prefix} member",
        is_active=True,
    )


@pytest.mark.asyncio
async def test_email_reaches_only_its_owner(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    owner, viewer = _person("owner"), _person("viewer")
    post = Post(id=uuid.uuid4(), user_id=owner.id, content="hello")
    factory = get_session_factory()
    async with factory() as db:
        db.add_all([owner, viewer])
        await db.flush()
        db.add(post)
        await db.commit()

    def client_as(user: User) -> AsyncClient:
        app.dependency_overrides[get_user_model] = lambda: user
        return AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {_token(user)}"},
        )

    try:
        async with client_as(viewer) as client:
            responses = [
                await client.get(f"/api/v1/users/{owner.id}"),
                await client.get(f"/api/v1/posts/{post.id}"),
                await client.get(f"/api/v1/posts?user_id={owner.id}"),
                await client.get(f"/api/v1/users/search?q={owner.username}"),
                await client.post("/api/v1/messages/conversations", json={"user_id": str(owner.id)}),
            ]
            for res in responses:
                assert res.status_code == 200, f"{res.request.url} {res.text}"
                assert owner.email not in res.text, res.request.url
        async with client_as(owner) as client:
            me = await client.get("/api/v1/auth/me")
            assert me.status_code == 200
            assert me.json()["email"] == owner.email
    finally:
        app.dependency_overrides.clear()
        async with factory() as db:
            await db.execute(delete(Conversation).where(
                (Conversation.user1_id.in_([owner.id, viewer.id])) | (Conversation.user2_id.in_([owner.id, viewer.id]))
            ))
            await db.execute(delete(Post).where(Post.user_id == owner.id))
            await db.execute(delete(User).where(User.id.in_([owner.id, viewer.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
