import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_optional_user_model, get_user_model, user_to_public
from app.models import Post, User, Vehicle, VehicleFollower, VehicleSpot
from app.routers.social import create_notification
from app.schemas import (
    PostResponse,
    VehicleCreate,
    VehicleDetailResponse,
    VehicleFollowResponse,
    VehicleModItem,
    VehicleModShop,
    VehicleResponse,
    VehicleSpotResponse,
    VehicleUpdate,
)
from app.services.visibility import can_view_profile_content

router = APIRouter(prefix="/garage", tags=["garage"])

MOD_CATEGORIES = {"engine", "suspension", "exterior", "audio", "other"}


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    trimmed = value.strip()
    return trimmed or None


def _normalize_mod_items(items: list[VehicleModItem] | list[dict] | None) -> list[dict]:
    out: list[dict] = []
    for raw in items or []:
        item = raw if isinstance(raw, VehicleModItem) else VehicleModItem.model_validate(raw)
        name = (item.name or "").strip()
        if not name:
            continue
        category = item.category if item.category in MOD_CATEGORIES else "other"
        brand = _blank_to_none(item.brand)
        out.append(
            {
                "id": item.id or str(uuid.uuid4()),
                "category": category,
                "name": name[:120],
                "brand": brand[:80] if brand else None,
                "shop_id": str(item.shop_id) if item.shop_id else None,
            }
        )
        if len(out) >= 30:
            break
    return out


def _shop_uuid(raw: object | None) -> uuid.UUID | None:
    if not raw:
        return None
    try:
        return uuid.UUID(str(raw))
    except ValueError:
        return None


def _legacy_mod_items(mods: str | None) -> list[dict]:
    text = (mods or "").strip()
    if not text:
        return []
    return [{"id": "legacy", "category": "other", "name": text, "brand": None, "shop_id": None}]


def _mods_summary(items: list[dict]) -> str | None:
    names = [item["name"] for item in items if item.get("name")]
    return " · ".join(names) if names else None


def _raw_mod_items(v: Vehicle) -> list[dict]:
    stored = v.mod_items if isinstance(v.mod_items, list) else []
    return stored or _legacy_mod_items(v.mods)


async def _hydrate_mod_items(db: AsyncSession, items: list[dict]) -> list[VehicleModItem]:
    shop_ids: list[uuid.UUID] = []
    for item in items:
        raw = item.get("shop_id")
        if not raw:
            continue
        try:
            shop_ids.append(uuid.UUID(str(raw)))
        except ValueError:
            continue
    shops: dict[uuid.UUID, User] = {}
    if shop_ids:
        result = await db.execute(
            select(User).where(User.id.in_(shop_ids), User.account_type == "business", User.is_active == True)
        )
        shops = {user.id: user for user in result.scalars().all()}

    hydrated: list[VehicleModItem] = []
    for item in items:
        shop = None
        shop_id = None
        raw = item.get("shop_id")
        if raw:
            try:
                shop_id = uuid.UUID(str(raw))
            except ValueError:
                shop_id = None
        if shop_id and shop_id in shops:
            user = shops[shop_id]
            shop = VehicleModShop(
                id=user.id,
                full_name=user.full_name,
                username=user.username,
                account_type=user.account_type,
                business_type=user.business_type,
                profile_picture_url=user.profile_picture_url,
            )
        else:
            shop_id = None
        name = (item.get("name") or "").strip()
        if not name:
            continue
        hydrated.append(
            VehicleModItem(
                id=str(item.get("id") or uuid.uuid4()),
                category=item.get("category") if item.get("category") in MOD_CATEGORIES else "other",
                name=name,
                brand=item.get("brand"),
                shop_id=shop_id,
                shop=shop,
            )
        )
    return hydrated


async def _vehicle_response(db: AsyncSession, v: Vehicle, *, with_shops: bool = False) -> VehicleResponse:
    items = _raw_mod_items(v)
    return VehicleResponse(
        id=v.id,
        user_id=v.user_id,
        make=v.make,
        model=v.model,
        year=v.year,
        trim=v.trim,
        color=v.color,
        engine=v.engine,
        description=v.description,
        mods=v.mods or _mods_summary(items),
        nickname=v.nickname,
        walkaround_url=v.walkaround_url,
        sound_url=v.sound_url,
        mod_items=await _hydrate_mod_items(db, items) if with_shops else [
            VehicleModItem(
                id=str(item.get("id") or uuid.uuid4()),
                category=item.get("category") if item.get("category") in MOD_CATEGORIES else "other",
                name=item.get("name") or "",
                brand=item.get("brand"),
        shop_id=_shop_uuid(item.get("shop_id")),
            )
            for item in items
            if item.get("name")
        ],
        image_urls=v.image_urls,
        is_primary=v.is_primary,
        created_at=v.created_at,
    )


