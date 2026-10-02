import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_session_factory
from app.deps import get_user_model
from app.main import app
from app.media.keys import generate_storage_key
from app.models import ModerationAppeal, Post, User
from app.services.media_gate import read_media_bytes, write_local_bytes
from tests.conftest import reload_settings


def _token(user: User) -> str:
    from jose import jwt

    from app.config import settings

    return jwt.encode({"sub": str(user.id), "email": user.email}, settings.jwt_secret, algorithm=settings.jwt_algorithm)


async def _insert(user: User) -> None:
    factory = get_session_factory()
    async with factory() as db:
        db.add(user)
        await db.commit()


async def _cleanup(user_id: uuid.UUID) -> None:
    from app.database import get_engine

    factory = get_session_factory()
    async with factory() as db:
        await db.execute(delete(ModerationAppeal).where(ModerationAppeal.user_id == user_id))
        await db.execute(delete(Post).where(Post.user_id == user_id))
        await db.execute(delete(User).where(User.id == user_id))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_one_rejected_image_blocks_the_whole_post(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    reload_settings()
    owner = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"u{uuid.uuid4().hex[:8]}", full_name="Owner", is_active=True)
    stranger = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"s{uuid.uuid4().hex[:8]}", full_name="Stranger", is_active=True)
    await _insert(owner)
    await _insert(stranger)
    keys = []
    for _ in range(3):
        key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
        write_local_bytes(key, b"image-bytes")
        keys.append(key)
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "approved,approved,rejected:explicit_nudity"},
                json={"content": "שלום", "image_urls": keys},
            )
            assert created.status_code == 200, created.text
            body = created.json()
            assert body["moderation_status"] == "rejected"
            assert body["content"] == "שלום"
            assert any(item["reason_code"] == "explicit_nudity" for item in body["moderation_blocks"])
            assert "/private/" in body["image_urls"][2]
            for key in keys:
                assert "/private/" in key
                read_media_bytes(key)
            listed = await client.get("/api/v1/posts", headers={"Authorization": f"Bearer {_token(stranger)}"})
            assert listed.status_code == 200
            assert all(item["id"] != body["id"] for item in listed.json())
            hidden = await client.get(f"/api/v1/posts/{body['id']}", headers={"Authorization": f"Bearer {_token(stranger)}"})
            assert hidden.status_code == 404
            assert hidden.json()["detail"] == "content_unavailable"
            own = await client.get(f"/api/v1/posts/{body['id']}", headers={"Authorization": f"Bearer {_token(owner)}"})
            assert own.status_code == 200
            assert own.json()["moderation_blocks"][0]["reason_code"] == "explicit_nudity"
            appeal = await client.post(f"/api/v1/posts/{body['id']}/appeal", headers={"Authorization": f"Bearer {_token(owner)}"}, json={"note": "זו טעות"})
            assert appeal.status_code == 200
            again = await client.post(f"/api/v1/posts/{body['id']}/appeal", headers={"Authorization": f"Bearer {_token(owner)}"}, json={"note": "שוב"})
            assert again.json()["duplicate"] is True
            replaced = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
            write_local_bytes(replaced, b"replacement")
            fixed = keys[:2] + [replaced]
            published = await client.put(
                f"/api/v1/posts/{body['id']}/publication",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "approved,approved,approved"},
                json={"content": "שלום", "image_urls": fixed},
            )
            assert published.status_code == 200, published.text
            assert published.json()["moderation_status"] == "published"
            assert "/private/" not in published.json()["image_urls"][0]
            visible = await client.get(f"/api/v1/posts/{body['id']}", headers={"Authorization": f"Bearer {_token(stranger)}"})
            assert visible.status_code == 200
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)
        await _cleanup(stranger.id)


@pytest.mark.asyncio
async def test_scan_error_is_not_a_policy_violation(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    reload_settings()
    owner = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"e{uuid.uuid4().hex[:8]}", full_name="Owner", is_active=True)
    await _insert(owner)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"image-bytes")
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "error"},
                json={"content": "טיוטה", "image_urls": [key]},
            )
            assert created.status_code == 200, created.text
            body = created.json()
            assert body["moderation_status"] == "error"
            assert body["moderation_blocks"][0]["reason_code"] is None
            assert "/private/" in body["image_urls"][0]
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)


