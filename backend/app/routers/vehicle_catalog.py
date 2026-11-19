from fastapi import APIRouter, Depends, HTTPException, Request

from app.deps import get_user_model
from app.models import User
from app.schemas import VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogVariant, VehiclePlateLookup
from app.services import plate_lookup
from app.services import vehicle_catalog as catalog

router = APIRouter(prefix="/vehicle-catalog", tags=["vehicle-catalog"])


@router.get("/makes", response_model=list[VehicleCatalogMake])
async def get_makes():
    try:
        makes = await catalog.list_makes()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Vehicle catalog unavailable") from exc
    return [VehicleCatalogMake(id=m.id, name=m.name) for m in makes]


@router.get("/makes/{make_id}/models", response_model=list[VehicleCatalogModel])
async def get_models(make_id: str):
    try:
        models = await catalog.list_models(make_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Vehicle catalog unavailable") from exc
    return [VehicleCatalogModel(id=m.id, name=m.name, code=m.code) for m in models]


@router.get("/makes/{make_id}/models/{model_id}/variants", response_model=list[VehicleCatalogVariant])
async def get_variants(make_id: str, model_id: str):
    try:
        variants = await catalog.list_variants(make_id, model_id)
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Vehicle catalog unavailable") from exc
    return [
        VehicleCatalogVariant(
            id=v.id,
            trim=v.trim,
            engine=v.engine,
            fuel=v.fuel,
            engine_cc=v.engine_cc,
            horsepower=v.horsepower,
            year_from=v.year_from,
            year_to=v.year_to,
        )
        for v in variants
    ]


@router.get("/plate/{plate}", response_model=VehiclePlateLookup)
async def lookup_by_plate(plate: str, request: Request, user: User = Depends(get_user_model)):
    """Fill the add-vehicle form from the Ministry of Transport registry. The plate is not stored."""
    from app.rate_limit import enforce_rate_limit

    number = plate_lookup.normalize_plate(plate)
    if not number:
        raise HTTPException(status_code=400, detail="plate_invalid")
    await enforce_rate_limit(request, "vehicle:plate", identifier=str(user.id), limit=30, window_seconds=3600)
    try:
        found = await plate_lookup.lookup_plate(number)
    except plate_lookup.PlateLookupUnavailable as exc:
        raise HTTPException(status_code=503, detail="plate_lookup_unavailable") from exc
    if not found or not found.make or not found.model:
        raise HTTPException(status_code=404, detail="plate_not_found")
    return VehiclePlateLookup(**found.__dict__)
