from datetime import UTC, datetime
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_types import WORKSHOP_BUSINESS_TYPES
from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Event, EventParticipant, Product, User
from app.schemas import EventCreate, EventResponse, ProductCreate, ProductPage, ProductResponse, ProductUpdate

events_router = APIRouter(prefix="/events", tags=["events"])
marketplace_router = APIRouter(prefix="/marketplace", tags=["marketplace"])
businesses_router = APIRouter(prefix="/businesses", tags=["businesses"])
services_router = APIRouter(prefix="/services", tags=["services"])
workshops_router = APIRouter(prefix="/workshops", tags=["workshops"])


from app.services.business_public import business_public_dict, review_stats


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo is not None else value.replace(tzinfo=UTC)


def event_has_ended(event: Event) -> bool:
    end = _aware(event.event_end_date or event.event_date)
    return end < datetime.now(UTC)


async def _business_public(db: AsyncSession, u: User) -> dict:
    rating_avg, review_count = await review_stats(db, u.id)
    return business_public_dict(u, rating_avg=rating_avg, review_count=review_count)


MAX_PRODUCT_IMAGES = 8
PRODUCT_CONDITIONS = frozenset({"new", "used", "refurbished"})


def _clean(value: str | None, limit: int) -> str | None:
    if value is None:
        return None
    text = value.strip()
    return text[:limit] or None


def _apply_product_fields(product: Product, body: ProductCreate | ProductUpdate) -> None:
    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        product.name = data["name"].strip()
    if "description" in data:
        product.description = _clean(data["description"], 4000)
    if "price" in data and data["price"] is not None:
        product.price = data["price"]
    if "category" in data and data["category"]:
        product.category = data["category"]
    if "image_urls" in data:
        urls = [url for url in (data["image_urls"] or []) if url][:MAX_PRODUCT_IMAGES]
        if len(data["image_urls"] or []) > MAX_PRODUCT_IMAGES:
            raise HTTPException(status_code=400, detail=f"At most {MAX_PRODUCT_IMAGES} images")
        product.image_urls = urls or None
    if "condition" in data:
        condition = data["condition"]
        if condition and condition not in PRODUCT_CONDITIONS:
            raise HTTPException(status_code=400, detail="Invalid product condition")
        product.condition = condition or None
    for field, limit in (
        ("fit_make", 80),
        ("fit_model", 80),
        ("brand", 80),
        ("sku", 80),
        ("pickup_area", 120),
    ):
        if field in data:
            setattr(product, field, _clean(data[field], limit))
    if "fit_year_from" in data:
        product.fit_year_from = data["fit_year_from"]
    if "fit_year_to" in data:
        product.fit_year_to = data["fit_year_to"]
    if "ships" in data:
        product.ships = data["ships"]


async def _moderate_listing(db: AsyncSession, product: Product) -> None:
    from app.models import MediaScan
    from app.services.image_moderation import combine, content_hash, scan_bytes

    from app.media.keys import is_private_storage_key
    from app.services.media_gate import promote_private_image

    keys = [key for key in (product.image_urls or []) if key]
    decisions = []
    payloads = []
    for key in keys:
        payload = _read_media_bytes(key)
        payloads.append(payload)
        decisions.append(scan_bytes(payload))
    for key, payload, decision in zip(keys, payloads, decisions, strict=True):
        db.add(
            MediaScan(
                storage_key=key,
                content_hash=content_hash(payload),
                decision=decision.decision,
                labels=decision.labels,
                model_version=decision.model_version,
                aws_request_id=decision.aws_request_id,
                policy_version=decision.policy_version,
                error_message=decision.error_message,
            )
        )
    product.moderation_status = combine(decisions) if decisions else "pending"
    if product.moderation_status == "approved":
        product.image_urls = [
            promote_private_image(key) if is_private_storage_key(key) else key for key in keys
        ]
    product.listing_status = "published" if product.moderation_status == "approved" else "pending_review"


def _read_media_bytes(key: str) -> bytes:
    from app.config import settings

    if settings.media_storage_provider != "s3" or not settings.s3_media_bucket:
        return b"local-placeholder"
    try:
        import boto3

        obj = boto3.client("s3", region_name=settings.aws_region).get_object(
            Bucket=settings.s3_media_bucket, Key=key
        )
        return obj["Body"].read(settings.max_image_upload_bytes)
    except Exception:
        return b""


async def _product_response(db: AsyncSession, product: Product) -> ProductResponse:
    seller = await db.get(User, product.business_id)
    return ProductResponse(
        id=product.id,
        business_id=product.business_id,
        name=product.name,
        description=product.description,
        price=product.price,
        category=product.category,
        image_urls=product.image_urls,
        condition=product.condition,
        fit_make=product.fit_make,
        fit_model=product.fit_model,
        fit_year_from=product.fit_year_from,
        fit_year_to=product.fit_year_to,
        brand=product.brand,
        sku=product.sku,
        pickup_area=product.pickup_area,
        ships=product.ships,
        listing_status=product.listing_status,
        moderation_status=product.moderation_status,
        created_at=product.created_at,
        seller=user_to_public(seller) if seller and seller.is_active else None,
    )