@pytest.mark.asyncio
async def test_old_scan_and_direct_edit_cannot_bypass_a_block(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    monkeypatch.setenv("REKOGNITION_MOCK_DECISION", "rejected")
    reload_settings()
    owner = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"o{uuid.uuid4().hex[:8]}", full_name="Owner", is_active=True)
    await _insert(owner)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    payload = b"image-bytes-v1"
    write_local_bytes(key, payload)
    from app.models import MediaScan
    from app.services.image_moderation import content_hash

    factory = get_session_factory()
    async with factory() as db:
        db.add(MediaScan(storage_key=key, content_hash=content_hash(payload), decision="approved", labels=[], model_version="old", policy_version="old"))
        await db.commit()
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}"},
                json={"content": "חסום", "image_urls": [key], "moderation_status": "published"},
            )
            assert created.status_code == 200, created.text
            body = created.json()
            assert body["moderation_status"] == "rejected"
            assert "/private/" in body["image_urls"][0]
            replaced = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
            write_local_bytes(replaced, b"image-bytes-v2")
            async with factory() as db:
                db.add(MediaScan(storage_key=key, content_hash=content_hash(payload), decision="approved", labels=[], model_version="late", policy_version="old"))
                await db.commit()
            again = await client.put(
                f"/api/v1/posts/{body['id']}/publication",
                headers={"Authorization": f"Bearer {_token(owner)}"},
                json={"content": "חסום", "image_urls": [replaced]},
            )
            assert again.status_code == 200, again.text
            assert again.json()["moderation_status"] == "rejected"
            assert again.json()["image_urls"] == [replaced]
            assert key not in again.json()["image_urls"]
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)


@pytest.mark.asyncio
async def test_stale_appeal_does_not_publish_the_new_version(tmp_path, monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    reload_settings()
    owner = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"a{uuid.uuid4().hex[:8]}", full_name="Owner", is_active=True)
    staff = User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"m{uuid.uuid4().hex[:8]}", full_name="Staff", is_active=True, is_admin=True)
    await _insert(owner)
    await _insert(staff)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"blocked")
    replacement = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(replacement, b"still-blocked")
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "rejected:explicit_nudity"},
                json={"content": "ערעור", "image_urls": [key]},
            )
            assert created.status_code == 200, created.text
            post_id = created.json()["id"]
            appeal = await client.post(f"/api/v1/posts/{post_id}/appeal", headers={"Authorization": f"Bearer {_token(owner)}"}, json={"note": "טעות"})
            assert appeal.json()["duplicate"] is False
            edited = await client.put(
                f"/api/v1/posts/{post_id}/publication",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "rejected:violence"},
                json={"content": "ערעור", "image_urls": [replacement]},
            )
            assert edited.json()["moderation_status"] == "rejected"
            app.dependency_overrides[get_user_model] = lambda: staff
            reviewed = await client.post(
                f"/api/v1/admin/appeals/{appeal.json()['id']}",
                headers={"Authorization": f"Bearer {_token(staff)}"},
                json={"decision": "approved", "reason": "הגרסה הישנה נבדקה"},
            )
            assert reviewed.status_code == 200, reviewed.text
            assert reviewed.json()["status"] == "stale"
            assert reviewed.json()["moderation_status"] == "rejected"
            own = await client.get(f"/api/v1/posts/{post_id}", headers={"Authorization": f"Bearer {_token(owner)}"})
            assert own.json()["moderation_status"] == "rejected"
            assert "/private/" in own.json()["image_urls"][0]
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)
        await _cleanup(staff.id)


def test_mock_header_is_ignored_outside_local():
    from app.services.post_moderation import mock_decisions_from_header

    class Headers(dict):
        def get(self, key, default=""):
            return "rejected:explicit_nudity" if key == "x-motorclub-mock-decisions" else default

    assert mock_decisions_from_header(Headers(), is_local=False, mode="mock") is None


