from datetime import UTC, datetime

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import Post, ProfileSettings, User
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token
from tests.test_user_privacy import _person


@pytest.mark.asyncio
async def test_explore_search_finds_visible_posts_and_hashtags(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    viewer, public, private = _person("viewer"), _person("public"), _person("private")
    users = [viewer, public, private]
    word = f"zq{public.id.hex[:6]}"
    photo = Post(user_id=public.id, content=f"track day {word}", image_urls=[f"users/{public.id}/posts/a.jpg"], hashtags=[word])
    text = Post(user_id=public.id, content=f"only text {word.upper()}")
    tagged = Post(user_id=public.id, content="no word here", hashtags=[f"{word}life", word])
    video = Post(user_id=public.id, content=f"clip {word}", video_urls=[f"users/{public.id}/posts/v.mp4"])
    hidden = Post(user_id=public.id, content=f"hidden {word}", hidden_at=datetime.now(UTC), moderation_status="draft")
    secret = Post(user_id=private.id, content=f"private {word}", hashtags=[word])
    async with get_session_factory()() as db:
        db.add_all(users)
        await db.flush()
        db.add_all([
            ProfileSettings(user_id=public.id, profile_public=True),
            ProfileSettings(user_id=private.id, profile_public=False),
            photo, text, tagged, video, hidden, secret,
        ])
        await db.commit()

    app.dependency_overrides[get_user_model] = lambda: viewer
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"Authorization": f"Bearer {_token(viewer)}"},
        ) as client:
            res = await client.get("/api/v1/explore/search", params={"q": word})
            assert res.status_code == 200, res.text
            body = res.json()
            found = {item["id"]: item for item in body["posts"]}
            assert set(found) == {str(photo.id), str(text.id), str(tagged.id), str(video.id)}, "hidden and private posts stay out"
            assert found[str(photo.id)]["kind"] == "image" and found[str(photo.id)]["thumbnail"]
            assert found[str(text.id)]["kind"] == "text" and found[str(text.id)]["thumbnail"] is None
            assert found[str(video.id)]["kind"] == "video", "a video without a still frame still shows"
            assert "email" not in found[str(photo.id)]["author"]
            tags = body["hashtags"]
            assert tags[0] == {"tag": word, "count": 2}, "the exact tag first, without the private post"
            assert {"tag": f"{word}life", "count": 1} in tags

            by_tag = (await client.get("/api/v1/explore/search", params={"q": f"#{word}life"})).json()
            assert [item["id"] for item in by_tag["posts"]] == [str(tagged.id)]

            wildcard = (await client.get("/api/v1/explore/search", params={"q": "%"})).json()
            assert all("%" in (item["content"] or "") for item in wildcard["posts"]), "% is a literal, not a wildcard"
            assert (await client.get("/api/v1/explore/search", params={"q": "#"})).json() == {"posts": [], "hashtags": []}
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id.in_([user.id for user in users])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
