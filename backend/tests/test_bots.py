import asyncio
import random
import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import BotConfig, BotItem, Comment, Notification, Post, PostLike, ProfileSettings, User
from app.services import bots
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token
from tests.test_user_privacy import _person

# 12:00 in Israel, inside the active hours.
NOON = datetime(2026, 11, 19, 10, 0, tzinfo=UTC)


def _content(tag: str) -> dict:
    return {
        "personas": [
            {"key": "a", "username": f"bota{tag}", "full_name": "בוט א."},
            {"key": "b", "username": f"botb{tag}", "full_name": "בוט ב."},
        ],
        "posts": [
            {"id": f"{tag}1", "bot": "a", "text": "פוסט ראשון", "hashtags": ["טיפים"],
             "replies": [{"bot": "b", "text": "תגובה", "after_min": 30}]},
            {"id": f"{tag}2", "bot": "b", "text": "פוסט שני", "hashtags": [], "replies": []},
        ],
    }


class _Always(random.Random):
    """Dice that always pass, so a tick's chances are not left to luck in tests."""

    def random(self) -> float:
        return 0.0


async def _cleanup(*users: User) -> None:
    async with get_session_factory()() as db:
        await bots.delete_all_bots(db)
        if users:
            await db.execute(delete(User).where(User.id.in_([u.id for u in users])))
        await db.execute(delete(BotConfig))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def test_content_is_validated():
    good = _content("v")
    assert len(bots.parse_content(good)["posts"]) == 2
    bad_cases = [
        {"personas": [], "posts": []},
        {**good, "posts": [{**good["posts"][0], "bot": "nobody"}]},
        {**good, "posts": [good["posts"][0], good["posts"][0]]},
        {**good, "personas": [{**good["personas"][0], "username": "admin"}]},
        {**good, "posts": [{**good["posts"][0], "hashtags": ["two words"]}]},
        {**good, "posts": [{**good["posts"][0], "replies": [{"bot": "a", "text": "x", "after_min": -1}]}]},
    ]
    for case in bad_cases:
        with pytest.raises(bots.BotContentError):
            bots.parse_content(case)


@pytest.mark.asyncio
async def test_bots_publish_reply_like_and_go_away():
    tag = uuid.uuid4().hex[:6]
    member = _person("member")
    member_post = Post(user_id=member.id, content="הפוסט של חבר", created_at=NOON - timedelta(hours=5))
    async with get_session_factory()() as db:
        db.add(member)
        await db.flush()
        db.add_all([ProfileSettings(user_id=member.id, profile_public=True), member_post])
        await db.commit()
    try:
        async with get_session_factory()() as db:
            summary = await bots.load_content(db, _content(tag))
            await db.commit()
            assert summary == {"bots_created": 2, "bots": 2, "queued": 3, "updated": 0}
            again = await bots.load_content(db, _content(tag))
            await db.commit()
            assert again["bots_created"] == 0 and again["queued"] == 0, "a second upload does not duplicate"

            bot_a = await db.scalar(select(User).where(User.username == f"bota{tag}"))
            assert bot_a.is_bot and bot_a.password_hash is None and bot_a.cognito_sub is None

            assert await bots.run_tick(db, now=NOON, rng=_Always()) == {"skipped": "disabled"}
            await bots.set_enabled(db, True)
            await db.commit()
            night = datetime(2026, 11, 19, 23, 30, tzinfo=UTC)  # 01:30 in Israel
            assert await bots.run_tick(db, now=night, rng=_Always()) == {"skipped": "quiet_hours"}

            first = await bots.run_tick(db, now=NOON, rng=_Always())
            assert first["post"] == f"{tag}1" and first["replies"] == []
            post = await db.scalar(select(Post).join(BotItem, BotItem.post_id == Post.id).where(BotItem.item_key == f"{tag}1"))
            assert post.content.endswith("#טיפים") and post.hashtags == ["טיפים"]
            assert post.moderation_status == "published" and post.hidden_at is None

            # Twenty minutes later: no new post (two hours apart), and the reply is not due yet (30 minutes).
            soon = await bots.run_tick(db, now=NOON + timedelta(minutes=20), rng=_Always())
            assert soon["post"] is None and soon["replies"] == []
            later = await bots.run_tick(db, now=NOON + timedelta(minutes=40), rng=_Always())
            assert later["replies"] == [f"{tag}1.r1"]
            comment = await db.scalar(select(Comment).where(Comment.post_id == post.id))
            assert comment.content == "תגובה"

            # Likes: a member's post gets liked with the usual notification; bots never pass three likes on a post.
            liked: list[str] = []
            for i in range(8):
                result = await bots.run_tick(db, now=NOON + timedelta(hours=3, minutes=i), rng=_Always(), force=False)
                if result["like"]:
                    liked.append(result["like"])
            bot_ids = select(User.id).where(User.is_bot.is_(True))
            for post_id in set(liked):
                count = await db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == uuid.UUID(post_id), PostLike.user_id.in_(bot_ids)))
                assert count <= bots.MAX_BOT_LIKES_PER_POST
            own = await db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == bot_a.id))
            assert own == 0, "a bot does not like its own post"
            member_likes = await db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == member_post.id))
            assert member_likes >= 1
            note = await db.scalar(select(Notification).where(Notification.user_id == member.id, Notification.type == "like"))
            assert note is not None and "liked your post" in note.title

            status = await bots.bot_status(db)
            assert status["enabled"] and status["posts"]["published"] >= 1 and status["replies"]["published"] == 1

            removed = await bots.delete_all_bots(db)
            await db.commit()
            db.expunge_all()  # read what the database holds now, not the session's copies
            assert removed["bots"] == 2 and removed["notifications"] >= 1
            assert await db.scalar(select(func.count()).select_from(User).where(User.is_bot.is_(True))) == 0
            assert await db.get(Post, post.id) is None
            assert await db.scalar(select(func.count()).select_from(PostLike).where(PostLike.post_id == member_post.id)) == 0
            assert await db.scalar(select(func.count()).select_from(Notification).where(Notification.user_id == member.id, Notification.type == "like")) == 0
            assert (await db.get(BotConfig, bots.CONFIG_ID)).enabled is False
    finally:
        await _cleanup(member)


