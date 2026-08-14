"""Israeli vehicle catalog via Ministry of Transport WLTP dataset on data.gov.il."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

import httpx

logger = logging.getLogger(__name__)

WLTP_RESOURCE_ID = "142afde2-6228-49f9-8a29-9b6c3a0cbe40"
DATASTORE_URL = "https://data.gov.il/api/3/action/datastore_search"
PAGE_SIZE = 32_000
CACHE_TTL_SECONDS = 86_400  # 24h

_cache: dict[str, tuple[float, object]] = {}
_cache_lock = asyncio.Lock()


@dataclass(frozen=True)
class CatalogMake:
    id: int
    name: str


@dataclass(frozen=True)
class CatalogModel:
    id: int
    name: str
    code: str


@dataclass(frozen=True)
class CatalogVariant:
    id: str
    trim: str
    engine: str
    fuel: str | None
    engine_cc: int | None
    horsepower: int | None
    year_from: int | None
    year_to: int | None


def _cache_get(key: str):
    entry = _cache.get(key)
    if not entry:
        return None
    expires_at, value = entry
    if time.monotonic() > expires_at:
        return None
    return value


def _cache_set(key: str, value: object) -> None:
    _cache[key] = (time.monotonic() + CACHE_TTL_SECONDS, value)


async def _search(
    *,
    filters: dict | None = None,
    fields: list[str] | None = None,
    limit: int = PAGE_SIZE,
    offset: int = 0,
) -> list[dict]:
    params: dict = {
        "resource_id": WLTP_RESOURCE_ID,
        "limit": limit,
        "offset": offset,
    }
    if filters:
        import json

        params["filters"] = json.dumps(filters)
    if fields:
        params["fields"] = ",".join(fields)

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(DATASTORE_URL, params=params)
        response.raise_for_status()
        payload = response.json()

    if not payload.get("success"):
        raise RuntimeError("data.gov.il catalog query failed")

    return payload["result"]["records"]


async def _search_all(*, filters: dict | None = None, fields: list[str] | None = None) -> list[dict]:
    records: list[dict] = []
    offset = 0
    while True:
        batch = await _search(filters=filters, fields=fields, offset=offset)
        records.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return records


def _format_engine(record: dict) -> str:
    parts: list[str] = []
    cc = record.get("nefah_manoa")
    if cc:
        liters = cc / 1000
        parts.append(f"{liters:.1f}L" if liters >= 1 else f"{cc} סמ\"ק")
    fuel = record.get("delek_nm")
    if fuel:
        parts.append(str(fuel))
    hp = record.get("koah_sus")
    if hp:
        parts.append(f"{hp} כ\"ס")
    tech = record.get("technologiat_hanaa_nm")
    if tech and tech not in ("הנעה רגילה", "לא ידוע"):
        parts.append(str(tech))
    return " · ".join(parts) if parts else ""


def _variant_key(record: dict) -> tuple:
    return (
        record.get("ramat_gimur") or "",
        record.get("nefah_manoa"),
        record.get("delek_nm") or "",
        record.get("koah_sus"),
        record.get("technologiat_hanaa_nm") or "",
    )


async def list_makes() -> list[CatalogMake]:
    cached = _cache_get("makes")
    if cached is not None:
        return cached  # type: ignore[return-value]

    async with _cache_lock:
        cached = _cache_get("makes")
        if cached is not None:
            return cached  # type: ignore[return-value]

        records = await _search_all(fields=["tozeret_cd", "tozeret_nm"])
        by_id: dict[int, str] = {}
        for row in records:
            make_id = row.get("tozeret_cd")
            name = (row.get("tozeret_nm") or "").strip()
            if make_id is None or not name:
                continue
            by_id[int(make_id)] = name

        makes = [CatalogMake(id=make_id, name=name) for make_id, name in sorted(by_id.items(), key=lambda x: x[1])]
        _cache_set("makes", makes)
        logger.info("vehicle catalog: cached %s makes", len(makes))
        return makes


async def list_models(make_id: int) -> list[CatalogModel]:
    cache_key = f"models:{make_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    records = await _search_all(
        filters={"tozeret_cd": make_id},
        fields=["degem_cd", "degem_nm", "kinuy_mishari"],
    )
    by_id: dict[int, CatalogModel] = {}
    for row in records:
        model_id = row.get("degem_cd")
        if model_id is None:
            continue
        model_id = int(model_id)
        commercial = (row.get("kinuy_mishari") or "").strip()
        code = (row.get("degem_nm") or "").strip()
        name = commercial or code
        if not name:
            continue
        existing = by_id.get(model_id)
        if existing is None or (commercial and existing.name == existing.code):
            by_id[model_id] = CatalogModel(id=model_id, name=name, code=code or name)

    models = sorted(by_id.values(), key=lambda m: m.name)
    _cache_set(cache_key, models)
    return models


async def list_variants(make_id: int, model_id: int) -> list[CatalogVariant]:
    cache_key = f"variants:{make_id}:{model_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    records = await _search_all(
        filters={"tozeret_cd": make_id, "degem_cd": model_id},
        fields=[
            "ramat_gimur",
            "nefah_manoa",
            "delek_nm",
            "koah_sus",
            "shnat_yitzur",
            "technologiat_hanaa_nm",
            "degem_nm",
        ],
    )

    grouped: dict[tuple, dict] = {}
    for row in records:
        key = _variant_key(row)
        bucket = grouped.setdefault(
            key,
            {
                "trim": (row.get("ramat_gimur") or "").strip() or "Standard",
                "engine": _format_engine(row),
                "fuel": row.get("delek_nm"),
                "engine_cc": row.get("nefah_manoa"),
                "horsepower": row.get("koah_sus"),
                "years": set(),
            },
        )
        year = row.get("shnat_yitzur")
        if year:
            bucket["years"].add(int(year))

    variants: list[CatalogVariant] = []
    for index, (key, data) in enumerate(sorted(grouped.items(), key=lambda item: item[1]["trim"])):
        years = sorted(data["years"])
        variant_id = f"{make_id}-{model_id}-{index}"
        variants.append(
            CatalogVariant(
                id=variant_id,
                trim=data["trim"],
                engine=data["engine"],
                fuel=str(data["fuel"]) if data["fuel"] else None,
                engine_cc=int(data["engine_cc"]) if data["engine_cc"] else None,
                horsepower=int(data["horsepower"]) if data["horsepower"] else None,
                year_from=years[0] if years else None,
                year_to=years[-1] if years else None,
            )
        )

    _cache_set(cache_key, variants)
    return variants
