import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import is_platform_admin, require_admin, require_staff
from app.models import BusinessUpgradeRequest, ContentReport, MediaScan, ModerationAction, Post, Product, User
from app.schemas import (
    BusinessUpgradeApproveBody,
    BusinessUpgradeRejectBody,
    BusinessUpgradeRequestAdminResponse,
)
from app.services.business_upgrade import approve_business_upgrade_request, reject_business_upgrade_request

router = APIRouter(prefix="/admin", tags=["admin"])


def _to_admin_response(req: BusinessUpgradeRequest, applicant: User) -> BusinessUpgradeRequestAdminResponse:
    return BusinessUpgradeRequestAdminResponse(
        id=req.id,
        user_id=req.user_id,
        status=req.status,
        business_name=req.business_name,
        business_type=req.business_type,
        business_description=req.business_description,
        business_phone=req.business_phone,
        business_address=req.business_address,
        business_registration_id=req.business_registration_id,
        business_website=req.business_website,
        contact_full_name=req.contact_full_name,
        contact_phone=req.contact_phone,
        additional_notes=req.additional_notes,
        rejection_reason=req.rejection_reason,
        created_at=req.created_at,
        reviewed_at=req.reviewed_at,
        applicant_email=applicant.email,
        applicant_username=applicant.username,
        admin_notes=req.admin_notes,
    )


@router.get("/business-upgrade-requests", response_model=list[BusinessUpgradeRequestAdminResponse])
async def list_business_upgrade_requests(
    status: str | None = Query(default="pending"),
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(require_admin),
):
    query = select(BusinessUpgradeRequest).order_by(BusinessUpgradeRequest.created_at.desc())
    if status:
        query = query.where(BusinessUpgradeRequest.status == status)
    result = await db.execute(query.limit(100))
    requests = result.scalars().all()
    responses = []
    for req in requests:
        applicant = await db.get(User, req.user_id)
        if applicant:
            responses.append(_to_admin_response(req, applicant))
    return responses


