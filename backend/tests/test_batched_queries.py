import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import Conversation, DirectMessage, Follower, ProfileSettings, User
from app.services.visibility import can_view_profile_content, viewable_owner_ids
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token
from tests.test_user_privacy import _person


async def _cleanup(users: list[User]) -> None:
    async with get_session_factory()() as db:
        await db.execute(delete(User).where(User.id.in_([user.id for user in users])))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_batch_visibility_matches_the_single_check():
    viewer, public, private, followed, pending = (_person(name) for name in ("viewer", "public", "private", "followed", "pending"))
    users = [viewer, public, private, followed, pending]
    async with get_session_factory()() as db:
        db.add_all(users)
        await db.flush()
        db.add_all([
            ProfileSettings(user_id=public.id, profile_public=True),
            ProfileSettings(user_id=private.id, profile_public=False),
            ProfileSettings(user_id=followed.id, profile_public=False),
            ProfileSettings(user_id=pending.id, profile_public=False),
            ProfileSettings(user_id=viewer.id, profile_public=False),
            Follower(follower_id=viewer.id, following_id=followed.id, status="accepted"),
            Follower(follower_id=viewer.id, following_id=pending.id, status="pending"),
        ])
        await db.commit()
    try:
        owner_ids = [user.id for user in users]
        async with get_session_factory()() as db:
            for viewer_id in (viewer.id, None):
                expected = {
                    owner_id for owner_id in owner_ids if await can_view_profile_content(db, owner_id, viewer_id)
                }
                assert await viewable_owner_ids(db, owner_ids, viewer_id) == expected
            assert await viewable_owner_ids(db, owner_ids, viewer.id) == {viewer.id, public.id, followed.id}
            assert await viewable_owner_ids(db, [], viewer.id) == set()
    finally:
        await _cleanup(users)


@pytest.mark.asyncio
async def test_conversation_list_shows_last_message_and_unread_per_side(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    me, friend, other = _person("me"), _person("friend"), _person("other")
    users = [me, friend, other]
    now = datetime.now(UTC)
    with_friend = Conversation(id=uuid.uuid4(), user1_id=me.id, user2_id=friend.id)
    with_other = Conversation(id=uuid.uuid4(), user1_id=other.id, user2_id=me.id)
    async with get_session_factory()() as db:
        db.add_all(users)
        await db.flush()
        db.add_all([with_friend, with_other])
        await db.flush()
        db.add_all([
            DirectMessage(conversation_id=with_friend.id, sender_id=friend.id, content="first", created_at=now - timedelta(minutes=5)),
            DirectMessage(conversation_id=with_friend.id, sender_id=friend.id, content="second", created_at=now - timedelta(minutes=4)),
            DirectMessage(conversation_id=with_friend.id, sender_id=me.id, content="mine", created_at=now - timedelta(minutes=3)),
            DirectMessage(conversation_id=with_other.id, sender_id=other.id, content="read", is_read=True, created_at=now - timedelta(minutes=1)),
        ])
        await db.commit()

    app.dependency_overrides[get_user_model] = lambda: me
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {_token(me)}"},
        ) as client:
            res = await client.get("/api/v1/messages/conversations")
        assert res.status_code == 200, res.text
        summaries = [(item["other_user"]["id"], item["last_message"], item["unread_count"]) for item in res.json()]
        assert summaries == [(str(other.id), "read", 0), (str(friend.id), "mine", 2)]
    finally:
        app.dependency_overrides.clear()
        await _cleanup(users)
