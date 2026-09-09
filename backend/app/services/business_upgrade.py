"""Business account upgrade request workflow."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_types import is_valid_business_type
from app.config import settings
from app.deps import is_platform_admin
from app.models import BusinessUpgradeRequest, User
from app.routers.social import create_notification
from app.schemas import BusinessUpgradeRequestCreate


def _request_to_dict(req: BusinessUpgradeRequest) -> dict:
    return {
        "id": req.id,
        "user_id": req.user_id,
        "status": req.status,
        "business_name": req.business_name,
        "business_type": req.business_type,
        "business_description": req.business_description,
        "business_phone": req.business_phone,
        "business_address": req.business_address,
        "business_registration_id": req.business_registration_id,
        "business_website": req.business_website,
        "contact_full_name": req.contact_full_name,
        "contact_phone": req.contact_phone,
        "additional_notes": req.additional_notes,
        "rejection_reason": req.rejection_reason,
        "created_at": req.created_at,
        "reviewed_at": req.reviewed_at,
    }


async def get_latest_request(db: AsyncSession, user_id: uuid.UUID) -> BusinessUpgradeRequest | None:
    result = await db.execute(
        select(BusinessUpgradeRequest)
        .where(BusinessUpgradeRequest.user_id == user_id)
        .order_by(BusinessUpgradeRequest.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def submit_business_upgrade_request(
    db: AsyncSession,
    user: User,
    body: BusinessUpgradeRequestCreate,
) -> BusinessUpgradeRequest:
    if user.account_type == "business":
        raise HTTPException(status_code=400, detail="Account is already a business account")

    if not is_valid_business_type(body.business_type):
        raise HTTPException(status_code=400, detail="Invalid business category")

    existing = await db.scalar(
        select(BusinessUpgradeRequest).where(
            BusinessUpgradeRequest.user_id == user.id,
            BusinessUpgradeRequest.status == "pending",
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="A business upgrade request is already pending review")

    req = BusinessUpgradeRequest(
        user_id=user.id,
        status="pending",
        business_name=body.business_name.strip(),
        business_type=body.business_type,
        business_description=body.business_description.strip(),
        business_phone=body.business_phone.strip(),
        business_address=body.business_address.strip(),
        business_registration_id=body.business_registration_id.strip() if body.business_registration_id else None,
        business_website=body.business_website.strip() if body.business_website else None,
        contact_full_name=body.contact_full_name.strip(),
        contact_phone=body.contact_phone.strip(),
        additional_notes=body.additional_notes.strip() if body.additional_notes else None,
    )
    db.add(req)
    await db.flush()

    await _notify_admins_new_request(db, user, req)
    await create_notification(
        db,
        user_id=user.id,
        actor_id=None,
        ntype="business_upgrade_submitted",
        title="בקשת שדרוג נשלחה",
        body="הבקשה שלך לחשבון עסקי נשלחה לבדיקה. נעדכן אותך לאחר האישור.",
        link="/settings",
    )
    await db.commit()
    await db.refresh(req)
    return req


async def _notify_admins_new_request(
    db: AsyncSession,
    applicant: User,
    req: BusinessUpgradeRequest,
) -> None:
    result = await db.execute(select(User).where(User.is_active.is_(True)))
    admins = [u for u in result.scalars().all() if is_platform_admin(u)]
    if not admins and settings.admin_email_list:
        result = await db.execute(
            select(User).where(User.email.in_(settings.admin_email_list), User.is_active.is_(True))
        )
        admins = list(result.scalars().all())

    title = "בקשה חדשה לחשבון עסקי"
    body = f"{applicant.full_name} ({applicant.email}) — {req.business_name}"
    for admin in admins:
        await create_notification(
            db,
            user_id=admin.id,
            actor_id=applicant.id,
            ntype="business_upgrade_pending",
            title=title,
            body=body,
            link="/admin/business-requests",
        )


async def approve_business_upgrade_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    admin: User,
    admin_notes: str | None = None,
) -> BusinessUpgradeRequest:
    req = await db.get(BusinessUpgradeRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    applicant = await db.get(User, req.user_id)
    if not applicant:
        raise HTTPException(status_code=404, detail="Applicant not found")

    applicant.account_type = "business"
    applicant.full_name = req.business_name or applicant.full_name
    applicant.business_type = req.business_type
    applicant.business_description = req.business_description
    applicant.business_phone = req.business_phone
    applicant.business_address = req.business_address
    applicant.business_website = req.business_website
    applicant.business_registration_id = req.business_registration_id
    applicant.is_verified = True

    req.status = "approved"
    req.reviewed_by_id = admin.id
    req.reviewed_at = datetime.now(UTC)
    req.admin_notes = admin_notes.strip() if admin_notes else None
    req.rejection_reason = None

    await create_notification(
        db,
        user_id=applicant.id,
        actor_id=admin.id,
        ntype="business_upgrade_approved",
        title="החשבון העסקי אושר!",
        body="הבקשה שלך אושרה. כעת תוכל לפרסם שירותים ומוצרים.",
        link="/settings",
    )
    await db.commit()
    await db.refresh(req)
    return req


async def reject_business_upgrade_request(
    db: AsyncSession,
    request_id: uuid.UUID,
    admin: User,
    rejection_reason: str,
    admin_notes: str | None = None,
) -> BusinessUpgradeRequest:
    req = await db.get(BusinessUpgradeRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=400, detail="Request is not pending")

    req.status = "rejected"
    req.reviewed_by_id = admin.id
    req.reviewed_at = datetime.now(UTC)
    req.rejection_reason = rejection_reason.strip()
    req.admin_notes = admin_notes.strip() if admin_notes else None

    await create_notification(
        db,
        user_id=req.user_id,
        actor_id=admin.id,
        ntype="business_upgrade_rejected",
        title="בקשת החשבון העסקי נדחתה",
        body=rejection_reason.strip(),
        link="/settings",
    )
    await db.commit()
    await db.refresh(req)
    return req