async def _get_active_business(db: AsyncSession, user_id: uuid.UUID) -> User:
    user = await db.get(User, user_id)
    if not user or user.account_type != "business" or not user.is_active:
        raise HTTPException(status_code=404, detail="Business not found")
    return user


@events_router.get("", response_model=list[EventResponse])
async def list_events(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await db.execute(select(Event).order_by(Event.event_date.asc()))
    events = result.scalars().all()
    responses = []
    for e in events:
        participants_count = await db.scalar(
            select(func.count()).select_from(EventParticipant).where(EventParticipant.event_id == e.id)
        )
        is_joined = bool(
            await db.scalar(
                select(EventParticipant).where(
                    EventParticipant.event_id == e.id,
                    EventParticipant.user_id == current_user.id,
                )
            )
        )
        responses.append(
            EventResponse(
                id=e.id,
                creator_id=e.creator_id,
                title=e.title,
                description=e.description,
                event_type=e.event_type,
                location=e.location,
                event_date=e.event_date,
                event_end_date=e.event_end_date,
                max_participants=e.max_participants,
                image_url=e.image_url,
                participants_count=participants_count or 0,
                is_joined=is_joined,
                created_at=e.created_at,
            )
        )
    return responses


@events_router.post("", response_model=EventResponse)
async def create_event(
    body: EventCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if user.account_type != "business":
        raise HTTPException(status_code=403, detail="Business account required to create events")
    if body.event_end_date and body.event_end_date <= body.event_date:
        raise HTTPException(status_code=400, detail="End time must be after start time")
    event = Event(
        creator_id=user.id,
        title=body.title,
        description=body.description,
        event_type=body.event_type,
        location=body.location,
        event_date=body.event_date,
        event_end_date=body.event_end_date,
        max_participants=body.max_participants,
        image_url=body.image_url,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return EventResponse(
        id=event.id,
        creator_id=event.creator_id,
        title=event.title,
        description=event.description,
        event_type=event.event_type,
        location=event.location,
        event_date=event.event_date,
        event_end_date=event.event_end_date,
        max_participants=event.max_participants,
        image_url=event.image_url,
        participants_count=0,
        is_joined=False,
        created_at=event.created_at,
    )


@events_router.post("/{event_id}/join")
async def join_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event_has_ended(event):
        raise HTTPException(status_code=400, detail="Event has ended")

    existing = await db.scalar(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id, EventParticipant.user_id == user.id
        )
    )
    if existing:
        return {"joined": True}

    if event.max_participants:
        count = await db.scalar(
            select(func.count()).select_from(EventParticipant).where(EventParticipant.event_id == event_id)
        )
        if count and count >= event.max_participants:
            raise HTTPException(status_code=400, detail="Event is full")

    db.add(EventParticipant(event_id=event_id, user_id=user.id))
    await db.commit()
    return {"joined": True}


@events_router.post("/{event_id}/leave")
async def leave_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    participation = await db.scalar(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.user_id == user.id,
        )
    )
    if not participation:
        raise HTTPException(status_code=400, detail="You are not registered for this event")

    await db.delete(participation)
    await db.commit()
    return {"joined": False}


@events_router.delete("/{event_id}")
async def delete_event(
    event_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    event = await db.get(Event, event_id)
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    if event.creator_id != user.id:
        raise HTTPException(status_code=403, detail="Only the event creator can delete this event")

    await db.delete(event)
    await db.commit()
    return {"deleted": True}


@marketplace_router.get("", response_model=ProductPage)
async def list_products(
    category: str | None = None,
    business_id: uuid.UUID | None = None,
    q: str | None = None,
    condition: str | None = None,
    seller: str | None = None,
    min_price: float | None = None,
    max_price: float | None = None,
    sort: str = "newest",
    skip: int = 0,
    limit: int = 24,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    filters = [User.is_active.is_(True), Product.listing_status == "published"]
    if category:
        filters.append(Product.category == category)
    if business_id:
        filters.append(Product.business_id == business_id)
    if condition:
        filters.append(Product.condition == condition)
    if seller == "business":
        filters.append(User.account_type == "business")
    elif seller == "personal":
        filters.append(User.account_type != "business")
    if min_price is not None:
        filters.append(Product.price >= min_price)
    if max_price is not None:
        filters.append(Product.price <= max_price)
    if q and q.strip():
        term = f"%{q.strip()}%"
        filters.append(
            or_(
                Product.name.ilike(term),
                Product.description.ilike(term),
                Product.brand.ilike(term),
                Product.fit_make.ilike(term),
                Product.fit_model.ilike(term),
                Product.pickup_area.ilike(term),
            )
        )
    base = select(Product).join(User, Product.business_id == User.id).where(*filters)
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = Product.created_at.desc()
    if sort == "price_asc":
        order = Product.price.asc()
    elif sort == "price_desc":
        order = Product.price.desc()
    result = await db.execute(base.order_by(order).offset(max(skip, 0)).limit(min(max(limit, 1), 48)))
    products = result.scalars().all()
    return ProductPage(items=[await _product_response(db, p) for p in products], total=int(total))


@marketplace_router.get("/mine", response_model=list[ProductResponse])
async def list_my_products(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    result = await db.execute(
        select(Product).where(Product.business_id == user.id).order_by(Product.created_at.desc())
    )
    return [await _product_response(db, p) for p in result.scalars().all()]


@marketplace_router.get("/{product_id}", response_model=ProductResponse)
async def get_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.listing_status != "published" and product.business_id != user.id and not user.is_admin and not user.is_moderator:
        raise HTTPException(status_code=404, detail="Product not found")
    return await _product_response(db, product)


@marketplace_router.post("", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    product = Product(
        business_id=user.id,
        name=body.name.strip(),
        description=body.description,
        price=body.price,
        category=body.category,
        listing_status="draft",
        moderation_status="pending",
    )
    _apply_product_fields(product, body)
    if body.publish:
        if not product.image_urls:
            raise HTTPException(status_code=400, detail="At least one image is required")
        await _moderate_listing(db, product)
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return await _product_response(db, product)


@marketplace_router.patch("/{product_id}", response_model=ProductResponse)
async def update_product(
    product_id: uuid.UUID,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.business_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    was_published = product.listing_status == "published"
    _apply_product_fields(product, body)
    if body.publish:
        if not product.image_urls:
            raise HTTPException(status_code=400, detail="At least one image is required")
        if was_published:
            product.listing_status = "pending_review"
        await _moderate_listing(db, product)
    elif "image_urls" in body.model_dump(exclude_unset=True) and was_published:
        product.listing_status = "pending_review"
        product.moderation_status = "pending"
    await db.commit()
    await db.refresh(product)
    return await _product_response(db, product)


@marketplace_router.delete("/{product_id}")
async def delete_product(
    product_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if product.business_id != user.id:
        raise HTTPException(status_code=403, detail="Not allowed")
    await db.delete(product)
    await db.commit()
    return {"deleted": True}


def _list_businesses_query(
    *,
    business_type: str | None,
    q: str | None,
    types: frozenset[str] | None = None,
):
    query = select(User).where(
        User.account_type == "business",
        User.is_active.is_(True),
        User.business_hidden.is_(False),
    )
    if types is not None:
        query = query.where(User.business_type.in_(types))
    if business_type:
        query = query.where(User.business_type == business_type)
    if q:
        stem = q.strip()
        term = f"%{stem}%"
        prefix = f"{stem}%"
        query = query.where(
            or_(
                User.full_name.ilike(term),
                User.username.ilike(term),
                User.business_description.ilike(term),
                User.business_address.ilike(term),
            )
        )
        return query.order_by(
            case(
                (User.full_name.ilike(prefix), 0),
                (User.username.ilike(prefix), 1),
                (User.full_name.ilike(term), 2),
                else_=3,
            ),
            User.full_name,
        ).limit(20)
    return query.order_by(User.full_name)


@businesses_router.get("", response_model=list[dict])
async def list_businesses(
    business_type: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(_list_businesses_query(business_type=business_type, q=q))
    return [await _business_public(db, u) for u in result.scalars().all()]


@businesses_router.get("/{user_id}", response_model=dict)
async def get_business_listing(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    user = await _get_active_business(db, user_id)
    return await _business_public(db, user)


@services_router.get("", response_model=list[dict])
async def list_services(
    business_type: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(_list_businesses_query(business_type=business_type, q=q))
    return [await _business_public(db, u) for u in result.scalars().all()]


@services_router.get("/{user_id}", response_model=dict)
async def get_service(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    user = await _get_active_business(db, user_id)
    return await _business_public(db, user)


@workshops_router.get("", response_model=list[dict])
async def list_workshops(
    business_type: str | None = None,
    q: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    if business_type and business_type not in WORKSHOP_BUSINESS_TYPES:
        raise HTTPException(status_code=400, detail="Invalid workshop specialty")
    result = await db.execute(
        _list_businesses_query(
            business_type=business_type,
            q=q,
            types=WORKSHOP_BUSINESS_TYPES,
        )
    )
    return [await _business_public(db, u) for u in result.scalars().all()]


@workshops_router.get("/{user_id}", response_model=dict)
async def get_workshop(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    user = await _get_active_business(db, user_id)
    if user.business_type not in WORKSHOP_BUSINESS_TYPES:
        raise HTTPException(status_code=404, detail="Workshop not found")
    return await _business_public(db, user)
