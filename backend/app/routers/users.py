import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import BusinessUpgradeRequest, Follower, Post, ProfileSettings, User
from app.schemas import ProfileUpdate, SettingsResponse, SettingsUpdate, UserPublic

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
    for field, value in body.model_dump(exclude_unset=True).items():
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


@router.post("/{user_id}/follow")
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
        await db.delete(existing)
        await db.commit()
        return {"following": False}

    db.add(Follower(follower_id=user.id, following_id=user_id))
    await db.commit()
    return {"following": True}


@router.get("/{user_id}/followers/count")
async def followers_count(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    count = await db.scalar(
        select(func.count()).select_from(Follower).where(Follower.following_id == user_id)
    )
    return {"count": count or 0}


@router.get("/{user_id}/following/count")
async def following_count(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    count = await db.scalar(
        select(func.count()).select_from(Follower).where(Follower.follower_id == user_id)
    )
    return {"count": count or 0}


@router.get("/{user_id}/follow/status")
async def follow_status(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if user_id == user.id:
        return {"following": False}

    existing = await db.scalar(
        select(Follower).where(Follower.follower_id == user.id, Follower.following_id == user_id)
    )
    return {"following": existing is not None}


@router.post("/me/business-upgrade")
async def request_business_upgrade(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if user.account_type == "business":
        return {"status": "already_business"}

    existing = await db.scalar(
        select(BusinessUpgradeRequest).where(
            BusinessUpgradeRequest.user_id == user.id,
            BusinessUpgradeRequest.status == "pending",
        )
    )
    if existing:
        return {"status": "pending"}

    db.add(BusinessUpgradeRequest(user_id=user.id))
    await db.commit()
    return {"status": "pending"}