def _local_mock_env(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    reload_settings()


def _person(prefix: str, **extra) -> User:
    return User(id=uuid.uuid4(), email=f"{uuid.uuid4()}@example.com", username=f"{prefix}{uuid.uuid4().hex[:8]}", full_name=prefix, is_active=True, **extra)


@pytest.mark.asyncio
async def test_unpublished_post_is_hidden_from_every_listing_but_the_owners(tmp_path, monkeypatch):
    from app.models import Vehicle

    _local_mock_env(tmp_path, monkeypatch)
    owner = _person("l")
    stranger = _person("x")
    await _insert(owner)
    await _insert(stranger)
    vehicle = Vehicle(id=uuid.uuid4(), user_id=owner.id, make="Mazda", model="MX-5")
    await _insert(vehicle)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"blocked")
    tag = f"blocked{uuid.uuid4().hex[:8]}"
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "rejected:violence"},
                json={"content": f"#{tag}", "image_urls": [key], "vehicle_id": str(vehicle.id)},
            )
            assert created.status_code == 200, created.text
            post_id = created.json()["id"]
            assert created.json()["moderation_status"] == "rejected"

            as_stranger = {"Authorization": f"Bearer {_token(stranger)}"}
            explore = await client.get("/api/v1/explore/posts", headers=as_stranger)
            assert all(item["id"] != post_id for item in explore.json())
            tags = await client.get("/api/v1/explore/hashtags", headers=as_stranger)
            assert all(item["tag"] != tag for item in tags.json())
            by_tag = await client.get(f"/api/v1/posts?hashtag={tag}", headers=as_stranger)
            assert by_tag.json() == []
            by_user = await client.get(f"/api/v1/users/{owner.id}/posts", headers=as_stranger)
            assert all(item["id"] != post_id for item in by_user.json())
            by_vehicle = await client.get(f"/api/v1/garage/{vehicle.id}/posts", headers=as_stranger)
            assert all(item["id"] != post_id for item in by_vehicle.json())

            as_owner = {"Authorization": f"Bearer {_token(owner)}"}
            own_profile = await client.get(f"/api/v1/posts?user_id={owner.id}", headers=as_owner)
            mine = [item for item in own_profile.json() if item["id"] == post_id]
            assert mine and mine[0]["moderation_blocks"][0]["reason_code"] == "violence"
            own_user_posts = await client.get(f"/api/v1/users/{owner.id}/posts", headers=as_owner)
            assert any(item["id"] == post_id for item in own_user_posts.json())
            own_vehicle = await client.get(f"/api/v1/garage/{vehicle.id}/posts", headers=as_owner)
            assert any(item["id"] == post_id for item in own_vehicle.json())
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)
        await _cleanup(stranger.id)


@pytest.mark.asyncio
async def test_moderator_removal_cannot_be_republished_or_appealed(tmp_path, monkeypatch):
    _local_mock_env(tmp_path, monkeypatch)
    owner = _person("r")
    staff = _person("s", is_admin=True)
    await _insert(owner)
    await _insert(staff)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"fine")
    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={"Authorization": f"Bearer {_token(owner)}", "X-Motorclub-Mock-Decisions": "approved"},
                json={"content": "פורסם", "image_urls": [key]},
            )
            assert created.json()["moderation_status"] == "published"
            post_id = created.json()["id"]
            public_key = created.json()["image_urls"][0]

            app.dependency_overrides[get_user_model] = lambda: staff
            removed = await client.post(
                f"/api/v1/admin/posts/{post_id}/visibility",
                headers={"Authorization": f"Bearer {_token(staff)}"},
                json={"hidden": True, "reason": "הפרת כללים"},
            )
            assert removed.status_code == 200, removed.text

            app.dependency_overrides[get_user_model] = lambda: owner
            as_owner = {"Authorization": f"Bearer {_token(owner)}"}
            own = await client.get(f"/api/v1/posts/{post_id}", headers=as_owner)
            assert own.json()["moderation_status"] == "removed"
            again = await client.put(
                f"/api/v1/posts/{post_id}/publication",
                headers={**as_owner, "X-Motorclub-Mock-Decisions": "approved"},
                json={"content": "פורסם", "image_urls": [public_key]},
            )
            assert again.status_code == 403
            assert again.json()["detail"] == "removed_by_moderator"
            appeal = await client.post(f"/api/v1/posts/{post_id}/appeal", headers=as_owner, json={"note": "בבקשה"})
            assert appeal.status_code == 403
            still = await client.get(f"/api/v1/posts/{post_id}", headers=as_owner)
            assert still.json()["moderation_status"] == "removed"
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)
        await _cleanup(staff.id)


