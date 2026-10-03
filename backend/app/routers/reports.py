import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_user_model
from app.models import ContentReport, Post, Product, User

router = APIRouter(prefix="/reports", tags=["reports"])

REASONS = frozenset({"spam", "harassment", "sexual_or_violence", "impersonation", "fraud", "irrelevant"})
OPEN_STATUSES = frozenset({"new", "reviewing"})


class ReportCreate(BaseModel):
    target_type: str
    target_id: uuid.UUID
    reason: str
    details: str | None = Field(default=None, max_length=2000)


@router.post("")
async def create_report(
    body: ReportCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if body.target_type not in {"post", "profile", "product", "story"}:
        raise HTTPException(status_code=400, detail="Invalid target")
    if body.reason not in REASONS:
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
    existing = await db.scalar(
        select(ContentReport).where(
            ContentReport.reporter_id == user.id,
            ContentReport.target_type == body.target_type,
            ContentReport.target_id == body.target_id,
            ContentReport.status.in_(OPEN_STATUSES),
        )
    )
    if existing:
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
    elif target_type == "story":
        from app.models import Story

        found = await db.get(Story, target_id)
    else:
        found = await db.get(User, target_id)
    if not found:
        raise HTTPException(status_code=404, detail="Target not found")
