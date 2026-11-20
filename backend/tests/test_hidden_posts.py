import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_current_user, get_user_model
from app.main import app
from app.models import ContentReport, Post, ProfileSettings, User
from tests.test_user_privacy import _person


@pytest.mark.asyncio
async def test_reporting_can_hide_a_post_from_the_reporters_feed():
    author, reporter, other = _person("author"), _person("reporter"), _person("other")
    async with get_session_factory()() as db:
        db.add_all([author, reporter, other])
        await db.flush()
        db.add_all([ProfileSettings(user_id=u.id, profile_public=True) for u in (author, reporter, other)])
        posts = [Post(user_id=author.id, content=f"פוסט HIDETEST{n} #hidetest", hashtags=["hidetest"]) for n in range(2)]
        db.add_all(posts)
        await db.commit()
    bad, fine = posts
    try:
        async def feed_ids(client, **params):
            res = await client.get("/api/v1/posts", params={"limit": 100, **params})
            return {p["id"] for p in res.json()}

        for viewer in (reporter, other):
            app.dependency_overrides[get_user_model] = lambda viewer=viewer: viewer
            app.dependency_overrides[get_current_user] = lambda viewer=viewer: viewer
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                if viewer is reporter:
                    res = await client.post("/api/v1/reports", json={"target_type": "post", "target_id": str(bad.id), "reason": "spam", "hide_post": True})
                    assert res.status_code == 200
                    # Reporting again (duplicate) with hide is fine.
                    again = await client.post("/api/v1/reports", json={"target_type": "post", "target_id": str(bad.id), "reason": "spam", "hide_post": True})
                    assert again.json()["duplicate"] is True
                ids = await feed_ids(client)
                tag_ids = await feed_ids(client, hashtag="hidetest")
                search = (await client.get("/api/v1/explore/search", params={"q": "HIDETEST"})).json()
                search_ids = {p["id"] for p in search["posts"]}
                hidden = viewer is reporter
                assert (str(bad.id) in ids) is not hidden and str(fine.id) in ids
                assert (str(bad.id) in tag_ids) is not hidden
                assert (str(bad.id) in search_ids) is not hidden and str(fine.id) in search_ids
                # The post itself still opens by its link.
                assert (await client.get(f"/api/v1/posts/{bad.id}")).status_code == 200
        # The author's own profile is not affected by others hiding it.
        app.dependency_overrides[get_user_model] = lambda: author
        app.dependency_overrides[get_current_user] = lambda: author
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert str(bad.id) in await feed_ids(client, user_id=str(author.id))
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(ContentReport).where(ContentReport.reporter_id == reporter.id))
            await db.execute(delete(User).where(User.id.in_([author.id, reporter.id, other.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_member_sees_they_already_reported_and_staff_see_who():
    author, reporter, staff = _person("author2"), _person("reporter2"), _person("staff2")
    staff.is_moderator = True
    async with get_session_factory()() as db:
        db.add_all([author, reporter, staff])
        await db.flush()
        post = Post(user_id=author.id, content="פוסט")
        db.add(post)
        await db.commit()
    try:
        app.dependency_overrides[get_user_model] = lambda: reporter
        app.dependency_overrides[get_current_user] = lambda: reporter
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            params = {"target_type": "post", "target_id": str(post.id)}
            assert (await client.get("/api/v1/reports/mine", params=params)).json() == {"reported": False, "hidden": False}
            await client.post("/api/v1/reports", json={**params, "reason": "spam"})
            mine = (await client.get("/api/v1/reports/mine", params=params)).json()
            assert mine["reported"] is True and mine["status"] == "new" and mine["hidden"] is False
        app.dependency_overrides[get_user_model] = lambda: staff
        app.dependency_overrides[get_current_user] = lambda: staff
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            items = (await client.get("/api/v1/admin/reports", params={"status": "new", "limit": 50})).json()["items"]
            group = next(g for g in items if g["target_id"] == str(post.id))
            who = group["reports"][0]["reporter"]
            assert who == {"id": str(reporter.id), "username": reporter.username, "full_name": reporter.full_name}
            assert "email" not in who
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(ContentReport).where(ContentReport.reporter_id == reporter.id))
            await db.execute(delete(User).where(User.id.in_([author.id, reporter.id, staff.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