@router.post("/business-upgrade-requests/{request_id}/approve", response_model=BusinessUpgradeRequestAdminResponse)
async def approve_request(
    request_id: uuid.UUID,
    body: BusinessUpgradeApproveBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = await approve_business_upgrade_request(db, request_id, admin, body.admin_notes)
    applicant = await db.get(User, req.user_id)
    return _to_admin_response(req, applicant)


@router.post("/business-upgrade-requests/{request_id}/reject", response_model=BusinessUpgradeRequestAdminResponse)
async def reject_request(
    request_id: uuid.UUID,
    body: BusinessUpgradeRejectBody,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    req = await reject_business_upgrade_request(
        db, request_id, admin, body.rejection_reason, body.admin_notes
    )
    applicant = await db.get(User, req.user_id)
    return _to_admin_response(req, applicant)


@router.get("/me")
async def admin_status(user: User = Depends(require_staff)):
    return {"is_admin": is_platform_admin(user), "is_moderator": bool(user.is_moderator)}


@router.get("/overview")
async def overview(
    db: AsyncSession = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    from datetime import UTC, datetime, timedelta

    since = datetime.now(UTC) - timedelta(days=7)
    open_reports = await db.scalar(
        select(func.count()).select_from(ContentReport).where(ContentReport.status.in_(["new", "reviewing"]))
    )
    pending_products = await db.scalar(
        select(func.count()).select_from(Product).where(Product.listing_status == "pending_review")
    )
    scan_errors = await db.scalar(
        select(func.count()).select_from(MediaScan).where(MediaScan.decision == "error", MediaScan.created_at >= since)
    )
    new_reports = await db.scalar(
        select(func.count()).select_from(ContentReport).where(ContentReport.created_at >= since)
    )
    return {
        "period_days": 7,
        "open_reports": int(open_reports or 0),
        "pending_products": int(pending_products or 0),
        "scan_errors": int(scan_errors or 0),
        "new_reports": int(new_reports or 0),
    }


@router.get("/reports")
async def list_reports(
    status: str | None = None,
    q: str | None = None,
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    filters = []
    if status:
        filters.append(ContentReport.status == status)
    if q and q.strip():
        filters.append(ContentReport.reason.ilike(f"%{q.strip()}%"))
    base = select(ContentReport)
    if filters:
        base = base.where(*filters)
    total = await db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = (
        await db.execute(base.order_by(ContentReport.created_at.desc()).offset(max(skip, 0)).limit(min(limit, 50)))
    ).scalars().all()
    grouped: dict[tuple[str, str], dict] = {}
    for row in rows:
        key = (row.target_type, str(row.target_id))
        bucket = grouped.setdefault(
            key,
            {
                "target_type": row.target_type,
                "target_id": str(row.target_id),
                "count": 0,
                "reasons": [],
                "latest": row.created_at.isoformat(),
                "status": row.status,
                "reports": [],
            },
        )
        bucket["count"] += 1
        if row.reason not in bucket["reasons"]:
            bucket["reasons"].append(row.reason)
        bucket["reports"].append(
            {
                "id": str(row.id),
                "reason": row.reason,
                "details": row.details,
                "status": row.status,
                "created_at": row.created_at.isoformat(),
            }
        )
    return {"items": list(grouped.values()), "total": int(total)}


@router.post("/reports/{report_id}")
async def update_report(
    report_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    report = await db.get(ContentReport, report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    status = str(body.get("status") or "")
    if status not in {"new", "reviewing", "resolved", "dismissed"}:
        raise HTTPException(status_code=400, detail="Invalid status")
    reason = str(body.get("reason") or "").strip()
    if status in {"resolved", "dismissed"} and not reason:
        raise HTTPException(status_code=400, detail="A reason is required")
    report.status = status
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action=f"report_{status}",
            target_type=report.target_type,
            target_id=str(report.target_id),
            reason=reason or None,
        )
    )
    await db.commit()
    return {"id": str(report.id), "status": report.status}


@router.post("/products/{product_id}/visibility")
async def set_product_visibility(
    product_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    hidden = bool(body.get("hidden"))
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required")
    from app.services.media_gate import restore_public_image, takedown_public_image

    product.listing_status = "hidden" if hidden else "published"
    for key in product.image_urls or []:
        if hidden:
            takedown_public_image(key)
        else:
            restore_public_image(key)
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action="hide_product" if hidden else "restore_product",
            target_type="product",
            target_id=str(product.id),
            reason=reason,
        )
    )
    await db.commit()
    return {"id": str(product.id), "listing_status": product.listing_status}


@router.get("/media-scans")
async def list_media_scans(
    decision: str = "needs_review",
    db: AsyncSession = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    rows = (
        await db.execute(
            select(MediaScan).where(MediaScan.decision == decision).order_by(MediaScan.created_at.desc()).limit(50)
        )
    ).scalars().all()
    return [
        {
            "id": str(row.id),
            "storage_key": row.storage_key,
            "decision": row.decision,
            "labels": row.labels or [],
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/media-scans/{scan_id}")
async def review_media_scan(
    scan_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    from app.services.media_gate import promote_private_image

    scan = await db.get(MediaScan, scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan not found")
    decision = str(body.get("decision") or "")
    reason = str(body.get("reason") or "").strip()
    if decision not in {"approved", "rejected"} or not reason:
        raise HTTPException(status_code=400, detail="Decision and reason are required")
    if decision == "approved":
        promote_private_image(scan.storage_key)
    else:
        from app.services.media_gate import takedown_public_image

        takedown_public_image(scan.storage_key)
    scan.decision = decision
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action=f"image_{decision}",
            target_type="media",
            target_id=str(scan.id),
            reason=reason,
        )
    )
    await db.commit()
    return {"id": str(scan.id), "decision": scan.decision}


@router.post("/media-scans-retry")
async def retry_stuck_scans(
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    from app.services.image_moderation import content_hash, scan_bytes
    from app.services.media_gate import promote_private_image, read_media_bytes

    rows = (
        await db.execute(select(MediaScan).where(MediaScan.decision.in_(["error", "pending"])).limit(20))
    ).scalars().all()
    updated = 0
    for scan in rows:
        try:
            data = read_media_bytes(scan.storage_key)
        except HTTPException:
            continue
        decision = scan_bytes(data)
        scan.decision = decision.decision
        scan.labels = decision.labels
        scan.error_message = decision.error_message
        scan.content_hash = content_hash(data)
        if decision.decision == "approved":
            promote_private_image(scan.storage_key)
        updated += 1
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action="retry_scans",
            target_type="media",
            target_id="queue",
            reason=f"retried {updated}",
        )
    )
    await db.commit()
    return {"updated": updated}


@router.get("/users")
async def search_users(
    q: str = "",
    db: AsyncSession = Depends(get_db),
    _staff: User = Depends(require_staff),
):
    term = f"%{q.strip()}%"
    query = select(User).order_by(User.created_at.desc()).limit(20)
    if q.strip():
        query = select(User).where(or_(User.email.ilike(term), User.username.ilike(term), User.full_name.ilike(term))).limit(20)
    rows = (await db.execute(query)).scalars().all()
    return [
        {
            "id": str(row.id),
            "username": row.username,
            "full_name": row.full_name,
            "account_type": row.account_type,
            "is_moderator": row.is_moderator,
            "suspended_until": row.suspended_until.isoformat() if row.suspended_until else None,
            "business_hidden": row.business_hidden,
        }
        for row in rows
    ]


@router.post("/users/{user_id}/suspension")
async def set_suspension(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    from datetime import UTC, datetime, timedelta

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required")
    days = body.get("days")
    if days in (None, 0, "0"):
        target.suspended_until = None
        action = "unsuspend_user"
    else:
        target.suspended_until = datetime.now(UTC) + timedelta(days=int(days))
        action = "suspend_user"
    db.add(ModerationAction(actor_id=staff.id, action=action, target_type="profile", target_id=str(target.id), reason=reason))
    await db.commit()
    return {"id": str(target.id), "suspended_until": target.suspended_until.isoformat() if target.suspended_until else None}


@router.post("/posts/{post_id}/visibility")
async def set_post_visibility(
    post_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    from datetime import UTC, datetime

    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required")
    hidden = bool(body.get("hidden"))
    post.hidden_at = datetime.now(UTC) if hidden else None
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action="hide_post" if hidden else "restore_post",
            target_type="post",
            target_id=str(post.id),
            reason=reason,
        )
    )
    await db.commit()
    return {"id": str(post.id), "hidden": hidden}


@router.post("/businesses/{user_id}/visibility")
async def set_business_visibility(
    user_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    staff: User = Depends(require_staff),
):
    target = await db.get(User, user_id)
    if not target or target.account_type != "business":
        raise HTTPException(status_code=404, detail="Business not found")
    reason = str(body.get("reason") or "").strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required")
    hidden = bool(body.get("hidden"))
    target.business_hidden = hidden
    db.add(
        ModerationAction(
            actor_id=staff.id,
            action="hide_business" if hidden else "restore_business",
            target_type="profile",
            target_id=str(target.id),
            reason=reason,
        )
    )
    await db.commit()
    return {"id": str(target.id), "business_hidden": hidden}
