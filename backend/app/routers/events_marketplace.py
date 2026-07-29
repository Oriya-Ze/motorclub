import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Event, EventParticipant, Product, User
from app.schemas import EventCreate, EventResponse, ProductCreate, ProductResponse

events_router = APIRouter(prefix="/events", tags=["events"])
marketplace_router = APIRouter(prefix="/marketplace", tags=["marketplace"])
services_router = APIRouter(prefix="/services", tags=["services"])


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
    event = Event(
        creator_id=user.id,
        title=body.title,
        description=body.description,
        event_type=body.event_type,
        location=body.location,
        event_date=body.event_date,
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


@marketplace_router.get("", response_model=list[ProductResponse])
async def list_products(
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(Product).order_by(Product.created_at.desc())
    if category:
        query = query.where(Product.category == category)
    result = await db.execute(query)
    products = result.scalars().all()
    responses = []
    for p in products:
        seller = await db.get(User, p.business_id)
        responses.append(
            ProductResponse(
                id=p.id,
                business_id=p.business_id,
                name=p.name,
                description=p.description,
                price=p.price,
                category=p.category,
                image_urls=p.image_urls,
                created_at=p.created_at,
                seller=user_to_public(seller) if seller else None,
            )
        )
    return responses


@marketplace_router.post("", response_model=ProductResponse)
async def create_product(
    body: ProductCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    product = Product(
        business_id=user.id,
        name=body.name,
        description=body.description,
        price=body.price,
        category=body.category,
        image_urls=body.image_urls,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return ProductResponse(
        id=product.id,
        business_id=product.business_id,
        name=product.name,
        description=product.description,
        price=product.price,
        category=product.category,
        image_urls=product.image_urls,
        created_at=product.created_at,
        seller=user_to_public(user),
    )


@services_router.get("", response_model=list[dict])
async def list_services(
    business_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    query = select(User).where(User.account_type == "business")
    if business_type:
        query = query.where(User.business_type == business_type)
    result = await db.execute(query.order_by(User.full_name))
    users = result.scalars().all()
    return [
        {
            "id": str(u.id),
            "full_name": u.full_name,
            "username": u.username,
            "business_type": u.business_type,
            "business_description": u.business_description,
            "business_phone": u.business_phone,
            "business_address": u.business_address,
            "profile_picture_url": u.profile_picture_url,
            "is_verified": u.is_verified,
        }
        for u in users
    ]
