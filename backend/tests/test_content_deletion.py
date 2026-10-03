import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.media.keys import generate_storage_key, public_storage_key
from app.models import Comment, Forum, ForumReply, ForumTopic, Group, Post, Product, Story, User, Vehicle
from app.services.media_gate import _object_exists, write_local_bytes
from tests.conftest import reload_settings


def _local_env(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    reload_settings()


def _person(prefix: str, **extra) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        username=f"{prefix}{uuid.uuid4().hex[:8]}",
        full_name=prefix,
        is_active=True,
        **extra,
    )


async def _add(*rows) -> None:
    async with get_session_factory()() as db:
        for row in rows:
            db.add(row)
            await db.flush()
        await db.commit()


async def _drop_users(*users: User) -> None:
    async with get_session_factory()() as db:
        for user in users:
            await db.execute(delete(Post).where(Post.user_id == user.id))
            await db.execute(delete(User).where(User.id == user.id))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _public_image_with_copies(owner: User, purpose: str = "post") -> tuple[str, list[str]]:
    """A promoted upload plus the display and thumb copies the media Lambda writes."""
    key = public_storage_key(generate_storage_key(user_id=owner.id, purpose=purpose, extension=".jpg", private=True))
    media_id = key.rsplit("/", 1)[-1].split(".")[0]
    copies = [
        f"users/{owner.id}/images/{media_id}/display.webp",
        f"users/{owner.id}/images/{media_id}/thumb.webp",
    ]
    for obj in [key, *copies]:
        write_local_bytes(obj, b"image")
    return key, [key, *copies]


def _client_as(user: User) -> AsyncClient:
    from tests.test_post_publication_moderation import _token

    app.dependency_overrides[get_user_model] = lambda: user
    return AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {_token(user)}"},
    )