async def _detail(db: AsyncSession, vehicle: Vehicle, owner: User, viewer: User | None) -> VehicleDetailResponse:
    base = await _vehicle_response(db, vehicle, with_shops=True)
    follower_count = await db.scalar(
        select(func.count()).select_from(VehicleFollower).where(VehicleFollower.vehicle_id == vehicle.id)
    )
    spot_count = await db.scalar(
        select(func.count()).select_from(VehicleSpot).where(VehicleSpot.vehicle_id == vehicle.id)
    )
    is_following = False
    has_spotted = False
    if viewer:
        is_following = await db.scalar(
            select(VehicleFollower.id).where(
                VehicleFollower.vehicle_id == vehicle.id, VehicleFollower.user_id == viewer.id
            )
        ) is not None
        has_spotted = await db.scalar(
            select(VehicleSpot.id).where(VehicleSpot.vehicle_id == vehicle.id, VehicleSpot.user_id == viewer.id)
        ) is not None
    return VehicleDetailResponse(
        **base.model_dump(),
        owner=user_to_public(owner),
        follower_count=int(follower_count or 0),
        is_following=is_following,
        spot_count=int(spot_count or 0),
        has_spotted=has_spotted,
    )


async def _visible_vehicle(db: AsyncSession, vehicle_id: uuid.UUID, viewer: User | None) -> tuple[Vehicle, User]:
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    owner = await db.get(User, vehicle.user_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle, owner


async def _unset_other_primaries(db: AsyncSession, user_id: uuid.UUID, keep_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user_id, Vehicle.is_primary == True, Vehicle.id != keep_id)
    )
    for other in result.scalars().all():
        other.is_primary = False


def _apply_mod_items(vehicle: Vehicle, items: list[VehicleModItem] | None) -> None:
    normalized = _normalize_mod_items(items)
    vehicle.mod_items = normalized
    vehicle.mods = _mods_summary(normalized)


@router.get("/my", response_model=list[VehicleResponse])
async def my_garage(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.is_primary.desc(), Vehicle.created_at.desc())
    )
    return [await _vehicle_response(db, v) for v in result.scalars().all()]


@router.get("/user/{user_id}", response_model=list[VehicleResponse])
async def user_garage(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
):
    owner = await db.get(User, user_id)
    if not owner:
        raise HTTPException(status_code=404, detail="User not found")
    if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
        return []
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user_id).order_by(Vehicle.is_primary.desc())
    )
    return [await _vehicle_response(db, v) for v in result.scalars().all()]


