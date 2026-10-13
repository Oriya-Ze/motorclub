from contextlib import asynccontextmanager

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete

from app.database import get_engine, get_session_factory
from app.deps import get_optional_user_model, get_user_model
from app.main import app
from app.models import ProfileSettings, User, Vehicle
from tests.conftest import reload_settings
from tests.test_post_publication_moderation import _token
from tests.test_user_privacy import _person


@asynccontextmanager
async def _client_as(user: User):
    app.dependency_overrides[get_user_model] = lambda: user
    app.dependency_overrides[get_optional_user_model] = lambda: user
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"Authorization": f"Bearer {_token(user)}"},
    ) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_vehicle_is_sold_from_its_card(monkeypatch):
    monkeypatch.setenv("ENVIRONMENT", "local")
    monkeypatch.setenv("AUTH_PROVIDER", "local")
    reload_settings()
    seller, buyer = _person("seller"), _person("buyer")
    vehicle = Vehicle(user_id=seller.id, make="bmw", model="M3", year=2019, image_urls=["users/x/vehicles/a.jpg"])
    async with get_session_factory()() as db:
        db.add_all([seller, buyer])
        await db.flush()
        # A private profile: its card opens to strangers only while the car is for sale.
        db.add_all([vehicle, ProfileSettings(user_id=seller.id, profile_public=False)])
        await db.commit()
    try:
        async with _client_as(buyer) as client:
            assert (await client.get(f"/api/v1/garage/{vehicle.id}")).status_code == 404
            res = await client.post("/api/v1/marketplace/vehicle-listings", json={"vehicle_id": str(vehicle.id), "price": 1000})
            assert res.status_code == 404, "only the owner lists a vehicle"
            res = await client.post(
                "/api/v1/marketplace", json={"name": "BMW M3", "price": 1000, "category": "vehicles", "image_urls": ["k"]}
            )
            assert res.status_code == 400, "a vehicle is not a general product"

        async with _client_as(seller) as client:
            res = await client.post(
                "/api/v1/marketplace/vehicle-listings",
                json={"vehicle_id": str(vehicle.id), "price": 185000, "description": "שמור"},
            )
            assert res.status_code == 200, res.text
            listing = res.json()
            assert listing["vehicle_id"] == str(vehicle.id)
            assert listing["category"] == "vehicles"
            assert listing["listing_status"] == "published"
            assert listing["image_urls"] == ["users/x/vehicles/a.jpg"]
            assert "M3" in listing["name"] and "2019" in listing["name"]
            again = await client.post("/api/v1/marketplace/vehicle-listings", json={"vehicle_id": str(vehicle.id), "price": 1})
            assert again.status_code == 409
            assert (await client.patch(f"/api/v1/marketplace/{listing['id']}", json={"name": "other"})).status_code == 400
            res = await client.patch(f"/api/v1/marketplace/{listing['id']}", json={"price": 179000})
            assert res.status_code == 200 and res.json()["price"] == 179000
            card = (await client.get(f"/api/v1/garage/{vehicle.id}")).json()
            assert card["sale_listing"]["price"] == 179000

        async with _client_as(buyer) as client:
            shop = (await client.get("/api/v1/marketplace?category=vehicles")).json()
            assert listing["id"] in [item["id"] for item in shop["items"]]
            card = await client.get(f"/api/v1/garage/{vehicle.id}")
            assert card.status_code == 200, "the shop links to the card"
            assert card.json()["sale_listing"]["price"] == 179000
            assert (await client.get(f"/api/v1/garage/{vehicle.id}/posts")).status_code == 404, "posts stay private"

        async with _client_as(seller) as client:
            assert (await client.delete(f"/api/v1/marketplace/{listing['id']}")).status_code == 200
        async with _client_as(buyer) as client:
            assert (await client.get(f"/api/v1/garage/{vehicle.id}")).status_code == 404
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id.in_([seller.id, buyer.id])))
            await db.commit()
        await get_engine().dispose()
        get_engine.cache_clear()
        get_session_factory.cache_clear()
