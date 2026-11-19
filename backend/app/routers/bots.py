"""Content bots: the admin console's controls, and the scheduled tick (see app/services/bots.py)."""

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import require_admin
from app.models import ModerationAction, User
from app.services import bots

admin_router = APIRouter(prefix="/admin/bots", tags=["admin"])
internal_router = APIRouter(prefix="/internal", include_in_schema=False)

DELETE_CONFIRMATION = "מחק בוטים"
INTERNAL_TICK = "bot_tick"


class EnabledBody(BaseModel):
    enabled: bool


class TickBody(BaseModel):
    force: bool = False


class DeleteBody(BaseModel):
    confirm: str


def _log(db: AsyncSession, admin: User, action: str, reason: str | None = None) -> None:
    db.add(ModerationAction(actor_id=admin.id, action=action, target_type="bots", target_id="all", reason=reason))


@admin_router.get("")
async def get_bots(db: AsyncSession = Depends(get_db), _admin: User = Depends(require_admin)):
    status = await bots.bot_status(db)
    await db.commit()
    return status


@admin_router.put("/content")
async def upload_content(
    data: dict = Body(...), db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)
):
    try:
        summary = await bots.load_content(db, data)
    except bots.BotContentError as exc:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"bot_content_invalid: {exc}") from exc
    _log(db, admin, "bots_content", f"{summary['queued']} new, {summary['updated']} updated")
    await db.commit()
    return summary


@admin_router.patch("")
async def set_enabled(body: EnabledBody, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    await bots.set_enabled(db, body.enabled)
    _log(db, admin, "bots_enable" if body.enabled else "bots_pause")
    await db.commit()
    return {"enabled": body.enabled}


@admin_router.post("/tick")
async def tick_now(body: TickBody, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    return await bots.run_tick(db, force=body.force)


@admin_router.delete("")
async def delete_bots(body: DeleteBody, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    if body.confirm.strip() != DELETE_CONFIRMATION:
        raise HTTPException(status_code=400, detail="bot_delete_confirmation")
    summary = await bots.delete_all_bots(db)
    _log(db, admin, "bots_delete", f"{summary['bots']} bots")
    await db.commit()
    return summary


@internal_router.post("/bots/tick")
async def scheduled_tick(request: Request, db: AsyncSession = Depends(get_db)):
    """Only the scheduled Lambda invocation reaches this: handler.py turns an EventBridge event into this request and
    marks the event with a top-level key that an API Gateway request can never carry."""
    event = request.scope.get("aws.event") or {}
    if not isinstance(event, dict) or event.get("motorclub_internal") != INTERNAL_TICK:
        raise HTTPException(status_code=404, detail="Not Found")
    return await bots.run_tick(db)
