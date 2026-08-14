from fastapi import APIRouter, HTTPException

from app.schemas import VehicleCatalogMake, VehicleCatalogModel, VehicleCatalogVariant
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
