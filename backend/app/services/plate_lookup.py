"""Vehicle details by Israeli licence plate, from the Ministry of Transport registry on data.gov.il.

The registry is public. MotorClub does not store or log the plate: it only fills in the add-vehicle form.
"""

from __future__ import annotations

import asyncio
import json
import re
from dataclasses import dataclass

import httpx

from app.services.vehicle_brands import canonical_make
from app.services.vehicle_catalog import DATASTORE_URL, WLTP_RESOURCE_ID, _display_model_name, _format_engine

# Private and commercial cars, motorcycles, and heavy or public vehicles. Vehicles taken off the road are left out.
PRIVATE_RESOURCE_ID = "053cea08-09bc-40ec-8f7a-156f0677aff3"
MOTORCYCLE_RESOURCE_ID = "bf9df4e2-d90d-4c0a-a400-19e15af8e95f"
HEAVY_RESOURCE_ID = "cd3acc5c-03c3-4c89-9c54-d40f93c0d790"

TIMEOUT_SECONDS = 10.0
_PLATE = re.compile(r"^\d{5,8}$")


class PlateLookupUnavailable(Exception):
    """data.gov.il did not answer; the member can still fill the form by hand."""


@dataclass(frozen=True)
class PlateVehicle:
    kind: str  # car, motorcycle or heavy
    make: str
    model: str
    year: int | None
    trim: str | None
    color: str | None
    engine: str | None
    fuel: str | None


def normalize_plate(raw: str) -> str | None:
    """Digits only ("12-345-67" and "12 345 67" are the same plate); None if it cannot be a plate."""
    digits = re.sub(r"[\s\-.]", "", raw or "")
    return digits if _PLATE.match(digits) else None


async def _first(client: httpx.AsyncClient, resource_id: str, filters: dict) -> dict | None:
    response = await client.get(
        DATASTORE_URL,
        params={"resource_id": resource_id, "filters": json.dumps(filters), "limit": 5},
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("success"):
        raise PlateLookupUnavailable
    records = payload["result"]["records"]
    return records[0] if records else None


async def _wltp_engine(client: httpx.AsyncClient, row: dict) -> str | None:
    """Engine size and horsepower come from the WLTP catalog, matched on maker, model code, year and trim."""
    filters = {key: row.get(key) for key in ("tozeret_cd", "degem_cd", "shnat_yitzur")}
    if any(value is None for value in filters.values()):
        return None
    response = await client.get(
        DATASTORE_URL,
        params={"resource_id": WLTP_RESOURCE_ID, "filters": json.dumps(filters), "limit": 20},
    )
    response.raise_for_status()
    records = response.json().get("result", {}).get("records", [])
    if not records:
        return None
    trim = (row.get("ramat_gimur") or "").strip()
    match = next((r for r in records if (r.get("ramat_gimur") or "").strip() == trim), records[0])
    return _format_engine(match) or None


def _text(value) -> str | None:
    text = " ".join(str(value or "").split())
    return text or None


def _year(value) -> int | None:
    try:
        year = int(value)
    except (TypeError, ValueError):
        return None
    return year if 1900 <= year <= 2100 else None


def _cc(value) -> str | None:
    try:
        cc = int(value)
    except (TypeError, ValueError):
        return None
    if cc <= 0:
        return None
    return f"{cc / 1000:.1f}L" if cc >= 1000 else f'{cc} סמ"ק'


async def lookup_plate(plate: str) -> PlateVehicle | None:
    number = int(plate)
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT_SECONDS) as client:
            car, bike, heavy = await asyncio.gather(
                _first(client, PRIVATE_RESOURCE_ID, {"mispar_rechev": number}),
                _first(client, MOTORCYCLE_RESOURCE_ID, {"mispar_rechev": number}),
                _first(client, HEAVY_RESOURCE_ID, {"mispar_rechev": number}),
            )
            if car:
                try:
                    engine = await _wltp_engine(client, car)
                except httpx.HTTPError:
                    engine = None  # the registry answer is still worth showing without engine details
                fuel = _text(car.get("sug_delek_nm"))
                return PlateVehicle(
                    kind="car",
                    make=canonical_make(car.get("tozeret_nm")),
                    model=_display_model_name(car.get("kinuy_mishari") or car.get("degem_nm") or ""),
                    year=_year(car.get("shnat_yitzur")),
                    trim=_text(car.get("ramat_gimur")),
                    color=_text(car.get("tzeva_rechev")),
                    engine=engine or fuel,
                    fuel=fuel,
                )
            for kind, row in (("motorcycle", bike), ("heavy", heavy)):
                if row:
                    fuel = _text(row.get("sug_delek_nm"))
                    engine = " · ".join(part for part in (_cc(row.get("nefach_manoa")), fuel) if part)
                    return PlateVehicle(
                        kind=kind,
                        make=canonical_make(row.get("tozeret_nm")),
                        model=_display_model_name(row.get("degem_nm") or ""),
                        year=_year(row.get("shnat_yitzur")),
                        trim=None,
                        color=None,
                        engine=engine or None,
                        fuel=fuel,
                    )
    except httpx.HTTPError as exc:
        raise PlateLookupUnavailable from exc
    return None
