from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.media.keys import media_id_from_storage_key, processed_video_key
from app.models import MediaAsset
from app.schemas_media import VideoMediaResponse

VARIANT_480 = "480p"
VARIANT_720 = "720p"
VARIANT_1080 = "1080p"
VARIANT_POSTER = "poster"
VARIANT_THUMB = "thumb"


def variant_keys(user_id: uuid.UUID, media_id: uuid.UUID) -> dict[str, str]:
    prefix = processed_video_key(user_id, media_id, "").rstrip("/")
    return {
        VARIANT_480: f"{prefix}/480p.mp4",
        VARIANT_720: f"{prefix}/720p.mp4",
        VARIANT_1080: f"{prefix}/1080p.mp4",
        VARIANT_POSTER: f"{prefix}/poster.webp",
        VARIANT_THUMB: f"{prefix}/thumb.webp",
    }


async def ensure_uploaded_video_asset(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    storage_key: str,
    purpose_segment: str,
) -> MediaAsset:
    media_id = media_id_from_storage_key(storage_key)
    existing = await db.get(MediaAsset, media_id)
    if existing:
        return existing
    asset = MediaAsset(
        id=media_id,
        user_id=user_id,
        purpose=purpose_segment,
        original_key=storage_key,
        status="uploaded",
    )
    db.add(asset)
    await db.flush()
    return asset


def _pick_variant(variants: dict[str, Any] | None, *names: str) -> str | None:
    if not variants:
        return None
    for name in names:
        value = variants.get(name)
        if isinstance(value, str) and value:
            return value
    return None


def video_media_response(source_key: str, asset: MediaAsset | None) -> VideoMediaResponse:
    if asset is None:
        # Pre-B2 uploads: no transcode row — play the original file directly.
        return VideoMediaResponse(
            source_key=source_key,
            status="ready",
            url_480p=source_key,
            url_720p=source_key,
            url_1080p=source_key,
        )

    variants = asset.variants or {}
    poster = _pick_variant(variants, VARIANT_POSTER)
    thumb = _pick_variant(variants, VARIANT_THUMB)
    url_480p = _pick_variant(variants, VARIANT_480)
    url_720p = _pick_variant(variants, VARIANT_720)
    url_1080p = _pick_variant(variants, VARIANT_1080)

    if asset.status == "ready":
        return VideoMediaResponse(
            source_key=source_key,
            status="ready",
            poster_key=poster,
            thumb_key=thumb,
            url_480p=url_480p,
            url_720p=url_720p,
            url_1080p=url_1080p or url_720p or url_480p,
        )

    if asset.status == "failed":
        return VideoMediaResponse(
            source_key=source_key,
            status="failed",
            poster_key=poster,
            error_message=asset.error_message,
        )

    return VideoMediaResponse(
        source_key=source_key,
        status=asset.status,
        poster_key=poster,
        thumb_key=thumb,
    )


async def load_video_assets_for_keys(
    db: AsyncSession,
    storage_keys: list[str],
) -> dict[str, MediaAsset]:
    if not storage_keys:
        return {}

    media_ids: list[uuid.UUID] = []
    key_by_id: dict[uuid.UUID, str] = {}
    for key in storage_keys:
        try:
            media_id = media_id_from_storage_key(key)
        except Exception:
            continue
        media_ids.append(media_id)
        key_by_id[media_id] = key

    if not media_ids:
        return {}

    result = await db.execute(select(MediaAsset).where(MediaAsset.id.in_(media_ids)))
    assets = result.scalars().all()
    return {key_by_id[asset.id]: asset for asset in assets if asset.id in key_by_id}


async def build_video_media_map(
    db: AsyncSession,
    storage_keys: list[str],
) -> dict[str, VideoMediaResponse]:
    assets = await load_video_assets_for_keys(db, storage_keys)
    return {key: video_media_response(key, assets.get(key)) for key in storage_keys}
