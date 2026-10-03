import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Comment, Post, PostLike, SavedPost, User, Vehicle, VehicleFollower
from app.routers.social import create_notification
from app.media.image_assets import build_image_media_map
from app.media.video_assets import build_video_media_map
from app.schemas import CommentCreate, CommentResponse, PostCreate, PostResponse

router = APIRouter(prefix="/posts", tags=["posts"])

HASHTAG_RE = re.compile(r"#(\w+)")


def _unavailable_if_hidden(post: Post, viewer_id: uuid.UUID) -> None:
    if post.hidden_at is not None and post.user_id != viewer_id:
        raise HTTPException(status_code=404, detail="content_unavailable")


def _owner_moderation(post: Post, viewer_id: uuid.UUID | None) -> dict:
    if viewer_id != post.user_id:
        return {}
    return {
        "moderation_status": post.moderation_status,
        "media_version": post.media_version,
        "moderation_blocks": post.moderation_blocks,
    }


def _visible_image_keys(post: Post, viewer_id: uuid.UUID | None) -> list[str]:
    """Image keys a viewer can load. A key still on the private path never renders for others,
    so it is left out instead of showing an empty frame. The owner keeps every key."""
    keys = [key for key in (post.image_urls or []) if key]
    if viewer_id == post.user_id:
        return keys
    from app.media.keys import is_private_storage_key

    return [key for key in keys if not is_private_storage_key(key)]


def _extract_hashtags(content: str | None) -> list[str]:
    if not content:
        return []
    return list({m.group(1).lower() for m in HASHTAG_RE.finditer(content)})


async def _batch_post_responses(
    db: AsyncSession,
    posts: list[Post],
    current_user_id: uuid.UUID | None,
) -> list[PostResponse]:
    if not posts:
        return []

    post_ids = [p.id for p in posts]
    user_ids = list({p.user_id for p in posts})

    likes_result = await db.execute(
        select(PostLike.post_id, func.count())
        .where(PostLike.post_id.in_(post_ids))
        .group_by(PostLike.post_id)
    )
    likes_map = dict(likes_result.all())

    comments_result = await db.execute(
        select(Comment.post_id, func.count())
        .where(Comment.post_id.in_(post_ids))
        .group_by(Comment.post_id)
    )
    comments_map = dict(comments_result.all())

    liked_ids: set[uuid.UUID] = set()
    saved_ids: set[uuid.UUID] = set()
    if current_user_id:
        liked_result = await db.execute(
            select(PostLike.post_id).where(
                PostLike.post_id.in_(post_ids),
                PostLike.user_id == current_user_id,
            )
        )
        liked_ids = set(liked_result.scalars().all())
        saved_result = await db.execute(
            select(SavedPost.post_id).where(
                SavedPost.post_id.in_(post_ids),
                SavedPost.user_id == current_user_id,
            )
        )
        saved_ids = set(saved_result.scalars().all())

    users_result = await db.execute(select(User).where(User.id.in_(user_ids)))
    users_map = {u.id: u for u in users_result.scalars().all()}

    all_video_keys: list[str] = []
    all_image_keys: list[str] = []
    visible_images = {post.id: _visible_image_keys(post, current_user_id) for post in posts}
    for post in posts:
        if post.video_urls:
            all_video_keys.extend([key for key in post.video_urls if key])
        all_image_keys.extend(visible_images[post.id])
    video_media_map = await build_video_media_map(db, list(dict.fromkeys(all_video_keys)))
    image_media_map = await build_image_media_map(db, list(dict.fromkeys(all_image_keys)))

    responses: list[PostResponse] = []
    for post in posts:
        author = users_map.get(post.user_id)
        if not author:
            continue
        image_keys = visible_images[post.id]
        if post.user_id != current_user_id and not image_keys and not post.video_urls and not (post.content or "").strip():
            continue
        video_media = None
        image_media = None
        if post.video_urls:
            video_media = [video_media_map[key] for key in post.video_urls if key in video_media_map]
        if image_keys:
            image_media = [image_media_map[key] for key in image_keys if key in image_media_map]
        responses.append(
            PostResponse(
                id=post.id,
                user_id=post.user_id,
                content=post.content,
                image_urls=image_keys or None,
                video_urls=post.video_urls,
                video_media=video_media,
                image_media=image_media,
                location=post.location,
                vehicle_id=post.vehicle_id,
                hashtags=post.hashtags,
                created_at=post.created_at,
                author=user_to_public(author),
                likes_count=likes_map.get(post.id, 0),
                comments_count=comments_map.get(post.id, 0),
                is_liked=post.id in liked_ids,
                is_saved=post.id in saved_ids,
                **_owner_moderation(post, current_user_id),
            )
        )
    return responses