@pytest.mark.asyncio
async def test_vehicle_followers_hear_about_a_post_only_once(tmp_path, monkeypatch):
    from sqlalchemy import func, select

    from app.models import Notification, Vehicle, VehicleFollower

    _local_mock_env(tmp_path, monkeypatch)
    owner = _person("v")
    follower = _person("f")
    await _insert(owner)
    await _insert(follower)
    vehicle = Vehicle(id=uuid.uuid4(), user_id=owner.id, make="Subaru", model="BRZ")
    await _insert(vehicle)
    await _insert(VehicleFollower(vehicle_id=vehicle.id, user_id=follower.id))
    first = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(first, b"blocked")
    second = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(second, b"fine")

    async def notified() -> int:
        async with get_session_factory()() as db:
            return await db.scalar(
                select(func.count()).select_from(Notification).where(
                    Notification.user_id == follower.id, Notification.type == "vehicle_post"
                )
            )

    app.dependency_overrides[get_user_model] = lambda: owner
    transport = ASGITransport(app=app)
    headers = {"Authorization": f"Bearer {_token(owner)}"}
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            created = await client.post(
                "/api/v1/posts",
                headers={**headers, "X-Motorclub-Mock-Decisions": "rejected:violence"},
                json={"content": "רכב", "image_urls": [first], "vehicle_id": str(vehicle.id)},
            )
            post_id = created.json()["id"]
            assert await notified() == 0
            published = await client.put(
                f"/api/v1/posts/{post_id}/publication",
                headers={**headers, "X-Motorclub-Mock-Decisions": "approved"},
                json={"content": "רכב", "image_urls": [second], "vehicle_id": str(vehicle.id)},
            )
            assert published.json()["moderation_status"] == "published"
            assert await notified() == 1
            edited = await client.put(
                f"/api/v1/posts/{post_id}/publication",
                headers={**headers, "X-Motorclub-Mock-Decisions": "approved"},
                json={"content": "רכב, עריכה", "image_urls": published.json()["image_urls"], "vehicle_id": str(vehicle.id)},
            )
            assert edited.json()["moderation_status"] == "published"
            assert await notified() == 1
    finally:
        app.dependency_overrides.clear()
        await _cleanup(owner.id)
        await _cleanup(follower.id)


@pytest.mark.asyncio
async def test_scan_retry_keeps_a_post_image_private(tmp_path, monkeypatch):
    from sqlalchemy import select

    from app.models import MediaScan
    from app.services.image_moderation import content_hash

    _local_mock_env(tmp_path, monkeypatch)
    owner = _person("t")
    staff = _person("q", is_admin=True)
    await _insert(owner)
    await _insert(staff)
    key = generate_storage_key(user_id=owner.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"retry-me")
    async with get_session_factory()() as db:
        scan = MediaScan(storage_key=key, content_hash=content_hash(b"retry-me"), decision="error", labels=[], policy_version="test")
        db.add(scan)
        await db.commit()
        scan_id = scan.id
    app.dependency_overrides[get_user_model] = lambda: staff
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            retried = await client.post("/api/v1/admin/media-scans-retry", headers={"Authorization": f"Bearer {_token(staff)}"})
            assert retried.status_code == 200, retried.text
        async with get_session_factory()() as db:
            assert (await db.scalar(select(MediaScan).where(MediaScan.id == scan_id))).decision == "approved"
        assert read_media_bytes(key) == b"retry-me"
        public_dir = tmp_path / "public"
        assert not public_dir.exists() or not any(path.is_file() for path in public_dir.rglob("*"))
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(MediaScan).where(MediaScan.id == scan_id))
            await db.commit()
        await _cleanup(owner.id)
        await _cleanup(staff.id)
