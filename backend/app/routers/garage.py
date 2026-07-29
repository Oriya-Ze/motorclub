import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Post, User, Vehicle
from app.schemas import VehicleCreate, VehicleResponse, VehicleUpdate

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


@router.get("/my", response_model=list[VehicleResponse])
async def my_garage(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(
        select(Vehicle).where(Vehicle.user_id == user.id).order_by(Vehicle.is_primary.desc(), Vehicle.created_at.desc())
    )
    return [_vehicle_response(v) for v in result.scalars().all()]


@router.get("/user/{user_id}", response_model=list[VehicleResponse])
async def user_garage(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
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
    if body.is_primary:
        existing = await db.execute(select(Vehicle).where(Vehicle.user_id == user.id, Vehicle.is_primary == True))
        for v in existing.scalars().all():
            v.is_primary = False

    vehicle = Vehicle(user_id=user.id, **body.model_dump())
    db.add(vehicle)
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

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(vehicle, field, value)
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


@router.get("/search", response_model=list[VehicleResponse])
async def search_vehicles(
    q: str,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    term = f"%{q.strip()}%"
    result = await db.execute(
        select(Vehicle).where(
            or_(Vehicle.make.ilike(term), Vehicle.model.ilike(term), Vehicle.trim.ilike(term))
        ).limit(20)
    )
    return [_vehicle_response(v) for v in result.scalars().all()]
