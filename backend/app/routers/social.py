import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Notification, Post, Story, User, Vehicle
from app.schemas import NotificationResponse, StoryCreate, StoryResponse

notifications_router = APIRouter(prefix="/notifications", tags=["notifications"])
stories_router = APIRouter(prefix="/stories", tags=["stories"])
explore_router = APIRouter(prefix="/explore", tags=["explore"])


@notifications_router.get("", response_model=list[NotificationResponse])
async def list_notifications(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)
    )
    return [NotificationResponse.model_validate(n) for n in result.scalars().all()]


@notifications_router.get("/unread-count")
async def unread_count(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    count = await db.scalar(
        select(func.count()).select_from(Notification).where(
            Notification.user_id == user.id, Notification.is_read == False
        )
    )
    return {"count": count or 0}


@notifications_router.post("/read-all")
async def mark_all_read(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(select(Notification).where(Notification.user_id == user.id, Notification.is_read == False))
    for n in result.scalars().all():
        n.is_read = True
    await db.commit()
    return {"ok": True}


@notifications_router.post("/{notification_id}/read")
async def mark_read(
    notification_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    n = await db.get(Notification, notification_id)
    if n and n.user_id == user.id:
        n.is_read = True
        await db.commit()
    return {"ok": True}


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    ntype: str,
    title: str,
    body: str | None = None,
    link: str | None = None,
) -> None:
    db.add(Notification(user_id=user_id, actor_id=actor_id, type=ntype, title=title, body=body, link=link))


@stories_router.get("", response_model=list[StoryResponse])
async def list_stories(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    now = datetime.now(UTC)
    result = await db.execute(
        select(Story, User)
        .join(User, Story.user_id == User.id)
        .where(Story.expires_at > now)
        .order_by(Story.created_at.desc())
    )
    seen_users: set[uuid.UUID] = set()
    stories = []
    for story, user in result.all():
        if user.id in seen_users:
            continue
        seen_users.add(user.id)
        stories.append(
            StoryResponse(
                id=story.id,
                user_id=story.user_id,
                media_url=story.media_url,
                media_type=story.media_type,
                caption=story.caption,
                expires_at=story.expires_at,
                created_at=story.created_at,
                author=user_to_public(user),
            )
        )
    return stories


@stories_router.post("", response_model=StoryResponse)
async def create_story(
    body: StoryCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    story = Story(
        user_id=user.id,
        media_url=body.media_url,
        media_type=body.media_type,
        caption=body.caption,
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    )
    db.add(story)
    await db.commit()
    await db.refresh(story)
    return StoryResponse(
        id=story.id,
        user_id=story.user_id,
        media_url=story.media_url,
        media_type=story.media_type,
        caption=story.caption,
        expires_at=story.expires_at,
        created_at=story.created_at,
        author=user_to_public(user),
    )


@explore_router.get("/posts")
async def explore_posts(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Post).where(Post.image_urls != None).order_by(Post.created_at.desc()).limit(30)
    )
    posts = result.scalars().all()
    items = []
    for p in posts:
        author = await db.get(User, p.user_id)
        thumb = p.image_urls[0] if p.image_urls else None
        items.append({
            "id": str(p.id),
            "thumbnail": thumb,
            "content": p.content,
            "author": user_to_public(author) if author else None,
        })
    return items


@explore_router.get("/hashtags")
async def trending_hashtags(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Post.hashtags).where(Post.hashtags != None).limit(100))
    counts: dict[str, int] = {}
    for (tags,) in result.all():
        if tags:
            for tag in tags:
                counts[tag] = counts.get(tag, 0) + 1
    sorted_tags = sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20]
    return [{"tag": t, "count": c} for t, c in sorted_tags]


@explore_router.get("/vehicles")
async def explore_vehicles(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(Vehicle).where(Vehicle.image_urls != None).order_by(Vehicle.created_at.desc()).limit(20)
    )
    vehicles = result.scalars().all()
    items = []
    for v in vehicles:
        owner = await db.get(User, v.user_id)
        items.append({
            "id": str(v.id),
            "make": v.make,
            "model": v.model,
            "year": v.year,
            "thumbnail": v.image_urls[0] if v.image_urls else None,
            "owner": user_to_public(owner) if owner else None,
        })
    return items
