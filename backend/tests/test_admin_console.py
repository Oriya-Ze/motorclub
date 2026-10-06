import uuid

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, func, select

from app.database import get_db, get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.media.keys import generate_storage_key, public_storage_key
from app.models import BusinessUpgradeRequest, Conversation, MediaScan, ModerationAction, Notification, Post, Product, User
from app.services.media_gate import _object_exists, write_local_bytes
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token


def _env(tmp_path, monkeypatch, **extra) -> None:
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    monkeypatch.setenv("MEDIA_STORAGE_PROVIDER", "local")
    monkeypatch.setenv("UPLOAD_DIR", str(tmp_path / "public"))
    monkeypatch.setenv("PRIVATE_UPLOAD_DIR", str(tmp_path / "private"))
    monkeypatch.setenv("REKOGNITION_MODE", "mock")
    for key, value in extra.items():
        monkeypatch.setenv(key, value)
    reload_settings()


def _person(prefix: str, **extra) -> User:
    return User(
        id=uuid.uuid4(),
        email=f"{prefix}-{uuid.uuid4().hex[:6]}@example.com",
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


async def _cleanup(*users: User, keys: list[str] | None = None) -> None:
    async with get_session_factory()() as db:
        ids = [u.id for u in users]
        await db.execute(delete(ModerationAction).where(ModerationAction.actor_id.in_(ids)))
        await db.execute(delete(Conversation).where(Conversation.user1_id.in_(ids) | Conversation.user2_id.in_(ids)))
        await db.execute(delete(Post).where(Post.user_id.in_(ids)))
        await db.execute(delete(Product).where(Product.business_id.in_(ids)))
        await db.execute(delete(Notification).where(Notification.user_id.in_(ids)))
        if keys:
            await db.execute(delete(MediaScan).where(MediaScan.storage_key.in_(keys)))
        await db.execute(delete(User).where(User.id.in_(ids)))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


def _as(user: User) -> AsyncClient:
    """Resolve the user inside the request's own session, as get_user_model does."""

    async def _resolve(db=Depends(get_db)):
        return await db.get(User, user.id)

    app.dependency_overrides[get_user_model] = _resolve
    return AsyncClient(transport=ASGITransport(app=app), base_url="http://test", headers={"Authorization": f"Bearer {_token(user)}"})


@pytest.mark.asyncio
async def test_video_is_accepted_queued_and_a_rejection_takes_the_post_down(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    member, admin = _person("vid"), _person("adm", is_admin=True)
    await _add(member, admin)
    key = None
    try:
        async with _as(member) as client:
            res = await client.post(
                "/api/v1/media/upload-requests",
                json={"purpose": "post", "content_type": "video/mp4", "size_bytes": 2000, "filename": "clip.mp4"},
            )
            assert res.status_code == 200, res.text
            key = res.json()["storage_key"]
            assert "/private/" not in key
        write_local_bytes(key, b"video-bytes")
        post = Post(id=uuid.uuid4(), user_id=member.id, content="סרטון", video_urls=[key])
        await _add(post)
        async with _as(admin) as client:
            queue = (await client.get("/api/v1/admin/media-scans?decision=needs_review&kind=video")).json()
            item = next(i for i in queue if i["storage_key"] == key)
            assert item["kind"] == "video"
            assert {"type": "post", "id": str(post.id)} in item["used_in"]
            assert item["owner"]["username"] == member.username
            rejected = await client.post(f"/api/v1/admin/media-scans/{item['id']}", json={"decision": "rejected", "reason": "לא מתאים"})
            assert rejected.status_code == 200, rejected.text
        assert not _object_exists(key)
        async with get_session_factory()() as db:
            stored = await db.get(Post, post.id)
            assert stored.moderation_status == "removed"
            assert stored.hidden_at is not None
    finally:
        app.dependency_overrides.clear()
        await _cleanup(member, admin, keys=[key] if key else None)


@pytest.mark.asyncio
async def test_approving_a_held_post_image_publishes_the_post(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch, REKOGNITION_MOCK_DECISION="needs_review")
    member, admin = _person("held"), _person("adm", is_admin=True)
    await _add(member, admin)
    key = generate_storage_key(user_id=member.id, purpose="post", extension=".jpg", private=True)
    write_local_bytes(key, b"held-image")
    try:
        async with _as(member) as client:
            created = await client.post("/api/v1/posts", json={"content": "ממתין", "image_urls": [key]})
            assert created.json()["moderation_status"] == "needs_review", created.text
            post_id = created.json()["id"]
        async with _as(admin) as client:
            queue = (await client.get("/api/v1/admin/media-scans?decision=needs_review&kind=image")).json()
            item = next(i for i in queue if i["storage_key"] == key)
            assert item["preview"]["kind"] == "image"
            approved = await client.post(f"/api/v1/admin/media-scans/{item['id']}", json={"decision": "approved", "reason": "תקין"})
            assert approved.status_code == 200, approved.text
        async with get_session_factory()() as db:
            post = await db.get(Post, uuid.UUID(post_id))
            assert post.moderation_status == "published"
            assert post.hidden_at is None
            assert post.image_urls == [public_storage_key(key)]
    finally:
        app.dependency_overrides.clear()
        await _cleanup(member, admin, keys=[key, public_storage_key(key)])


@pytest.mark.asyncio
async def test_admin_roles_suspension_and_deletion_rules(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    admin, member, moderator = _person("boss", is_admin=True), _person("mem"), _person("mod", is_moderator=True)
    await _add(admin, member, moderator)
    try:
        async with _as(moderator) as client:
            assert (await client.post(f"/api/v1/admin/users/{member.id}/roles", json={"is_admin": True, "reason": "x"})).status_code == 403
            assert (await client.request("DELETE", f"/api/v1/admin/users/{member.id}", json={"confirm_username": member.username, "reason": "x"})).status_code == 403
            listed = (await client.get(f"/api/v1/admin/users?q={member.username}")).json()
            assert listed[0]["email"] is None
        async with _as(admin) as client:
            listed = (await client.get(f"/api/v1/admin/users?q={member.username}")).json()
            assert listed[0]["email"] == member.email
            assert (await client.post(f"/api/v1/admin/users/{admin.id}/roles", json={"is_admin": False, "reason": "x"})).json()["detail"] == "cannot_moderate_self"
            granted = await client.post(f"/api/v1/admin/users/{member.id}/roles", json={"is_moderator": True, "reason": "עוזר"})
            assert granted.json()["is_moderator"] is True
            suspended = await client.post(f"/api/v1/admin/users/{member.id}/suspension", json={"days": 3, "reason": "בדיקה"})
            assert suspended.json()["suspended_until"]
            assert (await client.post(f"/api/v1/admin/users/{member.id}/verified", json={"verified": True, "reason": "x"})).json()["is_verified"] is True
            wrong = await client.request("DELETE", f"/api/v1/admin/users/{member.id}", json={"confirm_username": "nope", "reason": "x"})
            assert wrong.json()["detail"] == "confirmation_mismatch"
            deleted = await client.request("DELETE", f"/api/v1/admin/users/{member.id}", json={"confirm_username": member.username, "reason": "בדיקה"})
            assert deleted.status_code == 200, deleted.text
            log = (await client.get("/api/v1/admin/actions")).json()
            assert any(entry["action"] == "delete_user" for entry in log)
            overview = (await client.get("/api/v1/admin/overview")).json()
            assert "videos_to_review" in overview and "pending_business_requests" in overview
        async with get_session_factory()() as db:
            assert await db.get(User, member.id) is None
    finally:
        app.dependency_overrides.clear()
        await _cleanup(admin, member, moderator)


@pytest.mark.asyncio
async def test_a_new_message_notifies_the_recipient_once_until_read(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    sender, recipient = _person("snd"), _person("rcv")
    await _add(sender, recipient)
    try:
        async with _as(sender) as client:
            conv = (await client.post("/api/v1/messages/conversations", json={"user_id": str(recipient.id)})).json()
            for text in ("שלום", "עוד הודעה"):
                res = await client.post(f"/api/v1/messages/conversations/{conv['id']}/messages", json={"content": text})
                assert res.status_code == 200, res.text
        async with get_session_factory()() as db:
            count = await db.scalar(
                select(func.count()).select_from(Notification).where(Notification.user_id == recipient.id, Notification.type == "message")
            )
            assert count == 1
    finally:
        app.dependency_overrides.clear()
        await _cleanup(sender, recipient)


async def _held_product(seller: User, decision: str) -> tuple[Product, MediaScan, str]:
    key = generate_storage_key(user_id=seller.id, purpose="product", extension=".jpg", private=True)
    write_local_bytes(key, b"held-product-image")
    product = Product(
        id=uuid.uuid4(), business_id=seller.id, name="מחזיר שמן", price=90, category="spareParts",
        image_urls=[key], listing_status="pending_review", moderation_status=decision,
    )
    scan = MediaScan(storage_key=key, content_hash="", decision=decision, model_version="mock", policy_version="test")
    await _add(product, scan)
    return product, scan, key


async def _product_notifications(seller: User) -> list[Notification]:
    async with get_session_factory()() as db:
        rows = await db.execute(select(Notification).where(Notification.user_id == seller.id, Notification.type == "product_review"))
        return list(rows.scalars().all())


@pytest.mark.asyncio
async def test_approving_a_held_product_publishes_it_and_tells_the_seller(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    seller, admin = _person("sel"), _person("adm", is_admin=True)
    await _add(seller, admin)
    product, scan, key = await _held_product(seller, "error")
    try:
        async with _as(admin) as client:
            res = await client.post(f"/api/v1/admin/media-scans/{scan.id}", json={"decision": "approved", "reason": "תקין"})
            assert res.status_code == 200, res.text
        async with get_session_factory()() as db:
            stored = await db.get(Product, product.id)
            assert stored.listing_status == "published"
            assert stored.image_urls == [public_storage_key(key)]
        [note] = await _product_notifications(seller)
        assert note.title == "המוצר שלך פורסם בחנות"
        assert note.link == f"/marketplace?product={product.id}"
        assert note.actor_id is None
    finally:
        app.dependency_overrides.clear()
        await _cleanup(seller, admin, keys=[key, public_storage_key(key)])


@pytest.mark.asyncio
async def test_rejecting_a_held_product_keeps_it_out_and_tells_the_seller(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    seller, admin = _person("sel"), _person("adm", is_admin=True)
    await _add(seller, admin)
    product, scan, key = await _held_product(seller, "needs_review")
    try:
        async with _as(admin) as client:
            res = await client.post(f"/api/v1/admin/media-scans/{scan.id}", json={"decision": "rejected", "reason": "לא מתאים"})
            assert res.status_code == 200, res.text
        async with get_session_factory()() as db:
            stored = await db.get(Product, product.id)
            assert stored.moderation_status == "rejected"
            assert stored.listing_status == "pending_review"
        async with _as(seller) as client:
            mine = (await client.get("/api/v1/marketplace/mine")).json()
            assert [(p["id"], p["moderation_status"]) for p in mine] == [(str(product.id), "rejected")]
            shop = (await client.get("/api/v1/marketplace?limit=50")).json()
            assert str(product.id) not in {p["id"] for p in shop["items"]}
        [note] = await _product_notifications(seller)
        assert note.title == "המוצר שלך לא פורסם"
        assert note.link == "/marketplace?mine=1"
    finally:
        app.dependency_overrides.clear()
        await _cleanup(seller, admin, keys=[key])


UPGRADE = {
    "business_name": "מוסך ופחחות הדגמה",
    "business_phone": "0501234567",
    "business_address": "רחוב הבדיקה 1",
    "business_description": "מוסך ופחחות לבדיקת קטגוריות מרובות.",
    "contact_full_name": "איש קשר",
    "contact_phone": "0501234567",
}


@pytest.mark.asyncio
async def test_a_business_can_pick_several_categories_and_its_entity(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    member, admin = _person("biz"), _person("adm", is_admin=True)
    await _add(member, admin)
    try:
        async with _as(member) as client:
            bad = await client.post("/api/v1/users/me/business-upgrade", json={**UPGRADE, "business_types": ["garage", "spaceships"], "business_entity": "self_employed"})
            assert bad.status_code == 400
            wrong_entity = await client.post("/api/v1/users/me/business-upgrade", json={**UPGRADE, "business_types": ["garage"], "business_entity": "nonprofit"})
            assert wrong_entity.status_code == 400
            sent = await client.post(
                "/api/v1/users/me/business-upgrade",
                json={**UPGRADE, "business_types": ["body_shop", "garage", "body_shop"], "business_entity": "self_employed"},
            )
            assert sent.status_code == 200, sent.text
            assert sent.json()["business_types"] == ["body_shop", "garage"]
            assert sent.json()["business_type"] == "body_shop"
            assert sent.json()["business_entity"] == "self_employed"
            request_id = sent.json()["id"]
        async with _as(admin) as client:
            listed = (await client.get("/api/v1/admin/business-upgrade-requests")).json()
            row = next(r for r in listed if r["id"] == request_id)
            assert row["business_types"] == ["body_shop", "garage"] and row["business_entity"] == "self_employed"
            approved = await client.post(f"/api/v1/admin/business-upgrade-requests/{request_id}/approve", json={})
            assert approved.status_code == 200, approved.text
        async with get_session_factory()() as db:
            stored = await db.get(User, member.id)
            assert (stored.business_type, stored.business_types, stored.business_entity) == ("body_shop", ["body_shop", "garage"], "self_employed")
        async with _as(member) as client:
            # Found under its second category, and listed among workshops.
            garages = (await client.get("/api/v1/services?business_type=garage")).json()
            assert str(member.id) in {b["id"] for b in garages}
            workshops = (await client.get("/api/v1/workshops")).json()
            assert str(member.id) in {b["id"] for b in workshops}
            profile = (await client.get(f"/api/v1/services/{member.id}")).json()
            assert profile["business_types"] == ["body_shop", "garage"] and profile["business_entity"] == "self_employed"
            # Settings can change the list; the primary category follows the first one.
            updated = await client.patch("/api/v1/users/me", json={"business_types": ["detailing", "tires"], "business_entity": "company"})
            assert updated.status_code == 200, updated.text
            assert (updated.json()["business_type"], updated.json()["business_types"], updated.json()["business_entity"]) == ("detailing", ["detailing", "tires"], "company")
            # An older client that only sends one category keeps the others.
            single = await client.patch("/api/v1/users/me", json={"business_type": "tires"})
            assert single.json()["business_types"] == ["tires", "detailing"]
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(BusinessUpgradeRequest).where(BusinessUpgradeRequest.user_id == member.id))
            await db.commit()
        await _cleanup(member, admin)


@pytest.mark.asyncio
async def test_an_older_client_sending_one_category_still_works(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    member = _person("old")
    await _add(member)
    try:
        async with _as(member) as client:
            sent = await client.post("/api/v1/users/me/business-upgrade", json={**UPGRADE, "business_type": "towing"})
            assert sent.status_code == 200, sent.text
            assert sent.json()["business_types"] == ["towing"] and sent.json()["business_entity"] is None
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(BusinessUpgradeRequest).where(BusinessUpgradeRequest.user_id == member.id))
            await db.commit()
        await _cleanup(member)


@pytest.mark.asyncio
async def test_address_is_optional_only_for_the_self_employed_and_contact_phone_is_optional(tmp_path, monkeypatch):
    _env(tmp_path, monkeypatch)
    company, freelancer = _person("co"), _person("fr")
    await _add(company, freelancer)
    lean = {k: v for k, v in UPGRADE.items() if k not in {"business_address", "contact_phone"}}
    try:
        async with _as(company) as client:
            missing = await client.post("/api/v1/users/me/business-upgrade", json={**lean, "business_types": ["glass"], "business_entity": "company"})
            assert missing.status_code == 400 and missing.json()["detail"] == "Business address is required"
            ok = await client.post("/api/v1/users/me/business-upgrade", json={**lean, "business_address": "רחוב 1", "business_types": ["glass", "car_wash"], "business_entity": "company"})
            assert ok.status_code == 200, ok.text
            assert ok.json()["contact_phone"] is None
        async with _as(freelancer) as client:
            sent = await client.post("/api/v1/users/me/business-upgrade", json={**lean, "business_types": ["wraps", "appraisal"], "business_entity": "self_employed"})
            assert sent.status_code == 200, sent.text
            assert sent.json()["business_address"] is None and sent.json()["business_types"] == ["wraps", "appraisal"]
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(BusinessUpgradeRequest).where(BusinessUpgradeRequest.user_id.in_([company.id, freelancer.id])))
            await db.commit()
        await _cleanup(company, freelancer)
