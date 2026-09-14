from __future__ import annotations

from app.media.video_assets import _pick_variant, load_video_assets_for_keys
from app.models import MediaAsset
from app.schemas_media import ImageMediaResponse
from sqlalchemy.ext.asyncio import AsyncSession


def image_media_response(source_key: str, asset: MediaAsset | None) -> ImageMediaResponse:
    if asset is None:
        return ImageMediaResponse(
            source_key=source_key,
            status="ready",
            thumb_key=source_key,
            display_key=source_key,
        )

    variants = asset.variants or {}
    thumb = _pick_variant(variants, "thumb")
    display = _pick_variant(variants, "display") or asset.original_key or source_key

    if asset.status == "ready":
        return ImageMediaResponse(
            source_key=source_key,
            status="ready",
            thumb_key=thumb or display or source_key,
            display_key=display or source_key,
        )

    if asset.status == "failed":
        return ImageMediaResponse(
            source_key=source_key,
            status="failed",
            display_key=source_key,
            error_message=asset.error_message,
        )

    return ImageMediaResponse(
        source_key=source_key,
        status=asset.status,
        thumb_key=thumb,
        display_key=asset.original_key or source_key,
    )


async def build_image_media_map(
    db: AsyncSession,
    storage_keys: list[str],
) -> dict[str, ImageMediaResponse]:
    assets = await load_video_assets_for_keys(db, storage_keys)
    return {key: image_media_response(key, assets.get(key)) for key in storage_keys}
