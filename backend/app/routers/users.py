import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.business_types import is_valid_business_type
from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import BusinessUpgradeRequest, Follower, Post, ProfileSettings, User
from app.routers.social import create_notification
from app.schemas import (
    BusinessUpgradeRequestCreate,
    BusinessUpgradeRequestResponse,
    FollowRequestResponse,
    FollowStatusResponse,
    ProfileUpdate,
    SettingsResponse,
    SettingsUpdate,
    UserPublic,
)
from app.services.business_upgrade import get_latest_request, submit_business_upgrade_request

FOLLOW_ACCEPTED = "accepted"
FOLLOW_PENDING = "pending"


def _display_name(user: User) -> str:
    name = (user.full_name or user.username or "").strip()
    return name or "Someone"


def _follow_payload(row: Follower | None) -> dict[str, object]:
    if not row:
        return {"following": False, "status": "none"}
    return {"following": row.status == FOLLOW_ACCEPTED, "status": row.status}

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/search", response_model=list[UserPublic])
async def search_users(
    q: str = Query(min_length=1, max_length=100),
    limit: int = Query(default=20, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    pattern = f"%{q.strip()}%"
    result = await db.execute(
        select(User)
        .where(
            User.is_active.is_(True),
            or_(User.username.ilike(pattern), User.full_name.ilike(pattern)),
        )
        .order_by(User.full_name)
        .limit(limit)
    )
    return [user_to_public(u) for u in result.scalars().all()]


@router.get("/{user_id}", response_model=UserPublic)
async def get_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user_to_public(user)


@router.patch("/me", response_model=UserPublic)
async def update_profile(
    body: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    data = body.model_dump(exclude_unset=True)
    if "username" in data:
        if data["username"] != user.username:
            raise HTTPException(status_code=400, detail="Username cannot be changed")
        del data["username"]
    business_fields = {
        "business_type",
        "business_description",
        "business_phone",
        "business_address",
        "cover_image_url",
        "business_website",
        "business_registration_id",
        "business_hours",
        "gallery_urls",
        "certifications",
        "service_area",
    }
    if business_fields & data.keys() and user.account_type != "business":
        raise HTTPException(status_code=400, detail="Business profile fields require a business account")
    if "business_type" in data and data["business_type"] is not None and not is_valid_business_type(data["business_type"]):
        raise HTTPException(status_code=400, detail="Invalid business category")
    for field, value in data.items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user_to_public(user)


@router.get("/me/settings", response_model=SettingsResponse)
async def get_settings(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(select(ProfileSettings).where(ProfileSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ProfileSettings(user_id=user.id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return SettingsResponse.model_validate(settings)


@router.patch("/me/settings", response_model=SettingsResponse)
async def update_settings(
    body: SettingsUpdate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    result = await db.execute(select(ProfileSettings).where(ProfileSettings.user_id == user.id))
    settings = result.scalar_one_or_none()
    if not settings:
        settings = ProfileSettings(user_id=user.id)
        db.add(settings)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return SettingsResponse.model_validate(settings)


@router.get("/{user_id}/posts")
async def get_user_posts(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    result = await db.execute(
        select(Post).where(Post.user_id == user_id).order_by(Post.created_at.desc())
    )
    return [{"id": str(p.id), "content": p.content, "created_at": p.created_at.isoformat()} for p in result.scalars()]


@router.get("/me/follow-requests", response_model=list[FollowRequestResponse])
async def list_follow_requests(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    result = await db.execute(
        select(Follower)
        .where(Follower.following_id == user.id, Follower.status == FOLLOW_PENDING)
        .order_by(Follower.created_at.asc())
    )
    responses: list[FollowRequestResponse] = []
    for row in result.scalars().all():
        requester = await db.get(User, row.follower_id)
        if not requester:
            continue
        responses.append(
            FollowRequestResponse(
                user_id=row.follower_id,
                created_at=row.created_at,
                user=user_to_public(requester),
            )
        )
    return responses


@router.post("/me/follow-requests/{follower_id}/approve")
async def approve_follow_request(
    follower_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    row = await db.scalar(
        select(Follower).where(
            Follower.follower_id == follower_id,
            Follower.following_id == user.id,
            Follower.status == FOLLOW_PENDING,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Follow request not found")

    requester = await db.get(User, follower_id)
    row.status = FOLLOW_ACCEPTED
    if requester:
        await create_notification(
            db,
            follower_id,
            user.id,
            "follow_accepted",
            f"{_display_name(user)} accepted your follow request",
            body=_display_name(user),
            link=f"/users/{user.id}",
        )
    await db.commit()
    return {"status": FOLLOW_ACCEPTED}


@router.post("/me/follow-requests/{follower_id}/reject")
async def reject_follow_request(
    follower_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    row = await db.scalar(
        select(Follower).where(
            Follower.follower_id == follower_id,
            Follower.following_id == user.id,
            Follower.status == FOLLOW_PENDING,
        )
    )
    if not row:
        raise HTTPException(status_code=404, detail="Follow request not found")

    requester = await db.get(User, follower_id)
    await db.delete(row)
    if requester:
        await create_notification(
            db,
            follower_id,
            user.id,
            "follow_rejected",
            f"{_display_name(user)} declined your follow request",
            body=_display_name(user),
            link=f"/users/{user.id}",
        )
    await db.commit()
    return {"status": "rejected"}


@router.post("/{user_id}/follow", response_model=FollowStatusResponse)
async def follow_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.scalar(
        select(Follower).where(Follower.follower_id == user.id, Follower.following_id == user_id)
    )
    if existing:
        was_pending = existing.status == FOLLOW_PENDING
        await db.delete(existing)
        await db.commit()
        return FollowStatusResponse(following=False, status="cancelled" if was_pending else "none")

    db.add(Follower(follower_id=user.id, following_id=user_id, status=FOLLOW_PENDING))
    await create_notification(
        db,
        user_id,
        user.id,
        "follow_request",
        f"{_display_name(user)} wants to follow you",
        body=_display_name(user),
        link=f"/users/{user.id}",
    )
    await db.commit()
    return FollowStatusResponse(following=False, status=FOLLOW_PENDING)


@router.get("/{user_id}/followers/count")
async def followers_count(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    count = await db.scalar(
        select(func.count()).select_from(Follower).where(
            Follower.following_id == user_id, Follower.status == FOLLOW_ACCEPTED
        )
    )
    return {"count": count or 0}


@router.get("/{user_id}/following/count")
async def following_count(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    count = await db.scalar(
        select(func.count()).select_from(Follower).where(
            Follower.follower_id == user_id, Follower.status == FOLLOW_ACCEPTED
        )
    )
    return {"count": count or 0}


@router.get("/{user_id}/follow/status", response_model=FollowStatusResponse)
async def follow_status(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if user_id == user.id:
        return FollowStatusResponse(following=False, status="none")

    existing = await db.scalar(
        select(Follower).where(Follower.follower_id == user.id, Follower.following_id == user_id)
    )
    return FollowStatusResponse(**_follow_payload(existing))


@router.post("/me/business-upgrade", response_model=BusinessUpgradeRequestResponse)
async def request_business_upgrade(
    body: BusinessUpgradeRequestCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    req = await submit_business_upgrade_request(db, user, body)
    return BusinessUpgradeRequestResponse.model_validate(req)


@router.get("/me/business-upgrade", response_model=BusinessUpgradeRequestResponse | None)
async def get_my_business_upgrade(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    req = await get_latest_request(db, user.id)
    if not req:
        return None
    return BusinessUpgradeRequestResponse.model_validate(req)
