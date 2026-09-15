import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_optional_user_model, get_user_model, user_to_public
from app.models import Post, User, Vehicle
from app.schemas import PostResponse, VehicleCreate, VehicleDetailResponse, VehicleResponse, VehicleUpdate
from app.services.visibility import can_view_profile_content

router = APIRouter(prefix="/garage", tags=["garage"])


def _vehicle_response(v: Vehicle) -> VehicleResponse:
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
        mods=v.mods,
        image_urls=v.image_urls,
        is_primary=v.is_primary,
        created_at=v.created_at,
    )


def _detail(vehicle: Vehicle, owner: User) -> VehicleDetailResponse:
    return VehicleDetailResponse(**_vehicle_response(vehicle).model_dump(), owner=user_to_public(owner))


async def _unset_other_primaries(db: AsyncSession, user_id: uuid.UUID, keep_id: uuid.UUID) -> None:
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user_id, Vehicle.is_primary == True, Vehicle.id != keep_id)
    )
    for other in result.scalars().all():
        other.is_primary = False


@router.get("/my", response_model=list[VehicleResponse])
async def my_garage(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.is_primary.desc(), Vehicle.created_at.desc())
    )
    return [_vehicle_response(v) for v in result.scalars().all()]


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
    return [_vehicle_response(v) for v in result.scalars().all()]


@router.post("", response_model=VehicleResponse)
async def create_vehicle(
    body: VehicleCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    vehicle = Vehicle(user_id=user.id, **body.model_dump())
    db.add(vehicle)
    await db.flush()
    if vehicle.is_primary:
        await _unset_other_primaries(db, user.id, vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return _vehicle_response(vehicle)


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
    for field, value in data.items():
        setattr(vehicle, field, value)
    if data.get("is_primary"):
        await _unset_other_primaries(db, user.id, vehicle.id)
    await db.commit()
    await db.refresh(vehicle)
    return _vehicle_response(vehicle)


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
            or_(Vehicle.make.ilike(term), Vehicle.model.ilike(term), Vehicle.trim.ilike(term))
        ).limit(40)
    )
    items: list[VehicleDetailResponse] = []
    for vehicle in result.scalars().all():
        owner = await db.get(User, vehicle.user_id)
        if not owner:
            continue
        if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
            continue
        items.append(_detail(vehicle, owner))
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
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if not await can_view_profile_content(db, vehicle.user_id, viewer.id if viewer else None):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    from app.routers.posts import _batch_post_responses

    result = await db.execute(
        select(Post).where(Post.vehicle_id == vehicle_id).order_by(Post.created_at.desc()).limit(limit)
    )
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, viewer.id if viewer else None)


@router.get("/{vehicle_id}", response_model=VehicleDetailResponse)
async def get_vehicle(
    vehicle_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user_model),
):
    vehicle = await db.get(Vehicle, vehicle_id)
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    owner = await db.get(User, vehicle.user_id)
    if not owner:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    if not await can_view_profile_content(db, owner.id, viewer.id if viewer else None):
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return _detail(vehicle, owner)
