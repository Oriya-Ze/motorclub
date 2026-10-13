import uuid
from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Follower, ProfileSettings

FOLLOW_ACCEPTED = "accepted"


async def profile_is_public(db: AsyncSession, user_id: uuid.UUID) -> bool:
    settings = await db.scalar(select(ProfileSettings).where(ProfileSettings.user_id == user_id))
    if settings is None:
        return True
    return settings.profile_public


async def can_view_profile_content(
    db: AsyncSession,
    owner_id: uuid.UUID,
    viewer_id: uuid.UUID | None,
) -> bool:
    if viewer_id is not None and viewer_id == owner_id:
        return True
    if await profile_is_public(db, owner_id):
        return True
    if viewer_id is None:
        return False
    row = await db.scalar(
        select(Follower).where(
            Follower.follower_id == viewer_id,
            Follower.following_id == owner_id,
            Follower.status == FOLLOW_ACCEPTED,
        )
    )
    return row is not None


async def viewable_owner_ids(
    db: AsyncSession,
    owner_ids: Iterable[uuid.UUID],
    viewer_id: uuid.UUID | None,
) -> set[uuid.UUID]:
    """The owners whose profile content the viewer may see, checked for a whole list in two queries."""
    owners = set(owner_ids)
    if not owners:
        return set()
    private = set(
        await db.scalars(
            select(ProfileSettings.user_id).where(
                ProfileSettings.user_id.in_(owners), ProfileSettings.profile_public.is_not(True)
            )
        )
    )
    visible = owners - private
    if viewer_id is None:
        return visible
    if viewer_id in private:
        visible.add(viewer_id)
    followed = private - {viewer_id}
    if followed:
        visible |= set(
            await db.scalars(
                select(Follower.following_id).where(
                    Follower.follower_id == viewer_id,
                    Follower.following_id.in_(followed),
                    Follower.status == FOLLOW_ACCEPTED,
                )
            )
        )
    return visible
