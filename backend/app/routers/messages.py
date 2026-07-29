import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import Conversation, DirectMessage, User
from app.schemas import MessageResponse, UserPublic

router = APIRouter(prefix="/messages", tags=["messages"])


class ConversationSummary(BaseModel):
    id: uuid.UUID
    other_user: UserPublic
    last_message: str | None
    last_message_at: str | None
    unread_count: int = 0


class StartConversationRequest(BaseModel):
    user_id: uuid.UUID


class SendMessageRequest(BaseModel):
    content: str = Field(min_length=1)


@router.get("/conversations", response_model=list[ConversationSummary])
async def list_conversations(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    result = await db.execute(
        select(Conversation).where(
            or_(Conversation.user1_id == user.id, Conversation.user2_id == user.id)
        )
    )
    conversations = result.scalars().all()
    summaries: list[ConversationSummary] = []

    for conv in conversations:
        other_id = conv.user2_id if conv.user1_id == user.id else conv.user1_id
        other = await db.get(User, other_id)
        if not other:
            continue

        msg_result = await db.execute(
            select(DirectMessage)
            .where(DirectMessage.conversation_id == conv.id)
            .order_by(DirectMessage.created_at.desc())
            .limit(1)
        )
        last_msg = msg_result.scalar_one_or_none()

        unread_result = await db.execute(
            select(DirectMessage).where(
                DirectMessage.conversation_id == conv.id,
                DirectMessage.sender_id != user.id,
                DirectMessage.is_read.is_(False),
            )
        )
        unread_count = len(unread_result.scalars().all())

        summaries.append(
            ConversationSummary(
                id=conv.id,
                other_user=user_to_public(other),
                last_message=last_msg.content if last_msg else None,
                last_message_at=last_msg.created_at.isoformat() if last_msg else None,
                unread_count=unread_count,
            )
        )

    summaries.sort(key=lambda s: s.last_message_at or "", reverse=True)
    return summaries


@router.post("/conversations", response_model=ConversationSummary)
async def start_conversation(
    body: StartConversationRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    if body.user_id == user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    other = await db.get(User, body.user_id)
    if not other:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.scalar(
        select(Conversation).where(
            or_(
                (Conversation.user1_id == user.id) & (Conversation.user2_id == body.user_id),
                (Conversation.user1_id == body.user_id) & (Conversation.user2_id == user.id),
            )
        )
    )
    if existing:
        return ConversationSummary(
            id=existing.id,
            other_user=user_to_public(other),
            last_message=None,
            last_message_at=None,
            unread_count=0,
        )

    conv = Conversation(user1_id=user.id, user2_id=body.user_id)
    db.add(conv)
    await db.commit()
    await db.refresh(conv)
    return ConversationSummary(
        id=conv.id,
        other_user=user_to_public(other),
        last_message=None,
        last_message_at=None,
        unread_count=0,
    )


@router.get("/conversations/{conversation_id}/messages", response_model=list[MessageResponse])
async def list_messages(
    conversation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    conv = await db.get(Conversation, conversation_id)
    if not conv or user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    result = await db.execute(
        select(DirectMessage)
        .where(DirectMessage.conversation_id == conversation_id)
        .order_by(DirectMessage.created_at.asc())
    )
    messages = result.scalars().all()

    for msg in messages:
        if msg.sender_id != user.id and not msg.is_read:
            msg.is_read = True
    await db.commit()

    return [MessageResponse.model_validate(m) for m in messages]


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: uuid.UUID,
    body: SendMessageRequest,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_user_model),
):
    conv = await db.get(Conversation, conversation_id)
    if not conv or user.id not in (conv.user1_id, conv.user2_id):
        raise HTTPException(status_code=404, detail="Conversation not found")

    message = DirectMessage(
        conversation_id=conversation_id,
        sender_id=user.id,
        content=body.content,
    )
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return MessageResponse.model_validate(message)