async def _post_to_response(db: AsyncSession, post: Post, current_user_id: uuid.UUID | None) -> PostResponse:
    likes_count = await db.scalar(
        select(func.count()).select_from(PostLike).where(PostLike.post_id == post.id)
    )
    comments_count = await db.scalar(
        select(func.count()).select_from(Comment).where(Comment.post_id == post.id)
    )
    is_liked = False
    is_saved = False
    if current_user_id:
        liked = await db.scalar(
            select(PostLike).where(PostLike.post_id == post.id, PostLike.user_id == current_user_id)
        )
        is_liked = liked is not None
        saved = await db.scalar(
            select(SavedPost).where(SavedPost.post_id == post.id, SavedPost.user_id == current_user_id)
        )
        is_saved = saved is not None

    author = await db.get(User, post.user_id)
    video_media = None
    image_media = None
    if post.video_urls:
        video_media_map = await build_video_media_map(db, [key for key in post.video_urls if key])
        video_media = [video_media_map[key] for key in post.video_urls if key in video_media_map]
    image_keys = _visible_image_keys(post, current_user_id)
    if image_keys:
        image_media_map = await build_image_media_map(db, image_keys)
        image_media = [image_media_map[key] for key in image_keys if key in image_media_map]
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        content=post.content,
        image_urls=image_keys or None,
        video_urls=post.video_urls,
        video_media=video_media,
        image_media=image_media,
        location=post.location,
        vehicle_id=post.vehicle_id,
        hashtags=post.hashtags,
        created_at=post.created_at,
        author=user_to_public(author),
        likes_count=likes_count or 0,
        comments_count=comments_count or 0,
        is_liked=is_liked,
        is_saved=is_saved,
        **_owner_moderation(post, current_user_id),
    )


@router.get("", response_model=list[PostResponse])
async def list_posts(
    skip: int = 0,
    limit: int = 20,
    hashtag: str | None = None,
    user_id: uuid.UUID | None = None,
    vehicle_id: uuid.UUID | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    own_profile = user_id is not None and user_id == current_user.id
    from app.services.post_moderation import publicly_visible

    query = select(Post).order_by(Post.created_at.desc())
    if not own_profile:
        query = query.where(publicly_visible())
    if hashtag:
        query = query.where(Post.hashtags.contains([hashtag.lower()]))
    if user_id:
        query = query.where(Post.user_id == user_id)
    if vehicle_id:
        query = query.where(Post.vehicle_id == vehicle_id)
    result = await db.execute(query.offset(skip).limit(limit))
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, current_user.id)


@router.get("/saved", response_model=list[PostResponse])
async def saved_posts(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    from app.services.post_moderation import publicly_visible

    result = await db.execute(
        select(Post)
        .join(SavedPost, SavedPost.post_id == Post.id)
        .where(SavedPost.user_id == user.id, publicly_visible())
        .order_by(SavedPost.created_at.desc())
    )
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, user.id)


@router.get("/{post_id}", response_model=PostResponse)
async def get_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.hidden_at is not None and post.user_id != current_user.id:
        viewer = await db.get(User, current_user.id)
        from app.deps import is_staff

        if not viewer or not is_staff(viewer):
            raise HTTPException(status_code=404, detail="content_unavailable")
    return await _post_to_response(db, post, current_user.id)


