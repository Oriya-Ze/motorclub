import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import is_platform_admin, require_admin
from app.models import BusinessUpgradeRequest, User
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
async def admin_status(user: User = Depends(require_admin)):
    return {"is_admin": True}
