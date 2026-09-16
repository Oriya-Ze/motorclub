from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.base import AuthTokens
from app.auth.jwt_tokens import create_access_token
from app.config import settings
from app.models import RefreshToken, User


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _new_refresh_token() -> str:
    return secrets.token_urlsafe(48)


async def issue_session(db: AsyncSession, user: User) -> AuthTokens:
    access = create_access_token(user.id, user.email)
    raw = _new_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(raw),
            expires_at=datetime.now(UTC) + timedelta(days=settings.jwt_refresh_expire_days),
        )
    )
    await db.commit()
    return AuthTokens(
        access_token=access.access_token,
        refresh_token=raw,
        token_type=access.token_type,
        expires_in=access.expires_in,
    )


async def rotate_session(db: AsyncSession, refresh_token: str) -> AuthTokens:
    record = await _active_record(db, refresh_token)
    user = await db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    record.revoked_at = datetime.now(UTC)
    tokens = await issue_session(db, user)
    return tokens


async def revoke_session(db: AsyncSession, refresh_token: str) -> None:
    record = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
    )
    if record and record.revoked_at is None:
        record.revoked_at = datetime.now(UTC)
        await db.commit()


async def _active_record(db: AsyncSession, refresh_token: str) -> RefreshToken:
    record = await db.scalar(
        select(RefreshToken).where(RefreshToken.token_hash == hash_refresh_token(refresh_token))
    )
    now = datetime.now(UTC)
    if (
        not record
        or record.revoked_at is not None
        or record.expires_at <= now
    ):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    return record


def tokens_match(stored_hash: str, refresh_token: str) -> bool:
    return hmac.compare_digest(stored_hash, hash_refresh_token(refresh_token))
