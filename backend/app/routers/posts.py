import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Comment, Post, PostLike, SavedPost, User
from app.routers.social import create_notification
from app.schemas import CommentCreate, CommentResponse, PostCreate, PostResponse

router = APIRouter(prefix="/posts", tags=["posts"])

HASHTAG_RE = re.compile(r"#(\w+)")


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

    responses: list[PostResponse] = []
    for post in posts:
        author = users_map.get(post.user_id)
        if not author:
            continue
        responses.append(
            PostResponse(
                id=post.id,
                user_id=post.user_id,
                content=post.content,
                image_urls=post.image_urls,
                video_urls=post.video_urls,
                location=post.location,
                vehicle_id=post.vehicle_id,
                hashtags=post.hashtags,
                created_at=post.created_at,
                author=user_to_public(author),
                likes_count=likes_map.get(post.id, 0),
                comments_count=comments_map.get(post.id, 0),
                is_liked=post.id in liked_ids,
                is_saved=post.id in saved_ids,
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
    return PostResponse(
        id=post.id,
        user_id=post.user_id,
        content=post.content,
        image_urls=post.image_urls,
        video_urls=post.video_urls,
        location=post.location,
        vehicle_id=post.vehicle_id,
        hashtags=post.hashtags,
        created_at=post.created_at,
        author=user_to_public(author),
        likes_count=likes_count or 0,
        comments_count=comments_count or 0,
        is_liked=is_liked,
        is_saved=is_saved,
    )


@router.get("", response_model=list[PostResponse])
async def list_posts(
    skip: int = 0,
    limit: int = 20,
    hashtag: str | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    query = select(Post).order_by(Post.created_at.desc())
    if hashtag:
        query = query.where(Post.hashtags.contains([hashtag.lower()]))
    result = await db.execute(query.offset(skip).limit(limit))
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, current_user.id)


@router.get("/saved", response_model=list[PostResponse])
async def saved_posts(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(
        select(Post)
        .join(SavedPost, SavedPost.post_id == Post.id)
        .where(SavedPost.user_id == user.id)
        .order_by(SavedPost.created_at.desc())
    )
    posts = result.scalars().all()
    return await _batch_post_responses(db, posts, user.id)


@router.post("", response_model=PostResponse)
async def create_post(
    body: PostCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    tags = body.hashtags or _extract_hashtags(body.content)
    post = Post(
        user_id=user.id,
        content=body.content,
        image_urls=body.image_urls,
        video_urls=body.video_urls,
        location=body.location,
        vehicle_id=body.vehicle_id,
        hashtags=tags if tags else None,
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return await _post_to_response(db, post, user.id)


@router.post("/{post_id}/like")
async def toggle_like(
    post_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    post = await db.get(Post, post_id)
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

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
async def list_comments(post_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
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
