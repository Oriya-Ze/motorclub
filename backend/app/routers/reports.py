import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_user_model
from app.models import ContentReport, HiddenPost, Post, Product, User, Vehicle

router = APIRouter(prefix="/reports", tags=["reports"])

REASONS = frozenset({"spam", "harassment", "sexual_or_violence", "impersonation", "fraud", "irrelevant"})
# A vehicle card is reported for what it says, not for conduct: wrong details, or something that is not a vehicle.
VEHICLE_REASONS = frozenset({"wrong_info", "irrelevant"})
TARGET_TYPES = frozenset({"post", "profile", "product", "story", "vehicle"})
OPEN_STATUSES = frozenset({"new", "reviewing"})


class ReportCreate(BaseModel):
    target_type: str
    target_id: uuid.UUID
    reason: str
    details: str | None = Field(default=None, max_length=2000)
    # For a post: also stop showing it in the reporter's own feed.
    hide_post: bool = False


@router.get("/mine")
async def my_report(
    target_type: str,
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    """Whether this member already reported this item, so the dialog says so instead of asking again."""
    report = await db.scalar(
        select(ContentReport)
        .where(
            ContentReport.reporter_id == user.id,
            ContentReport.target_type == target_type,
            ContentReport.target_id == target_id,
        )
        .order_by(ContentReport.created_at.desc())
        .limit(1)
    )
    hidden = False
    if target_type == "post":
        hidden = bool(
            await db.scalar(select(HiddenPost.id).where(HiddenPost.user_id == user.id, HiddenPost.post_id == target_id))
        )
    if report is None:
        return {"reported": False, "hidden": hidden}
    return {"reported": True, "status": report.status, "created_at": report.created_at.isoformat(), "hidden": hidden}


@router.post("")
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if body.target_type not in TARGET_TYPES:
        raise HTTPException(status_code=400, detail="Invalid target")
    if body.reason not in (VEHICLE_REASONS if body.target_type == "vehicle" else REASONS):
        raise HTTPException(status_code=400, detail="Invalid reason")
    await _assert_target(db, body.target_type, body.target_id)
    hour_ago = datetime.now(UTC) - timedelta(hours=1)
    recent = await db.scalar(
        select(func.count()).select_from(ContentReport).where(
            ContentReport.reporter_id == user.id,
            ContentReport.created_at >= hour_ago,
        )
    )
    if (recent or 0) >= 10:
        raise HTTPException(status_code=429, detail="Too many reports")
    if body.hide_post and body.target_type == "post":
        hidden = await db.scalar(
            select(HiddenPost.id).where(HiddenPost.user_id == user.id, HiddenPost.post_id == body.target_id)
        )
        if not hidden:
            db.add(HiddenPost(user_id=user.id, post_id=body.target_id))
            await db.flush()
    existing = await db.scalar(
        select(ContentReport).where(
            ContentReport.reporter_id == user.id,
            ContentReport.target_type == body.target_type,
            ContentReport.target_id == body.target_id,
            ContentReport.status.in_(OPEN_STATUSES),
        )
    )
    if existing:
        await db.commit()  # the hide still applies to a repeated report
        return {"id": str(existing.id), "status": existing.status, "duplicate": True}
    report = ContentReport(
        reporter_id=user.id,
        target_type=body.target_type,
        target_id=body.target_id,
        reason=body.reason,
        details=(body.details or "").strip() or None,
        status="new",
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    return {"id": str(report.id), "status": report.status, "duplicate": False}


async def _assert_target(db: AsyncSession, target_type: str, target_id: uuid.UUID) -> None:
    if target_type == "post":
        found = await db.get(Post, target_id)
    elif target_type == "product":
        found = await db.get(Product, target_id)
    elif target_type == "vehicle":
        found = await db.get(Vehicle, target_id)
    elif target_type == "story":
        from app.models import Story

        found = await db.get(Story, target_id)
    else:
        found = await db.get(User, target_id)
    if not found:
        raise HTTPException(status_code=404, detail="Target not found")
