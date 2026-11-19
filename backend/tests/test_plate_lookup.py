import pytest
from httpx import ASGITransport, AsyncClient

from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import User
from app.services import plate_lookup
from sqlalchemy import delete
from tests.test_user_privacy import _person

CAR_ROW = {
    "mispar_rechev": 73477002, "tozeret_cd": 885, "tozeret_nm": "קיה ד. קוריאה", "degem_cd": 507, "degem_nm": "EP2AA",
    "ramat_gimur": "EX", "shnat_yitzur": 2021, "tzeva_rechev": "שנהב לבן", "sug_delek_nm": "בנזין", "kinuy_mishari": "SELTOS",
}
BIKE_ROW = {"mispar_rechev": 5685058, "tozeret_nm": "סוזוקי יפן", "degem_nm": "gsx-r", "shnat_yitzur": 1988, "nefach_manoa": 748, "sug_delek_nm": "בנזין"}


def test_plate_is_digits_only():
    assert plate_lookup.normalize_plate("73-477-002") == "73477002"
    assert plate_lookup.normalize_plate(" 12 345 67 ") == "1234567"
    for bad in ("", "1234", "123456789", "12a4567", "../admin"):
        assert plate_lookup.normalize_plate(bad) is None


def _registry(monkeypatch, rows: dict, engine: str | None = '2.0L · בנזין · 149 כ"ס'):
    async def fake_first(client, resource_id, filters):
        return rows.get(resource_id)

    async def fake_engine(client, row):
        return engine

    monkeypatch.setattr(plate_lookup, "_first", fake_first)
    monkeypatch.setattr(plate_lookup, "_wltp_engine", fake_engine)


@pytest.mark.asyncio
async def test_registry_rows_become_form_details(monkeypatch):
    _registry(monkeypatch, {plate_lookup.PRIVATE_RESOURCE_ID: CAR_ROW})
    car = await plate_lookup.lookup_plate("73477002")
    assert (car.kind, car.make, car.model, car.year, car.trim, car.color) == ("car", "קיה", "SELTOS", 2021, "EX", "שנהב לבן")
    assert car.engine == '2.0L · בנזין · 149 כ"ס'

    _registry(monkeypatch, {plate_lookup.MOTORCYCLE_RESOURCE_ID: BIKE_ROW})
    bike = await plate_lookup.lookup_plate("5685058")
    assert (bike.kind, bike.make, bike.model, bike.engine) == ("motorcycle", "סוזוקי", "GSX-R", '748 סמ"ק · בנזין')

    _registry(monkeypatch, {})
    assert await plate_lookup.lookup_plate("1234567") is None


@pytest.mark.asyncio
async def test_plate_endpoint(monkeypatch):
    member = _person("plate")
    async with get_session_factory()() as db:
        db.add(member)
        await db.commit()
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.get("/api/v1/vehicle-catalog/plate/73477002")).status_code == 401
        app.dependency_overrides[get_user_model] = lambda: member
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            _registry(monkeypatch, {plate_lookup.PRIVATE_RESOURCE_ID: CAR_ROW})
            ok = await client.get("/api/v1/vehicle-catalog/plate/73-477-002")
            assert ok.status_code == 200 and ok.json()["model"] == "SELTOS"
            assert (await client.get("/api/v1/vehicle-catalog/plate/12ab")).json()["detail"] == "plate_invalid"
            _registry(monkeypatch, {})
            missing = await client.get("/api/v1/vehicle-catalog/plate/1234567")
            assert missing.status_code == 404 and missing.json()["detail"] == "plate_not_found"

            async def down(plate):
                raise plate_lookup.PlateLookupUnavailable

            monkeypatch.setattr(plate_lookup, "lookup_plate", down)
            busy = await client.get("/api/v1/vehicle-catalog/plate/1234567")
            assert busy.status_code == 503 and busy.json()["detail"] == "plate_lookup_unavailable"
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id == member.id))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_vehicle_added_by_plate_is_locked(monkeypatch):
    member = _person("locked")
    async with get_session_factory()() as db:
        db.add(member)
        await db.commit()
    try:
        app.dependency_overrides[get_user_model] = lambda: member
        _registry(monkeypatch, {plate_lookup.PRIVATE_RESOURCE_ID: CAR_ROW})
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Whatever the client claims, the details come from the registry.
            res = await client.post("/api/v1/garage", json={"plate": "73-477-002", "make": "פרארי", "model": "F40", "year": 1990, "color": "אדום"})
            assert res.status_code == 200, res.text
            car = res.json()
            assert (car["make"], car["model"], car["year"], car["trim"], car["color"], car["registry_verified"]) == ("קיה", "SELTOS", 2021, "EX", "שנהב לבן", True)
            assert "73477002" not in res.text
            vid = car["id"]

            for change in ({"make": "פרארי"}, {"model": "F40"}, {"year": 2024}, {"trim": "GT"}, {"engine": "V12"}, {"color": "אדום"}, {"trim": ""}):
                locked = await client.patch(f"/api/v1/garage/{vid}", json=change)
                assert locked.status_code == 400 and locked.json()["detail"] == "vehicle_details_locked", change
            # The edit form sends every field back unchanged, along with what the owner may edit.
            same = {k: car[k] for k in ("make", "model", "year", "trim", "engine", "color")}
            ok = await client.patch(f"/api/v1/garage/{vid}", json={**same, "description": "עדכון", "nickname": "הלבנה"})
            assert ok.status_code == 200 and ok.json()["description"] == "עדכון" and ok.json()["model"] == "SELTOS"

            # A motorcycle has no colour in the registry, so the owner's colour is kept.
            _registry(monkeypatch, {plate_lookup.MOTORCYCLE_RESOURCE_ID: BIKE_ROW})
            bike = await client.post("/api/v1/garage", json={"plate": "5685058", "color": "כחול"})
            assert bike.json()["color"] == "כחול" and bike.json()["registry_verified"] is True

            _registry(monkeypatch, {})
            assert (await client.post("/api/v1/garage", json={"plate": "1234567", "make": "קיה", "model": "X"})).status_code == 404

            # Manual entry works as before, stays editable, and cannot claim to be verified.
            manual = await client.post("/api/v1/garage", json={"make": "מאזדה", "model": "MX-5", "registry_verified": True})
            assert manual.status_code == 200 and manual.json()["registry_verified"] is False
            assert (await client.patch(f"/api/v1/garage/{manual.json()['id']}", json={"model": "MX-5 RF"})).status_code == 200
            assert (await client.post("/api/v1/garage", json={"make": "מאזדה"})).status_code == 422
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id == member.id))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