async def _apply_publication(db: AsyncSession, post: Post, body: PostCreate, user: User, request: Request) -> None:
    from app.config import settings
    from app.services.post_moderation import mock_decisions_from_header, moderate_images

    mode = settings.rekognition_mode.strip().lower() or ("mock" if settings.is_local else "off")
    outcome = await moderate_images(
        db,
        body.image_urls,
        post_id=post.id,
        mock_decisions=mock_decisions_from_header(request.headers, is_local=settings.is_local, mode=mode),
    )
    tags = body.hashtags or _extract_hashtags(body.content)
    post.content = body.content
    post.image_urls = outcome.image_urls or None
    post.video_urls = body.video_urls
    post.location = body.location
    post.vehicle_id = body.vehicle_id
    post.hashtags = tags if tags else None
    post.moderation_status = outcome.status
    post.media_version = outcome.media_version
    post.moderation_blocks = outcome.blocks or None
    post.publish_requested = True
    post.hidden_at = None if outcome.status == "published" else datetime.now(UTC)
    if outcome.status == "published":
        await notify_first_publication(db, post, user)


async def notify_first_publication(db: AsyncSession, post: Post, author: User) -> None:
    """Tell vehicle followers about a post once, the first time it actually goes public."""
    if post.first_published_at is not None:
        return
    post.first_published_at = datetime.now(UTC)
    if not post.vehicle_id:
        return
    vehicle = await db.get(Vehicle, post.vehicle_id)
    follower_ids = (
        await db.execute(
            select(VehicleFollower.user_id)
            .where(VehicleFollower.vehicle_id == post.vehicle_id, VehicleFollower.user_id != author.id)
            .limit(50)
        )
    ).scalars().all()
    label = (vehicle.nickname if vehicle else None) or (
        f"{vehicle.make} {vehicle.model}" if vehicle else "a vehicle"
    )
    for follower_id in follower_ids:
        await create_notification(
            db,
            follower_id,
            author.id,
            "vehicle_post",
            f"{author.full_name} posted about {label}",
            body=author.full_name,
            link=f"/posts/{post.id}",
        )