@pytest.mark.asyncio
async def test_deleting_a_post_removes_its_processed_copies(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner = _person("d")
    await _add(owner)
    key, objects = _public_image_with_copies(owner)
    post = Post(id=uuid.uuid4(), user_id=owner.id, content="x", image_urls=[key])
    await _add(post)
    try:
        async with _client_as(owner) as client:
            res = await client.delete(f"/api/v1/posts/{post.id}")
            assert res.status_code == 200, res.text
        assert not any(_object_exists(obj) for obj in objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner)


@pytest.mark.asyncio
async def test_a_file_another_row_still_uses_is_kept(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner = _person("k")
    await _add(owner)
    key, objects = _public_image_with_copies(owner)
    first = Post(id=uuid.uuid4(), user_id=owner.id, content="a", image_urls=[key])
    second = Post(id=uuid.uuid4(), user_id=owner.id, content="b", image_urls=[key])
    await _add(first, second)
    try:
        async with _client_as(owner) as client:
            assert (await client.delete(f"/api/v1/posts/{first.id}")).status_code == 200
        assert all(_object_exists(obj) for obj in objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner)


@pytest.mark.asyncio
async def test_deleting_a_product_and_a_vehicle_removes_their_images(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner = _person("p")
    await _add(owner)
    product_key, product_objects = _public_image_with_copies(owner, "product")
    vehicle_key, vehicle_objects = _public_image_with_copies(owner, "vehicle")
    product = Product(id=uuid.uuid4(), business_id=owner.id, name="x", price=1, image_urls=[product_key])
    vehicle = Vehicle(id=uuid.uuid4(), user_id=owner.id, make="Mazda", model="MX-5", image_urls=[vehicle_key])
    await _add(product, vehicle)
    try:
        async with _client_as(owner) as client:
            assert (await client.delete(f"/api/v1/marketplace/{product.id}")).status_code == 200
            assert (await client.delete(f"/api/v1/garage/{vehicle.id}")).status_code == 200
        assert not any(_object_exists(obj) for obj in product_objects + vehicle_objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner)


@pytest.mark.asyncio
async def test_replacing_an_image_deletes_the_old_one_but_not_the_kept_one(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner = _person("r")
    await _add(owner)
    kept, kept_objects = _public_image_with_copies(owner, "vehicle")
    dropped, dropped_objects = _public_image_with_copies(owner, "vehicle")
    vehicle = Vehicle(id=uuid.uuid4(), user_id=owner.id, make="Mazda", model="MX-5", image_urls=[kept, dropped])
    await _add(vehicle)
    try:
        async with _client_as(owner) as client:
            res = await client.patch(f"/api/v1/garage/{vehicle.id}", json={"image_urls": [kept]})
            assert res.status_code == 200, res.text
        assert all(_object_exists(obj) for obj in kept_objects)
        assert not any(_object_exists(obj) for obj in dropped_objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner)


@pytest.mark.asyncio
async def test_comment_can_be_deleted_by_its_author_or_the_post_owner_only(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner, author, stranger = _person("o"), _person("a"), _person("s")
    await _add(owner, author, stranger)
    post = Post(id=uuid.uuid4(), user_id=owner.id, content="x")
    first = Comment(id=uuid.uuid4(), post_id=post.id, user_id=author.id, content="1")
    second = Comment(id=uuid.uuid4(), post_id=post.id, user_id=author.id, content="2")
    await _add(post, first, second)
    try:
        async with _client_as(stranger) as client:
            assert (await client.delete(f"/api/v1/posts/{post.id}/comments/{first.id}")).status_code == 403
        async with _client_as(author) as client:
            assert (await client.delete(f"/api/v1/posts/{post.id}/comments/{first.id}")).status_code == 200
        async with _client_as(owner) as client:
            assert (await client.delete(f"/api/v1/posts/{post.id}/comments/{second.id}")).status_code == 200
        async with get_session_factory()() as db:
            assert (await db.execute(select(Comment).where(Comment.post_id == post.id))).first() is None
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner, author, stranger)


@pytest.mark.asyncio
async def test_forum_topic_and_reply_can_be_deleted_by_their_author(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    author, stranger = _person("f"), _person("g")
    await _add(author, stranger)
    forum = Forum(id=uuid.uuid4(), name=f"forum-{uuid.uuid4().hex[:6]}", topics_count=1)
    topic = ForumTopic(id=uuid.uuid4(), forum_id=forum.id, user_id=author.id, title="t", content="c")
    reply = ForumReply(id=uuid.uuid4(), topic_id=topic.id, user_id=author.id, content="r")
    await _add(forum, topic, reply)
    try:
        async with _client_as(stranger) as client:
            assert (await client.delete(f"/api/v1/forums/replies/{reply.id}")).status_code == 403
            assert (await client.delete(f"/api/v1/forums/topics/{topic.id}")).status_code == 403
        async with _client_as(author) as client:
            assert (await client.delete(f"/api/v1/forums/replies/{reply.id}")).status_code == 200
            assert (await client.delete(f"/api/v1/forums/topics/{topic.id}")).status_code == 200
        async with get_session_factory()() as db:
            assert (await db.get(Forum, forum.id)).topics_count == 0
            await db.execute(delete(Forum).where(Forum.id == forum.id))
            await db.commit()
    finally:
        app.dependency_overrides.clear()
        await _drop_users(author, stranger)


@pytest.mark.asyncio
async def test_story_owner_can_delete_it_and_its_file(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner, stranger = _person("t"), _person("u")
    await _add(owner, stranger)
    key, objects = _public_image_with_copies(owner, "story")
    story = Story(id=uuid.uuid4(), user_id=owner.id, media_url=key, expires_at=datetime.now(UTC) + timedelta(hours=1))
    await _add(story)
    try:
        async with _client_as(stranger) as client:
            assert (await client.delete(f"/api/v1/stories/{story.id}")).status_code == 404
        async with _client_as(owner) as client:
            assert (await client.delete(f"/api/v1/stories/{story.id}")).status_code == 200
        assert not any(_object_exists(obj) for obj in objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner, stranger)


@pytest.mark.asyncio
async def test_member_can_delete_their_account_and_everything_it_owns(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    member, other = _person("m"), _person("n")
    await _add(member, other)
    post_key, post_objects = _public_image_with_copies(member)
    avatar_key, avatar_objects = _public_image_with_copies(member, "avatar")
    others_post = Post(id=uuid.uuid4(), user_id=other.id, content="other")
    rows = [
        Post(id=uuid.uuid4(), user_id=member.id, content="mine", image_urls=[post_key]),
        others_post,
        Comment(id=uuid.uuid4(), post_id=others_post.id, user_id=member.id, content="hi"),
        Vehicle(id=uuid.uuid4(), user_id=member.id, make="Mazda", model="MX-5"),
        Product(id=uuid.uuid4(), business_id=member.id, name="x", price=1),
        Story(id=uuid.uuid4(), user_id=member.id, media_url=post_key, expires_at=datetime.now(UTC) + timedelta(hours=1)),
        Group(id=uuid.uuid4(), name="g", creator_id=member.id),
    ]
    await _add(*rows)
    async with get_session_factory()() as db:
        stored = await db.get(User, member.id)
        stored.profile_picture_url = avatar_key
        await db.commit()
    member.profile_picture_url = avatar_key
    try:
        async with get_session_factory()() as db:
            fresh = await db.get(User, member.id)
        async with _client_as(fresh) as client:
            wrong = await client.request("DELETE", "/api/v1/users/me", json={"confirm_username": "someone-else"})
            assert wrong.status_code == 400
            assert wrong.json()["detail"] == "confirmation_mismatch"
        app.dependency_overrides.clear()

        # Resolve the member inside the request's own session, as get_user_model does.
        from fastapi import Depends

        from app.database import get_db

        async def _member(db=Depends(get_db)):
            return await db.get(User, member.id)

        app.dependency_overrides[get_user_model] = _member
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            res = await client.request("DELETE", "/api/v1/users/me", json={"confirm_username": f"@{member.username.upper()}"})
            assert res.status_code == 200, res.text
        async with get_session_factory()() as db:
            assert await db.get(User, member.id) is None
            assert (await db.execute(select(Comment).where(Comment.user_id == member.id))).first() is None
            assert (await db.execute(select(Product).where(Product.business_id == member.id))).first() is None
            assert await db.get(Post, others_post.id) is not None
        assert not any(_object_exists(obj) for obj in post_objects + avatar_objects)
    finally:
        app.dependency_overrides.clear()
        await _drop_users(member, other)


@pytest.mark.asyncio
async def test_video_uploads_are_refused_until_video_is_scanned(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner = _person("v")
    await _add(owner)
    try:
        async with _client_as(owner) as client:
            res = await client.post(
                "/api/v1/media/upload-requests",
                json={"purpose": "post", "content_type": "video/mp4", "size_bytes": 1000, "filename": "clip.mp4"},
            )
            assert res.status_code == 400
            assert res.json()["detail"] == "video_uploads_disabled"
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner)


@pytest.mark.asyncio
async def test_a_private_image_key_never_reaches_other_viewers(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    owner, stranger = _person("x"), _person("y")
    await _add(owner, stranger)
    private_key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    with_text = Post(id=uuid.uuid4(), user_id=owner.id, content="text stays", image_urls=[private_key])
    image_only = Post(id=uuid.uuid4(), user_id=owner.id, content=None, image_urls=[private_key])
    await _add(with_text, image_only)
    try:
        async with _client_as(stranger) as client:
            listed = (await client.get(f"/api/v1/posts?user_id={owner.id}")).json()
            ids = {item["id"]: item for item in listed}
            assert str(image_only.id) not in ids
            assert ids[str(with_text.id)]["image_urls"] is None
            single = (await client.get(f"/api/v1/posts/{with_text.id}")).json()
            assert single["image_urls"] is None
            explore_res = await client.get("/api/v1/explore/posts")
            assert explore_res.status_code == 200, explore_res.text
            explore = explore_res.json()
            assert all(item["id"] not in {str(with_text.id), str(image_only.id)} for item in explore)
        async with _client_as(owner) as client:
            own = (await client.get(f"/api/v1/posts/{with_text.id}")).json()
            assert own["image_urls"] == [private_key]
    finally:
        app.dependency_overrides.clear()
        await _drop_users(owner, stranger)