@pytest.mark.asyncio
async def test_a_post_past_its_date_is_skipped():
    tag = uuid.uuid4().hex[:6]
    content = _content(tag)
    content["posts"][0]["expires"] = "2026-11-18"  # the day before NOON
    content["posts"][1]["expires"] = "2026-11-19"  # still today in Israel
    with pytest.raises(bots.BotContentError):
        bots.parse_content({**content, "posts": [{**content["posts"][0], "expires": "next week"}]})
    try:
        async with get_session_factory()() as db:
            await bots.load_content(db, content)
            await db.commit()
            result = await bots.run_tick(db, now=NOON, rng=_Always(), force=True)
            assert result["post"] == f"{tag}2", "the expired post is passed over"
            status = await bots.bot_status(db)
            assert status["posts"]["expired"] == 1
            later = await db.scalar(select(BotItem).where(BotItem.item_key == f"{tag}1"))
            assert later.published_at is None
    finally:
        await _cleanup()


@pytest.mark.asyncio
async def test_bot_username_cannot_take_a_member():
    member = _person("taken")
    async with get_session_factory()() as db:
        db.add(member)
        await db.commit()
    try:
        content = _content("x")
        content["personas"][0]["username"] = member.username
        async with get_session_factory()() as db:
            with pytest.raises(bots.BotContentError):
                await bots.load_content(db, content)
            await db.rollback()
    finally:
        await _cleanup(member)


@pytest.mark.asyncio
async def test_bot_controls_are_for_system_admins_only(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    member, admin = _person("plain"), _person("sysadmin")
    admin.is_admin = True
    async with get_session_factory()() as db:
        db.add_all([member, admin])
        await db.commit()
    tag = uuid.uuid4().hex[:6]
    try:
        for user, allowed in ((member, False), (admin, True)):
            app.dependency_overrides[get_user_model] = lambda user=user: user
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test",
                                   headers={"Authorization": f"Bearer {_token(user)}"}) as client:
                res = await client.get("/api/v1/admin/bots")
                assert (res.status_code == 200) is allowed, res.text
                if not allowed:
                    continue
                bad = await client.put("/api/v1/admin/bots/content", json={"personas": []})
                assert bad.status_code == 400 and bad.json()["detail"].startswith("bot_content_invalid")
                ok = await client.put("/api/v1/admin/bots/content", json=_content(tag))
                assert ok.status_code == 200 and ok.json()["queued"] == 3
                forced = await client.post("/api/v1/admin/bots/tick", json={"force": True})
                assert forced.status_code == 200 and forced.json()["post"] == f"{tag}1"
                assert (await client.patch("/api/v1/admin/bots", json={"enabled": True})).json() == {"enabled": True}
                assert (await client.request("DELETE", "/api/v1/admin/bots", json={"confirm": "כן"})).status_code == 400
                gone = await client.request("DELETE", "/api/v1/admin/bots", json={"confirm": "מחק בוטים"})
                assert gone.status_code == 200 and gone.json()["bots"] == 2
            # The scheduled route answers only the marked Lambda event, never a request from outside.
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                assert (await client.post("/api/v1/internal/bots/tick")).status_code == 404
    finally:
        app.dependency_overrides.clear()
        await _cleanup(member, admin)