@router.post("", response_model=VehicleResponse)
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    data = body.model_dump(exclude={"mod_items", "nickname"})
    vehicle = Vehicle(user_id=user.id, **data, nickname=_blank_to_none(body.nickname))
    if body.mod_items is not None:
        _apply_mod_items(vehicle, body.mod_items)
    db.add(vehicle)
    await db.flush()
    if vehicle.is_primary:
        await _unset_other_primaries(db, user.id, vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return await _vehicle_response(db, vehicle, with_shops=True)


@router.patch("/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: uuid.UUID,
    body: VehicleUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != user.id:
        raise HTTPException(status_code=404, detail="Vehicle not found")

    data = body.model_dump(exclude_unset=True)
    data.pop("mod_items", None)
    if "nickname" in data:
        data["nickname"] = _blank_to_none(data["nickname"])
    if "walkaround_url" in data:
        data["walkaround_url"] = _blank_to_none(data["walkaround_url"])
    if "sound_url" in data:
        data["sound_url"] = _blank_to_none(data["sound_url"])
    for field, value in data.items():
        setattr(vehicle, field, value)
    if "mod_items" in body.model_fields_set:
        _apply_mod_items(vehicle, body.mod_items)
    if data.get("is_primary"):
        await _unset_other_primaries(db, user.id, vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return await _vehicle_response(db, vehicle, with_shops=True)


@router.delete("/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle or vehicle.user_id != user.id:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    await db.delete(vehicle)
    await db.commit()
    return {"deleted": True}


@router.get("/search", response_model=list[VehicleDetailResponse])
async def search_vehicles(
    q: str = Query(min_length=1, max_length=80),
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
):
    term = f"%{q.strip()}%"
    result = await db.execute(
        select(Vehicle).where(
            or_(
                Vehicle.make.ilike(term),
                Vehicle.model.ilike(term),
                Vehicle.trim.ilike(term),
                Vehicle.nickname.ilike(term),
            )
        ).limit(40)
    )
    items: list[VehicleDetailResponse] = []
    for vehicle in result.scalars().all():
        owner = await db.get(User, vehicle.user_id)
        if not owner:
            continue
        if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
            continue
        items.append(await _detail(db, vehicle, owner, viewer))
        if len(items) >= 20:
            break
    return items


@router.get("/{vehicle_id}/posts", response_model=list[PostResponse])
async def get_vehicle_posts(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
    limit: int = Query(default=30, ge=1, le=50),
):
    await _visible_vehicle(db, vehicle_id, viewer)
    from app.routers.posts import _batch_post_responses

    result = await db.execute(
        select(Post).where(Post.vehicle_id == vehicle_id).order_by(Post.created_at.desc()).limit(limit)
    )
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, viewer.id if viewer else None)


@router.get("/{vehicle_id}/similar", response_model=list[VehicleDetailResponse])
async def similar_vehicles(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
):
    vehicle, _owner = await _visible_vehicle(db, vehicle_id, viewer)
    year_distance = func.abs(func.coalesce(Vehicle.year, vehicle.year or 0) - (vehicle.year or 0))
    result = await db.execute(
        select(Vehicle)
        .where(
            Vehicle.id != vehicle.id,
            func.lower(Vehicle.make) == vehicle.make.lower(),
            func.lower(Vehicle.model) == vehicle.model.lower(),
        )
        .order_by(year_distance, Vehicle.created_at.desc())
        .limit(24)
    )
    items: list[VehicleDetailResponse] = []
    for other in result.scalars().all():
        owner = await db.get(User, other.user_id)
        if not owner:
            continue
        if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
            continue
        items.append(await _detail(db, other, owner, viewer))
        if len(items) >= 8:
            break
    return items


@router.post("/{vehicle_id}/follow", response_model=VehicleFollowResponse)
async def follow_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle, owner = await _visible_vehicle(db, vehicle_id, user)
    if owner.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot follow your own vehicle")
    existing = await db.scalar(
        select(VehicleFollower).where(VehicleFollower.vehicle_id == vehicle.id, VehicleFollower.user_id == user.id)
    )
    if not existing:
        db.add(VehicleFollower(vehicle_id=vehicle.id, user_id=user.id))
        label = vehicle.nickname or f"{vehicle.make} {vehicle.model}"
        await create_notification(
            db,
            owner.id,
            user.id,
            "vehicle_follow",
            f"{user.full_name} started following {label}",
            body=user.full_name,
            link=f"/vehicles/{vehicle.id}",
        )
        await db.commit()
    count = await db.scalar(
        select(func.count()).select_from(VehicleFollower).where(VehicleFollower.vehicle_id == vehicle.id)
    )
    return VehicleFollowResponse(following=True, follower_count=int(count or 0))


@router.delete("/{vehicle_id}/follow", response_model=VehicleFollowResponse)
async def unfollow_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle, _owner = await _visible_vehicle(db, vehicle_id, user)
    existing = await db.scalar(
        select(VehicleFollower).where(VehicleFollower.vehicle_id == vehicle.id, VehicleFollower.user_id == user.id)
    )
    if existing:
        await db.delete(existing)
        await db.commit()
    count = await db.scalar(
        select(func.count()).select_from(VehicleFollower).where(VehicleFollower.vehicle_id == vehicle.id)
    )
    return VehicleFollowResponse(following=False, follower_count=int(count or 0))


@router.post("/{vehicle_id}/spot", response_model=VehicleSpotResponse)
async def spot_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle, owner = await _visible_vehicle(db, vehicle_id, user)
    if owner.id == user.id:
        raise HTTPException(status_code=400, detail="Cannot spot your own vehicle")
    existing = await db.scalar(
        select(VehicleSpot).where(VehicleSpot.vehicle_id == vehicle.id, VehicleSpot.user_id == user.id)
    )
    if not existing:
        db.add(VehicleSpot(vehicle_id=vehicle.id, user_id=user.id))
        label = vehicle.nickname or f"{vehicle.make} {vehicle.model}"
        await create_notification(
            db,
            owner.id,
            user.id,
            "vehicle_spot",
            f"{user.full_name} spotted {label}",
            body=user.full_name,
            link=f"/vehicles/{vehicle.id}",
        )
        await db.commit()
    count = await db.scalar(select(func.count()).select_from(VehicleSpot).where(VehicleSpot.vehicle_id == vehicle.id))
    return VehicleSpotResponse(spotted=True, spot_count=int(count or 0))


@router.get("/{vehicle_id}", response_model=VehicleDetailResponse)
async def get_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
):
    vehicle, owner = await _visible_vehicle(db, vehicle_id, viewer)
    return await _detail(db, vehicle, owner, viewer)
