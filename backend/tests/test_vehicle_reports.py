import pytest
from sqlalchemy import delete, select

from app.database import get_engine, get_session_factory
from app.models import ContentReport, ModerationAction, Notification, User, Vehicle
from tests.conftest import reload_settings
from tests.test_user_privacy import _person
from tests.test_vehicle_listings import _client_as


@pytest.mark.asyncio
async def test_vehicle_report_reaches_staff_who_can_delete_the_card(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    owner, reporter, staff = _person("owner"), _person("reporter"), _person("staff")
    staff.is_moderator = True
    vehicle = Vehicle(user_id=owner.id, make="Mazda", model="MX-5", year=1995, nickname="מיאטה")
    async with get_session_factory()() as db:
        db.add_all([owner, reporter, staff])
        await db.flush()
        db.add(vehicle)
        await db.commit()
    try:
        async with _client_as(reporter) as client:
            bad = await client.post("/api/v1/reports", json={"target_type": "vehicle", "target_id": str(vehicle.id), "reason": "spam"})
            assert bad.status_code == 400, "a vehicle takes only its own reasons"
            duplicates = []
            for reason in ("wrong_info", "irrelevant"):
                res = await client.post(
                    "/api/v1/reports",
                    json={"target_type": "vehicle", "target_id": str(vehicle.id), "reason": reason, "details": "השנה לא נכונה"},
                )
                assert res.status_code == 200, res.text
                duplicates.append(res.json()["duplicate"])
            assert duplicates == [False, True], "one open report per member per item"
            wrong_elsewhere = await client.post("/api/v1/reports", json={"target_type": "profile", "target_id": str(owner.id), "reason": "wrong_info"})
            assert wrong_elsewhere.status_code == 400

        async with _client_as(reporter) as client:
            assert (await client.request("DELETE", f"/api/v1/admin/vehicles/{vehicle.id}", json={"reason": "x"})).status_code == 403

        async with _client_as(staff) as client:
            listed = (await client.get("/api/v1/admin/reports?status=new")).json()["items"]
            group = next(item for item in listed if item["target_id"] == str(vehicle.id))
            assert group["target_type"] == "vehicle"
            assert group["reasons"] == ["wrong_info"] and group["reports"][0]["details"] == "השנה לא נכונה"
            assert group["target"]["link"] == f"/vehicles/{vehicle.id}"
            assert "MX-5" in group["target"]["text"] and group["target"]["author"] == owner.username
            assert (await client.request("DELETE", f"/api/v1/admin/vehicles/{vehicle.id}", json={})).status_code == 400
            res = await client.request("DELETE", f"/api/v1/admin/vehicles/{vehicle.id}", json={"reason": "פרטים שגויים"})
            assert res.status_code == 200, res.text

        async with get_session_factory()() as db:
            assert await db.get(Vehicle, vehicle.id) is None
            action = await db.scalar(select(ModerationAction).where(ModerationAction.target_id == str(vehicle.id)))
            assert action.action == "delete_vehicle" and action.actor_id == staff.id and "פרטים שגויים" in action.reason
            note = await db.scalar(select(Notification).where(Notification.user_id == owner.id, Notification.type == "vehicle_removed"))
            assert note is not None and note.actor_id is None, "the owner is told, without the reviewer's name"
    finally:
        async with get_session_factory()() as db:
            await db.execute(delete(ContentReport).where(ContentReport.target_id == vehicle.id))
            await db.execute(delete(ModerationAction).where(ModerationAction.target_id == str(vehicle.id)))
            await db.execute(delete(User).where(User.id.in_([owner.id, reporter.id, staff.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