def test_scheduled_event_reaches_the_tick(monkeypatch):
    pytest.importorskip("mangum")
    from app import handler as lambda_handler

    calls = []

    async def fake_tick(db, **kwargs):
        calls.append(kwargs)
        return {"skipped": "disabled"}

    monkeypatch.setattr(bots, "run_tick", fake_tick)

    class Context:
        aws_request_id = "test"

    # Lambda's main thread has an event loop; pytest closes its own after async tests.
    asyncio.set_event_loop(asyncio.new_event_loop())
    response = lambda_handler.handler({"motorclub_task": "bot_tick"}, Context())
    assert response["statusCode"] == 200 and calls == [{}]
    # An outside request with the same path is not marked, so it is turned away.
    outside = lambda_handler._internal_event("bot_tick", "/api/v1/internal/bots/tick")
    del outside["motorclub_internal"]
    assert lambda_handler.handler(outside, Context())["statusCode"] == 404


def _jpeg(color: str = "red") -> bytes:
    import io

    from PIL import Image

    out = io.BytesIO()
    Image.new("RGB", (900, 600), color).save(out, "JPEG")
    return out.getvalue()


@pytest.mark.asyncio
async def test_bot_photos_profile_and_post(monkeypatch, tmp_path):
    import app.config as app_config

    monkeypatch.setattr(app_config.settings, "media_storage_provider", "local")
    monkeypatch.setattr(app_config.settings, "upload_dir", str(tmp_path))
    tag = uuid.uuid4().hex[:6]
    content = _content(tag)
    content["personas"][0].update({"avatar": "a.jpg", "bio": "  GTI מ־2019,   ימי מסלול בסופ\"ש  "})
    content["posts"][0]["images"] = ["p1.jpg"]
    bad = _content(tag)
    for broken in ({"avatar": "../x.jpg"}, {"bio": "x" * 200}):
        with pytest.raises(bots.BotContentError):
            bots.parse_content({**bad, "personas": [{**bad["personas"][0], **broken}, bad["personas"][1]]})
    with pytest.raises(bots.BotContentError):
        bots.parse_content({**bad, "posts": [{**bad["posts"][0], "images": ["a.gif"]}, bad["posts"][1]]})
    try:
        async with get_session_factory()() as db:
            await bots.load_content(db, content)
            await db.commit()
            bot_a = await db.scalar(select(User).where(User.username == f"bota{tag}"))
            assert bot_a.bio == 'GTI מ־2019, ימי מסלול בסופ"ש'
            status = await bots.bot_status(db)
            assert status["missing_images"] == ["a.jpg", "p1.jpg"]

            # The first post waits for its photo; the second one goes out meanwhile.
            first = await bots.run_tick(db, now=NOON, rng=_Always(), force=True)
            assert first["post"] == f"{tag}2"

            with pytest.raises(bots.BotImageError):
                await bots.store_image(db, "unused.jpg", _jpeg())
            with pytest.raises(bots.BotImageError):
                await bots.store_image(db, "p1.jpg", b"not an image")
            avatar = await bots.store_image(db, "a.jpg", _jpeg("blue"))
            photo = await bots.store_image(db, "p1.jpg", _jpeg())
            await db.commit()
            assert avatar["used_by"] == [f"avatar:a"] or avatar["used_by"][0].startswith("avatar:")
            await db.refresh(bot_a)
            assert bot_a.profile_picture_url.startswith(f"users/{bot_a.id}/avatar/")
            assert (tmp_path / bot_a.profile_picture_url).is_file()

            second = await bots.run_tick(db, now=NOON + timedelta(hours=3), rng=_Always(), force=True)
            assert second["post"] == f"{tag}1"
            post = await db.scalar(select(Post).join(BotItem, BotItem.post_id == Post.id).where(BotItem.item_key == f"{tag}1"))
            assert post.image_urls and post.image_urls[0].startswith(f"users/{bot_a.id}/posts/")
            assert (tmp_path / post.image_urls[0]).is_file()
            assert (await bots.bot_status(db))["missing_images"] == []

            # A published post keeps its photo: a later upload of the same name no longer applies to it.
            assert photo["used_by"] == [f"{tag}1"]
            with pytest.raises(bots.BotImageError):
                await bots.store_image(db, "p1.jpg", _jpeg("green"))

            removed = await bots.delete_all_bots(db)
            await db.commit()
            bots.delete_bot_files(removed)
            assert not (tmp_path / post.image_urls[0]).exists() and not (tmp_path / bot_a.profile_picture_url).exists()
    finally:
        await _cleanup()