@router.post("", response_model=PostResponse)
async def create_post(
    body: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = Post(user_id=user.id, moderation_status="pending_review", publish_requested=True)
    db.add(post)
    await db.flush()
    await _apply_publication(db, post, body, user, request)
    await db.commit()
    await db.refresh(post)
    return await _post_to_response(db, post, user.id)


@router.put("/{post_id}/publication", response_model=PostResponse)
async def republish_post(
    post_id: uuid.UUID,
    body: PostCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.moderation_status == "removed":
        raise HTTPException(status_code=403, detail="removed_by_moderator")
    from app.services.media_cleanup import delete_media_files, removed_media, unreferenced_media

    before = [*(post.image_urls or []), *(post.video_urls or [])]
    await _apply_publication(db, post, body, user, request)
    replaced = removed_media(before, [*(post.image_urls or []), *(post.video_urls or [])])
    orphaned = await unreferenced_media(db, replaced)
    await db.commit()
    delete_media_files(orphaned)
    await db.refresh(post)
    return await _post_to_response(db, post, user.id)


@router.post("/{post_id}/appeal")
async def appeal_post(
    post_id: uuid.UUID,
    body: dict,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    from app.models import ModerationAppeal

    post = await db.get(Post, post_id)
    if not post or post.user_id != user.id:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.moderation_status == "removed":
        raise HTTPException(status_code=403, detail="removed_by_moderator")
    if post.moderation_status != "rejected" or not post.media_version:
        raise HTTPException(status_code=400, detail="This post is not waiting for a review request")
    existing = await db.scalar(
        select(ModerationAppeal).where(
            ModerationAppeal.post_id == post.id,
            ModerationAppeal.media_version == post.media_version,
            ModerationAppeal.status == "open",
        )
    )
    if existing:
        return {"id": str(existing.id), "status": existing.status, "duplicate": True}
    note = str(body.get("note") or "").strip() or None
    appeal = ModerationAppeal(
        user_id=user.id,
        post_id=post.id,
        media_version=post.media_version,
        snapshot=post.moderation_blocks,
        note=note,
        status="open",
    )
    db.add(appeal)
    await db.commit()
    await db.refresh(appeal)
    return {"id": str(appeal.id), "status": appeal.status, "duplicate": False}


@router.post("/{post_id}/like")
async def toggle_like(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    _unavailable_if_hidden(post, user.id)

    existing = await db.scalar(
        select(PostLike).where(PostLike.post_id == post_id, PostLike.user_id == user.id)
    )
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"liked": False}

    db.add(PostLike(post_id=post_id, user_id=user.id))
    if post.user_id != user.id:
        await create_notification(
            db, post.user_id, user.id, "like", f"{user.full_name} liked your post", link=f"/"
        )
    await db.commit()
    return {"liked": True}


@router.post("/{post_id}/save")
async def toggle_save(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    _unavailable_if_hidden(post, user.id)

    existing = await db.scalar(
        select(SavedPost).where(SavedPost.post_id == post_id, SavedPost.user_id == user.id)
    )
    if existing:
        await db.delete(existing)
        await db.commit()
        return {"saved": False}

    db.add(SavedPost(post_id=post_id, user_id=user.id))
    await db.commit()
    return {"saved": True}


@router.get("/{post_id}/comments", response_model=list[CommentResponse])
async def list_comments(post_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    _unavailable_if_hidden(post, user.id)
    result = await db.execute(
        select(Comment).where(Comment.post_id == post_id).order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    responses = []
    for c in comments:
        author = await db.get(User, c.user_id)
        responses.append(
            CommentResponse(
                id=c.id,
                post_id=c.post_id,
                user_id=c.user_id,
                content=c.content,
                created_at=c.created_at,
                author=user_to_public(author),
            )
        )
    return responses


@router.post("/{post_id}/comments", response_model=CommentResponse)
async def create_comment(
    post_id: uuid.UUID,
    body: CommentCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    _unavailable_if_hidden(post, user.id)

    comment = Comment(post_id=post_id, user_id=user.id, content=body.content)
    db.add(comment)
    if post.user_id != user.id:
        await create_notification(
            db, post.user_id, user.id, "comment",
            f"{user.full_name} commented on your post", body.content[:100], link="/"
        )
    await db.commit()
    await db.refresh(comment)
    return CommentResponse(
        id=comment.id,
        post_id=comment.post_id,
        user_id=comment.user_id,
        content=comment.content,
        created_at=comment.created_at,
        author=user_to_public(user),
    )


@router.delete("/{post_id}/comments/{comment_id}")
async def delete_comment(
    post_id: uuid.UUID,
    comment_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    """The comment's author, the post's owner, or staff can remove a comment."""
    from app.deps import is_staff

    comment = await db.get(Comment, comment_id)
    if not comment or comment.post_id != post_id:
        raise HTTPException(status_code=404, detail="Comment not found")
    post = await db.get(Post, post_id)
    allowed = comment.user_id == user.id or (post is not None and post.user_id == user.id) or is_staff(user)
    if not allowed:
        raise HTTPException(status_code=403, detail="You cannot delete this comment")
    await db.delete(comment)
    await db.commit()
    return {"deleted": True}


@router.delete("/{post_id}")
async def delete_post(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    from app.services.media_cleanup import delete_media_files, unreferenced_media

    media = [*(post.image_urls or []), *(post.video_urls or [])]
    await db.delete(post)
    orphaned = await unreferenced_media(db, media)
    await db.commit()
    delete_media_files(orphaned)
    return {"deleted": True}
