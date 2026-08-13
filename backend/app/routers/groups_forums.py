import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Forum, ForumReply, ForumTopic, Group, GroupMember, GroupMessage, User
from app.schemas import (
    ForumReplyCreate,
    ForumReplyResponse,
    ForumResponse,
    ForumTopicCreate,
    ForumTopicResponse,
    GroupCreate,
    GroupMessageCreate,
    GroupMessageResponse,
    GroupResponse,
)

groups_router = APIRouter(prefix="/groups", tags=["groups"])
forums_router = APIRouter(prefix="/forums", tags=["forums"])


async def _group_membership(db: AsyncSession, group_id: uuid.UUID, user_id: uuid.UUID) -> GroupMember | None:
    return await db.scalar(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.user_id == user_id,
            GroupMember.status == "approved",
        )
    )


async def _group_response(db: AsyncSession, group: Group, user_id: uuid.UUID) -> GroupResponse:
    count = await db.scalar(
        select(func.count()).select_from(GroupMember).where(
            GroupMember.group_id == group.id, GroupMember.status == "approved"
        )
    )
    is_member = await _group_membership(db, group.id, user_id) is not None
    return GroupResponse(
        id=group.id,
        name=group.name,
        description=group.description,
        category=group.category,
        creator_id=group.creator_id,
        members_count=count or 0,
        is_member=is_member,
        created_at=group.created_at,
    )


@groups_router.get("", response_model=list[GroupResponse])
async def list_groups(db: AsyncSession = Depends(get_db), user: User = Depends(get_user_model)):
    result = await db.execute(select(Group).order_by(Group.created_at.desc()))
    groups = result.scalars().all()
    return [await _group_response(db, g, user.id) for g in groups]


@groups_router.post("", response_model=GroupResponse)
async def create_group(
    body: GroupCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    group = Group(name=body.name, description=body.description, category=body.category, creator_id=user.id)
    db.add(group)
    await db.flush()
    db.add(GroupMember(group_id=group.id, user_id=user.id, status="approved", role="owner"))
    await db.commit()
    await db.refresh(group)
    return await _group_response(db, group, user.id)


@groups_router.post("/{group_id}/join")
async def join_group(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    existing = await db.scalar(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id)
    )
    if existing:
        return {"status": existing.status}

    member = GroupMember(group_id=group_id, user_id=user.id, status="approved")
    db.add(member)
    await db.commit()
    return {"status": "approved"}


@groups_router.get("/{group_id}/messages", response_model=list[GroupMessageResponse])
async def list_group_messages(
    group_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if not await _group_membership(db, group_id, user.id):
        raise HTTPException(status_code=403, detail="Join the group to view messages")
    result = await db.execute(
        select(GroupMessage).where(GroupMessage.group_id == group_id).order_by(GroupMessage.created_at.asc())
    )
    messages = result.scalars().all()
    responses = []
    for m in messages:
        author = await db.get(User, m.user_id)
        responses.append(
            GroupMessageResponse(
                id=m.id,
                group_id=m.group_id,
                user_id=m.user_id,
                content=m.content,
                image_url=m.image_url,
                video_url=m.video_url,
                created_at=m.created_at,
                author=user_to_public(author),
            )
        )
    return responses


@groups_router.post("/{group_id}/messages", response_model=GroupMessageResponse)
async def send_group_message(
    group_id: uuid.UUID,
    body: GroupMessageCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if not await _group_membership(db, group_id, user.id):
        raise HTTPException(status_code=403, detail="Join the group to send messages")
    message = GroupMessage(
        group_id=group_id,
        user_id=user.id,
        content=body.content,
        image_url=body.image_url,
        video_url=body.video_url,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return GroupMessageResponse(
        id=message.id,
        group_id=message.group_id,
        user_id=message.user_id,
        content=message.content,
        image_url=message.image_url,
        video_url=message.video_url,
        created_at=message.created_at,
        author=user_to_public(user),
    )


@forums_router.get("", response_model=list[ForumResponse])
async def list_forums(db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(select(Forum).order_by(Forum.name))
    return [ForumResponse.model_validate(f) for f in result.scalars().all()]


@forums_router.get("/{forum_id}/topics", response_model=list[ForumTopicResponse])
async def list_topics(forum_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(ForumTopic).where(ForumTopic.forum_id == forum_id).order_by(ForumTopic.created_at.desc())
    )
    topics = result.scalars().all()
    responses = []
    for t in topics:
        author = await db.get(User, t.user_id)
        replies_count = await db.scalar(
            select(func.count()).select_from(ForumReply).where(ForumReply.topic_id == t.id)
        )
        responses.append(
            ForumTopicResponse(
                id=t.id,
                forum_id=t.forum_id,
                user_id=t.user_id,
                title=t.title,
                content=t.content,
                is_pinned=t.is_pinned,
                is_solved=t.is_solved,
                views_count=t.views_count,
                replies_count=replies_count or 0,
                created_at=t.created_at,
                author=user_to_public(author),
            )
        )
    return responses


@forums_router.post("/topics", response_model=ForumTopicResponse)
async def create_topic(
    body: ForumTopicCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    topic = ForumTopic(
        forum_id=body.forum_id,
        user_id=user.id,
        title=body.title,
        content=body.content,
    )
    db.add(topic)
    forum = await db.get(Forum, body.forum_id)
    if forum:
        forum.topics_count += 1
    await db.commit()
    await db.refresh(topic)
    return ForumTopicResponse(
        id=topic.id,
        forum_id=topic.forum_id,
        user_id=topic.user_id,
        title=topic.title,
        content=topic.content,
        is_pinned=topic.is_pinned,
        is_solved=topic.is_solved,
        views_count=topic.views_count,
        replies_count=0,
        created_at=topic.created_at,
        author=user_to_public(user),
    )


@forums_router.get("/topics/{topic_id}/replies", response_model=list[ForumReplyResponse])
async def list_replies(topic_id: uuid.UUID, db: AsyncSession = Depends(get_db), _=Depends(get_current_user)):
    result = await db.execute(
        select(ForumReply).where(ForumReply.topic_id == topic_id).order_by(ForumReply.created_at.asc())
    )
    replies = result.scalars().all()
    responses = []
    for r in replies:
        author = await db.get(User, r.user_id)
        responses.append(
            ForumReplyResponse(
                id=r.id,
                topic_id=r.topic_id,
                user_id=r.user_id,
                content=r.content,
                is_best_answer=r.is_best_answer,
                created_at=r.created_at,
                author=user_to_public(author),
            )
        )
    return responses


@forums_router.post("/topics/{topic_id}/replies", response_model=ForumReplyResponse)
async def create_reply(
    topic_id: uuid.UUID,
    body: ForumReplyCreate,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    reply = ForumReply(topic_id=topic_id, user_id=user.id, content=body.content)
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return ForumReplyResponse(
        id=reply.id,
        topic_id=reply.topic_id,
        user_id=reply.user_id,
        content=reply.content,
        is_best_answer=reply.is_best_answer,
        created_at=reply.created_at,
        author=user_to_public(user),
    )
