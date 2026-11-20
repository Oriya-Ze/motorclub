import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.database import get_engine, get_session_factory
from app.deps import get_current_user, get_user_model
from app.main import app
from app.models import Notification, Post, ProfileSettings, User
from tests.test_user_privacy import _person


@pytest.mark.asyncio
async def test_notifications_lead_to_what_they_are_about():
    owner, fan = _person("owner"), _person("fan")
    async with get_session_factory()() as db:
        db.add_all([owner, fan])
        await db.flush()
        db.add_all([ProfileSettings(user_id=u.id, profile_public=True) for u in (owner, fan)])
        post = Post(user_id=owner.id, content="פוסט לבדיקת התראות")
        db.add(post)
        await db.commit()
    try:
        app.dependency_overrides[get_user_model] = lambda: fan
        app.dependency_overrides[get_current_user] = lambda: fan
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            comment = (await client.post(f"/api/v1/posts/{post.id}/comments", json={"content": "תגובה"})).json()
            assert (await client.post(f"/api/v1/posts/{post.id}/like")).status_code == 200
            assert (await client.post(f"/api/v1/users/{owner.id}/follow")).status_code == 200
        async with get_session_factory()() as db:
            links = dict((await db.execute(select(Notification.type, Notification.link).where(Notification.user_id == owner.id))).all())
        assert links["comment"] == f"/posts/{post.id}?comment={comment['id']}"
        assert links["like"] == f"/posts/{post.id}"
        assert links["follow"] == f"/profile/{fan.id}"
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id.in_([owner.id, fan.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
