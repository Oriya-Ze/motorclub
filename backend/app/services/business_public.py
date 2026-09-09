"""Shared helpers for business public profiles."""

from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import BusinessReview, User

ISRAEL_TZ = ZoneInfo("Asia/Jerusalem")

DAY_KEYS = ("0", "1", "2", "3", "4", "5", "6")  # 0=Sunday


def is_open_now(hours: dict | None, *, now: datetime | None = None) -> bool | None:
    """Return True/False if hours configured, None if unknown."""
    if not hours:
        return None
    current = now or datetime.now(ISRAEL_TZ)
    key = str(current.weekday())
    # Python weekday: Mon=0 .. Sun=6 → map to our Sun=0 .. Sat=6
    iso_key = str((current.weekday() + 1) % 7)
    day = hours.get(iso_key) or hours.get(key)
    if not day:
        return None
    if day.get("closed"):
        return False
    open_t = day.get("open")
    close_t = day.get("close")
    if not open_t or not close_t:
        return None
    try:
        open_h, open_m = map(int, open_t.split(":")[:2])
        close_h, close_m = map(int, close_t.split(":")[:2])
    except (ValueError, AttributeError):
        return None
    minutes = current.hour * 60 + current.minute
    open_min = open_h * 60 + open_m
    close_min = close_h * 60 + close_m
    if close_min <= open_min:
        return minutes >= open_min or minutes < close_min
    return open_min <= minutes < close_min


async def review_stats(db: AsyncSession, business_id) -> tuple[float | None, int]:
    avg = await db.scalar(
        select(func.avg(BusinessReview.rating)).where(BusinessReview.business_id == business_id)
    )
    count = await db.scalar(
        select(func.count()).select_from(BusinessReview).where(BusinessReview.business_id == business_id)
    )
    if not count:
        return None, 0
    return round(float(avg), 1) if avg is not None else None, int(count)


def business_public_dict(u: User, *, rating_avg: float | None = None, review_count: int = 0) -> dict:
    open_now = is_open_now(u.business_hours)
    return {
        "id": str(u.id),
        "full_name": u.full_name,
        "username": u.username,
        "business_type": u.business_type,
        "business_description": u.business_description,
        "business_phone": u.business_phone,
        "business_address": u.business_address,
        "business_website": u.business_website,
        "business_registration_id": u.business_registration_id,
        "business_hours": u.business_hours,
        "gallery_urls": u.gallery_urls or [],
        "certifications": u.certifications or [],
        "service_area": u.service_area,
        "cover_image_url": u.cover_image_url,
        "profile_picture_url": u.profile_picture_url,
        "is_verified": u.is_verified,
        "is_open_now": open_now,
        "rating_avg": rating_avg,
        "review_count": review_count,
    }
