import uuid

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import BusinessUpgradeRequest, Notification, User


@pytest.mark.asyncio
async def test_member_can_request_and_read_a_business_upgrade():
    member = User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        username=f"b{uuid.uuid4().hex[:8]}",
        full_name="Member",
        is_active=True,
    )
    factory = get_session_factory()
    async with factory() as db:
        db.add(member)
        await db.commit()
    app.dependency_overrides[get_user_model] = lambda: member
    transport = ASGITransport(app=app)
    try:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            empty = await client.get("/api/v1/users/me/business-upgrade")
            assert empty.status_code == 200, empty.text
            assert empty.json() is None

            submitted = await client.post(
                "/api/v1/users/me/business-upgrade",
                json={
                    "business_name": "מוסך בדיקה",
                    "business_type": "garage",
                    "business_phone": "0501234567",
                    "business_address": "רחוב הבדיקה 1",
                    "business_description": "מוסך לבדיקה אוטומטית",
                    "contact_full_name": "איש קשר",
                    "contact_phone": "0501234567",
                },
            )
            assert submitted.status_code == 200, submitted.text
            assert submitted.json()["status"] == "pending"

            latest = await client.get("/api/v1/users/me/business-upgrade")
            assert latest.status_code == 200, latest.text
            assert latest.json()["id"] == submitted.json()["id"]
    finally:
        app.dependency_overrides.clear()
        async with factory() as db:
            await db.execute(delete(Notification).where(Notification.actor_id == member.id))
            await db.execute(delete(BusinessUpgradeRequest).where(BusinessUpgradeRequest.user_id == member.id))
            await db.execute(delete(User).where(User.id == member.id))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
