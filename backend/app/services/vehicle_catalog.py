"""Israeli vehicle catalog via Ministry of Transport WLTP dataset on data.gov.il."""

from __future__ import annotations

import asyncio
import json
import logging
import time
import zlib
from dataclasses import dataclass
from collections import defaultdict

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
    id: str
    name: str


@dataclass(frozen=True)
class CatalogModel:
    id: str
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


@dataclass(frozen=True)
class _BrandMeta:
    id: str
    name: str
    tozeret_cds: frozenset[int]


@dataclass(frozen=True)
class _CatalogIndex:
    brands: dict[str, _BrandMeta]
    models_by_brand: dict[str, dict[str, CatalogModel]]
    model_names_by_brand: dict[str, dict[str, str]]


def _slug(value: str) -> str:
    return format(zlib.crc32(value.strip().encode("utf-8")) & 0xFFFFFFFF, "x")


def _normalize_label(value: str) -> str:
    return " ".join(value.strip().upper().split())


def _display_model_name(raw: str) -> str:
    cleaned = " ".join(raw.strip().split())
    return cleaned.upper() if cleaned.isascii() else cleaned


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


def _brand_name(row: dict) -> str:
    tozar = (row.get("tozar") or "").strip()
    if tozar:
        return tozar
    tozeret = (row.get("tozeret_nm") or "").strip()
    if not tozeret:
        return ""
    # Fallback: "קיה קוריאה" -> "קיה"
    return tozeret.split()[0] if tozeret else ""


def _format_engine(record: dict) -> str:
    parts: list[str] = []
    cc = record.get("nefah_manoa")
    if cc:
        liters = cc / 1000
        parts.append(f"{liters:.1f}L" if liters >= 1 else f'{cc} סמ"ק')
    fuel = record.get("delek_nm")
    if fuel:
        parts.append(str(fuel))
    hp = record.get("koah_sus")
    if hp:
        parts.append(f'{hp} כ"ס')
    tech = record.get("technologiat_hanaa_nm")
    if tech and tech not in ("הנעה רגילה", "לא ידוע", "לא ידוע קוד "):
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


async def _load_catalog_index() -> _CatalogIndex:
    cached = _cache_get("catalog_index")
    if cached is not None:
        return cached  # type: ignore[return-value]

    async with _cache_lock:
        cached = _cache_get("catalog_index")
        if cached is not None:
            return cached  # type: ignore[return-value]

        records = await _search_all(
            fields=["tozeret_cd", "tozeret_nm", "tozar", "degem_cd", "degem_nm", "kinuy_mishari"]
        )

        brand_cds: dict[str, set[int]] = defaultdict(set)
        brand_names: dict[str, str] = {}
        models_raw: dict[str, dict[str, tuple[str, str]]] = defaultdict(dict)

        for row in records:
            name = _brand_name(row)
            tozeret_cd = row.get("tozeret_cd")
            if not name or tozeret_cd is None:
                continue

            brand_id = _slug(name)
            brand_cds[brand_id].add(int(tozeret_cd))
            brand_names.setdefault(brand_id, name)

            commercial = (row.get("kinuy_mishari") or "").strip()
            code = (row.get("degem_nm") or "").strip()
            model_label = commercial or code
            if not model_label:
                continue

            model_key = _normalize_label(model_label)
            display = _display_model_name(commercial or code)
            existing = models_raw[brand_id].get(model_key)
            if existing is None or (commercial and existing[0] == existing[1]):
                models_raw[brand_id][model_key] = (display, code or display)

        brands: dict[str, _BrandMeta] = {}
        models_by_brand: dict[str, dict[str, CatalogModel]] = {}
        model_names_by_brand: dict[str, dict[str, str]] = {}

        for brand_id, cds in brand_cds.items():
            brands[brand_id] = _BrandMeta(
                id=brand_id,
                name=brand_names[brand_id],
                tozeret_cds=frozenset(cds),
            )
            model_map: dict[str, CatalogModel] = {}
            name_map: dict[str, str] = {}
            for model_key, (display, code) in models_raw[brand_id].items():
                model_id = _slug(f"{brand_id}:{model_key}")
                model_map[model_id] = CatalogModel(id=model_id, name=display, code=code)
                name_map[model_id] = model_key
            models_by_brand[brand_id] = model_map
            model_names_by_brand[brand_id] = name_map

        index = _CatalogIndex(
            brands=brands,
            models_by_brand=models_by_brand,
            model_names_by_brand=model_names_by_brand,
        )
        _cache_set("catalog_index", index)
        logger.info(
            "vehicle catalog: indexed %s brands, %s model entries",
            len(brands),
            sum(len(m) for m in models_by_brand.values()),
        )
        return index


def _get_brand(index: _CatalogIndex, brand_id: str) -> _BrandMeta:
    brand = index.brands.get(brand_id)
    if not brand:
        raise KeyError(brand_id)
    return brand


async def list_makes() -> list[CatalogMake]:
    index = await _load_catalog_index()
    return [
        CatalogMake(id=brand.id, name=brand.name)
        for brand in sorted(index.brands.values(), key=lambda b: b.name)
    ]


async def list_models(brand_id: str) -> list[CatalogModel]:
    index = await _load_catalog_index()
    if brand_id not in index.brands:
        return []
    models = list(index.models_by_brand.get(brand_id, {}).values())
    return sorted(models, key=lambda m: m.name)


async def list_variants(brand_id: str, model_id: str) -> list[CatalogVariant]:
    cache_key = f"variants:{brand_id}:{model_id}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached  # type: ignore[return-value]

    index = await _load_catalog_index()
    brand = index.brands.get(brand_id)
    model_key = index.model_names_by_brand.get(brand_id, {}).get(model_id)
    if not brand or not model_key:
        return []

    records: list[dict] = []
    for tozeret_cd in brand.tozeret_cds:
        batch = await _search_all(
            filters={"tozeret_cd": tozeret_cd},
            fields=[
                "kinuy_mishari",
                "degem_nm",
                "ramat_gimur",
                "nefah_manoa",
                "delek_nm",
                "koah_sus",
                "shnat_yitzur",
                "technologiat_hanaa_nm",
            ],
        )
        for row in batch:
            commercial = (row.get("kinuy_mishari") or row.get("degem_nm") or "").strip()
            if _normalize_label(commercial) == model_key:
                records.append(row)

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
    for index_num, (_, data) in enumerate(sorted(grouped.items(), key=lambda item: item[1]["trim"])):
        years = sorted(data["years"])
        variants.append(
            CatalogVariant(
                id=f"{brand_id}-{model_id}-{index_num}",
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
