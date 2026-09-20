"""Business profile: services, reviews, analytics."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.media.image_assets import build_image_media_map, public_image_key
from app.deps import get_current_user, get_optional_user_model, get_user_model, user_to_public
from app.models import BusinessReview, BusinessService, BusinessView, User, Vehicle
from app.schemas import (
    BusinessAnalyticsResponse,
    BusinessReviewCreate,
    BusinessReviewResponse,
    BusinessServiceCreate,
    BusinessServiceResponse,
    BusinessServiceUpdate,
    BusinessTaggedWork,
    BusinessViewCreate,
)
from app.services.business_public import business_public_dict, review_stats
from app.services.vehicle_brands import canonical_make
from app.services.visibility import can_view_profile_content

router = APIRouter(prefix="/business", tags=["business-profile"])


async def _get_active_business(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if not user or user.account_type != "business" or not user.is_active:
        raise HTTPException(status_code=404, detail="Business not found")
    return user


async def _business_public(db: AsyncSession, u: User) -> dict:
    rating_avg, review_count = await review_stats(db, u.id)
    return business_public_dict(u, rating_avg=rating_avg, review_count=review_count)


def _require_business(user: User) -> None:
    if user.account_type != "business":
        raise HTTPException(status_code=403, detail="Business account required")


# --- Owner routes (/me/*) must be registered before /{user_id} ---


@router.get("/me/analytics", response_model=BusinessAnalyticsResponse)
async def my_analytics(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _require_business(user)
    since = datetime.now(UTC) - timedelta(days=30)
    result = await db.execute(
        select(BusinessView.event_type, func.count())
        .where(
            BusinessView.business_id == user.id,
            BusinessView.created_at >= since,
            or_(BusinessView.viewer_id.is_(None), BusinessView.viewer_id != user.id),
        )
        .group_by(BusinessView.event_type)
    )
    counts = {row[0]: row[1] for row in result.all()}
    rating_avg, review_count = await review_stats(db, user.id)
    return BusinessAnalyticsResponse(
        period_days=30,
        views=counts.get("view", 0),
        call_clicks=counts.get("call_click", 0),
        navigate_clicks=counts.get("navigate_click", 0),
        whatsapp_clicks=counts.get("whatsapp_click", 0),
        share_clicks=counts.get("share_click", 0),
        rating_avg=rating_avg,
        review_count=review_count,
    )


@router.get("/me/services", response_model=list[BusinessServiceResponse])
async def list_my_services(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _require_business(user)
    result = await db.execute(
        select(BusinessService)
        .where(BusinessService.business_id == user.id)
        .order_by(BusinessService.sort_order, BusinessService.created_at)
    )
    return [BusinessServiceResponse.model_validate(s) for s in result.scalars().all()]


@router.post("/me/services", response_model=BusinessServiceResponse)
async def create_service(
    body: BusinessServiceCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _require_business(user)
    service = BusinessService(
        business_id=user.id,
        name=body.name.strip(),
        description=body.description.strip() if body.description else None,
        price_from=body.price_from,
        duration_minutes=body.duration_minutes,
        sort_order=body.sort_order,
        is_active=body.is_active,
    )
    db.add(service)
    await db.commit()
    await db.refresh(service)
    return BusinessServiceResponse.model_validate(service)


@router.patch("/me/services/{service_id}", response_model=BusinessServiceResponse)
async def update_service(
    service_id: uuid.UUID,
    body: BusinessServiceUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _require_business(user)
    service = await db.get(BusinessService, service_id)
    if not service or service.business_id != user.id:
        raise HTTPException(status_code=404, detail="Service not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        if field == "name" and isinstance(value, str):
            value = value.strip()
        if field == "description" and isinstance(value, str):
            value = value.strip() or None
        setattr(service, field, value)
    await db.commit()
    await db.refresh(service)
    return BusinessServiceResponse.model_validate(service)


@router.delete("/me/services/{service_id}")
async def delete_service(
    service_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    _require_business(user)
    service = await db.get(BusinessService, service_id)
    if not service or service.business_id != user.id:
        raise HTTPException(status_code=404, detail="Service not found")
    await db.delete(service)
    await db.commit()
    return {"deleted": True}


# --- Public business profile ---


@router.get("/{user_id}", response_model=dict)
async def get_business(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    user = await _get_active_business(db, user_id)
    return await _business_public(db, user)


@router.get("/{user_id}/services", response_model=list[BusinessServiceResponse])
async def list_business_services(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    await _get_active_business(db, user_id)
    result = await db.execute(
        select(BusinessService)
        .where(BusinessService.business_id == user_id, BusinessService.is_active.is_(True))
        .order_by(BusinessService.sort_order, BusinessService.created_at)
    )
    return [BusinessServiceResponse.model_validate(s) for s in result.scalars().all()]


@router.get("/{user_id}/works", response_model=list[BusinessTaggedWork])
async def list_business_works(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
    _=Depends(get_current_user),
):
    await _get_active_business(db, user_id)
    shop_id = str(user_id)
    result = await db.execute(
        select(Vehicle)
        .where(Vehicle.mod_items.contains([{"shop_id": shop_id}]))
        .order_by(Vehicle.created_at.desc())
        .limit(24)
    )
    rows: list[tuple[Vehicle, str, str, str, str, str | None]] = []
    for vehicle in result.scalars().all():
        if not await can_view_profile_content(db, vehicle.user_id, viewer.id if viewer else None):
            continue
        tagged = [
            item
            for item in (vehicle.mod_items or [])
            if isinstance(item, dict) and str(item.get("shop_id") or "") == shop_id and item.get("name")
        ]
        if not tagged:
            continue
        owner = await db.get(User, vehicle.user_id)
        catalog = " ".join(str(part) for part in [vehicle.year, canonical_make(vehicle.make) or vehicle.make, vehicle.model] if part)
        title = (vehicle.nickname or "").strip() or catalog
        first = tagged[0]
        extra = len(tagged) - 1
        mod_name = str(first["name"])
        if extra > 0:
            mod_name = f"{mod_name} +{extra}"
        rows.append((vehicle, title, catalog, mod_name, str(first.get("category") or "other"), owner.full_name if owner else None))
        if len(rows) >= 8:
            break
    first_keys = [vehicle.image_urls[0] for vehicle, *_ in rows if vehicle.image_urls]
    image_media_map = await build_image_media_map(db, list(dict.fromkeys(first_keys)))
    works: list[BusinessTaggedWork] = []
    for vehicle, title, catalog, mod_name, mod_category, owner_name in rows:
        source = vehicle.image_urls[0] if vehicle.image_urls else None
        media = image_media_map.get(source) if source else None
        works.append(
            BusinessTaggedWork(
                vehicle_id=vehicle.id,
                title=title,
                catalog=catalog,
                image_url=public_image_key(media, source),
                mod_name=mod_name,
                mod_category=mod_category,
                owner_name=owner_name,
            )
        )
    return works


@router.get("/{user_id}/reviews", response_model=list[BusinessReviewResponse])
async def list_reviews(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    await _get_active_business(db, user_id)
    result = await db.execute(
        select(BusinessReview)
        .where(BusinessReview.business_id == user_id)
        .order_by(BusinessReview.created_at.desc())
        .limit(50)
    )
    reviews = result.scalars().all()
    out: list[BusinessReviewResponse] = []
    for r in reviews:
        reviewer = await db.get(User, r.reviewer_id)
        out.append(
            BusinessReviewResponse(
                id=r.id,
                business_id=r.business_id,
                rating=r.rating,
                text=r.text,
                created_at=r.created_at,
                reviewer=user_to_public(reviewer) if reviewer else None,
            )
        )
    return out


@router.post("/{user_id}/reviews", response_model=BusinessReviewResponse)
async def create_review(
    user_id: uuid.UUID,
    body: BusinessReviewCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    business = await _get_active_business(db, user_id)
    if business.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot review your own business")
    existing = await db.scalar(
        select(BusinessReview).where(
            BusinessReview.business_id == user_id,
            BusinessReview.reviewer_id == user.id,
        )
    )
    if existing:
        existing.rating = body.rating
        existing.text = body.text.strip() if body.text else None
        await db.commit()
        await db.refresh(existing)
        review = existing
    else:
        review = BusinessReview(
            business_id=user_id,
            reviewer_id=user.id,
            rating=body.rating,
            text=body.text.strip() if body.text else None,
        )
        db.add(review)
        await db.commit()
        await db.refresh(review)
    return BusinessReviewResponse(
        id=review.id,
        business_id=review.business_id,
        rating=review.rating,
        text=review.text,
        created_at=review.created_at,
        reviewer=user_to_public(user),
    )


@router.post("/{user_id}/events")
async def record_event(
    user_id: uuid.UUID,
    body: BusinessViewCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    await _get_active_business(db, user_id)
    if user.id == user_id:
        return {"ok": True}
    allowed = {"view", "call_click", "navigate_click", "whatsapp_click", "share_click"}
    if body.event_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid event type")
    db.add(
        BusinessView(
            business_id=user_id,
            viewer_id=user.id,
            event_type=body.event_type,
        )
    )
    await db.commit()
    return {"ok": True}
