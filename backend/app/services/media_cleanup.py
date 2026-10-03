"""Delete the files behind media a member removed.

Posts, products, vehicles, stories, messages and profiles point at uploaded files. Once the
row that used an upload is gone and nothing else points at the same upload, the original,
its processed copies, and any quarantined copy are deleted, and the CDN forgets them.

Call `unreferenced_media` after the rows are deleted or updated and flushed, commit, then
pass the result to `delete_media_files`. Deleting files after the commit means a failed
delete leaves an orphaned file rather than a row pointing at nothing.
"""

from __future__ import annotations

import logging
from collections.abc import Iterable

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.media.keys import is_private_storage_key, is_video_storage_key, parse_storage_key, public_storage_key
from app.models import (
    DirectMessage,
    Event,
    GroupMessage,
    MediaAsset,
    Post,
    Product,
    Story,
    User,
    Vehicle,
)
from app.services.media_gate import _object_exists, _quarantine_key, delete_media_object, invalidate_public_paths

logger = logging.getLogger(__name__)

_SCALAR_COLUMNS = (
    User.profile_picture_url,
    User.cover_image_url,
    Vehicle.walkaround_url,
    Vehicle.sound_url,
    GroupMessage.image_url,
    GroupMessage.video_url,
    Event.image_url,
    DirectMessage.image_url,
    DirectMessage.video_url,
    Story.media_url,
)
_ARRAY_COLUMNS = (
    User.gallery_urls,
    Vehicle.image_urls,
    Post.image_urls,
    Post.video_urls,
    Product.image_urls,
    Product.pending_image_urls,
)

_VIDEO_VARIANTS = ("1080p.mp4", "720p.mp4", "480p.mp4", "poster.webp", "thumb.webp")
_IMAGE_VARIANTS = ("display.webp", "thumb.webp")


def _private_storage_key(storage_key: str) -> str:
    if is_private_storage_key(storage_key):
        return storage_key
    parts = storage_key.split("/", 2)
    if len(parts) < 3 or parts[0] != "users":
        return storage_key
    return f"users/{parts[1]}/private/{parts[2]}"


def key_forms(storage_key: str) -> set[str]:
    """The same upload before and after promotion from the private path."""
    return {storage_key, public_storage_key(storage_key), _private_storage_key(storage_key)}


def same_upload(left: str, right: str) -> bool:
    return public_storage_key(left) == public_storage_key(right)


def removed_media(before: Iterable[str | None] | None, after: Iterable[str | None] | None) -> list[str]:
    """Uploads in `before` that `after` no longer uses, treating a promoted key as the same upload."""
    kept = {public_storage_key(key) for key in (after or []) if key}
    seen: set[str] = set()
    removed: list[str] = []
    for key in before or []:
        if not key:
            continue
        public = public_storage_key(key)
        if public in kept or public in seen:
            continue
        seen.add(public)
        removed.append(key)
    return removed


async def _is_referenced(db: AsyncSession, storage_key: str) -> bool:
    forms = list(key_forms(storage_key))
    for column in _SCALAR_COLUMNS:
        found = await db.scalar(select(column).where(column.in_(forms)).limit(1))
        if found:
            return True
    for column in _ARRAY_COLUMNS:
        found = await db.scalar(select(column).where(or_(*[column.any(form) for form in forms])).limit(1))
        if found:
            return True
    return False


async def unreferenced_media(db: AsyncSession, keys: Iterable[str | None]) -> list[str]:
    """Keys from `keys` that no row points at any more. Also drops their media_assets rows."""
    candidates: list[str] = []
    seen: set[str] = set()
    for key in keys:
        if not key or not key.startswith("users/"):
            continue
        public = public_storage_key(key)
        if public in seen:
            continue
        seen.add(public)
        candidates.append(key)

    await db.flush()
    orphaned: list[str] = []
    for key in candidates:
        if await _is_referenced(db, key):
            continue
        orphaned.append(key)
        try:
            asset = await db.get(MediaAsset, parse_storage_key(key).media_id)
        except Exception:
            asset = None
        if asset is not None:
            await db.delete(asset)
    return orphaned


def media_objects(storage_key: str) -> list[str]:
    """Every object an upload may have produced: both key forms, processed copies, quarantine."""
    try:
        parsed = parse_storage_key(storage_key)
    except Exception:
        return [storage_key]
    user_id, media_id = parsed.user_id, parsed.media_id
    public = public_storage_key(storage_key)
    objects = [public, _private_storage_key(storage_key)]
    if is_video_storage_key(storage_key):
        objects += [f"users/{user_id}/videos/{media_id}/{name}" for name in _VIDEO_VARIANTS]
    else:
        objects += [f"users/{user_id}/images/{media_id}/{name}" for name in _IMAGE_VARIANTS]
    objects += [_quarantine_key(key) for key in list(objects) if not is_private_storage_key(key)]
    return list(dict.fromkeys(objects))


def delete_media_files(keys: Iterable[str]) -> list[str]:
    """Delete every object behind each upload. Returns the public paths it cleared from the CDN."""
    cleared: list[str] = []
    for key in keys:
        for obj in media_objects(key):
            try:
                if not _object_exists(obj):
                    continue
                delete_media_object(obj)
            except Exception:
                logger.exception("Could not delete media object %s", obj)
                continue
            if not is_private_storage_key(obj):
                cleared.append(f"/{obj}")
    if cleared:
        try:
            invalidate_public_paths(cleared)
        except Exception:
            logger.exception("Could not invalidate %d media paths", len(cleared))
    return cleared


async def user_media(db: AsyncSession, user_id) -> tuple[list[str], list]:
    """Every upload key a user's rows point at, and the ids of their processed uploads."""
    prefix = f"users/{user_id}/"
    keys: list[str] = []
    for column in _SCALAR_COLUMNS:
        keys += (await db.execute(select(column).where(column.like(f"{prefix}%")))).scalars().all()
    for column in _ARRAY_COLUMNS:
        rows = (
            await db.execute(select(column).where(func.array_to_string(column, ",").like(f"%{prefix}%")))
        ).scalars().all()
        keys += [key for values in rows for key in (values or []) if key and key.startswith(prefix)]
    media_ids = (await db.execute(select(MediaAsset.id).where(MediaAsset.user_id == user_id))).scalars().all()
    return list(dict.fromkeys(keys)), list(media_ids)


def delete_user_media_files(user_id, keys: Iterable[str], media_ids: Iterable) -> list[str]:
    """Delete a deleted account's uploads, including processed copies whose original is already gone."""
    cleared = delete_media_files(keys)
    extra: list[str] = []
    for media_id in media_ids:
        for name in _IMAGE_VARIANTS:
            extra.append(f"users/{user_id}/images/{media_id}/{name}")
        for name in _VIDEO_VARIANTS:
            extra.append(f"users/{user_id}/videos/{media_id}/{name}")
    for obj in extra + [_quarantine_key(key) for key in extra]:
        try:
            if not _object_exists(obj):
                continue
            delete_media_object(obj)
        except Exception:
            logger.exception("Could not delete media object %s", obj)
            continue
        if not is_private_storage_key(obj):
            cleared.append(f"/{obj}")
    if cleared:
        try:
            invalidate_public_paths(cleared)
        except Exception:
            logger.exception("Could not invalidate %d media paths", len(cleared))
    return cleared
