"""Temporary password reset codes until the user confirms a new password."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PendingPasswordReset
from app.services.email import send_password_reset_email

CODE_LENGTH = 6
PASSWORD_RESET_CODE_PEPPER = "motorclub-password-reset-code"


def _generate_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"


def _hash_code(email: str, code: str) -> str:
    pepper = settings.jwt_secret or PASSWORD_RESET_CODE_PEPPER
    digest = hmac.new(
        pepper.encode("utf-8"),
        f"password-reset:{email.lower()}:{code}".encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()


def _expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.password_reset_code_expire_minutes)


async def create_or_refresh_password_reset(db: AsyncSession, *, email: str) -> None:
    email = email.lower().strip()
    code = _generate_code()
    existing = await db.scalar(select(PendingPasswordReset).where(PendingPasswordReset.email == email))

    if existing:
        existing.code_hash = _hash_code(email, code)
        existing.expires_at = _expires_at()
    else:
        db.add(
            PendingPasswordReset(
                email=email,
                code_hash=_hash_code(email, code),
                expires_at=_expires_at(),
            )
        )

    await db.flush()
    try:
        await send_password_reset_email(email, code)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="Could not send password reset email") from exc
    await db.commit()


async def verify_password_reset_code(db: AsyncSession, *, email: str, code: str) -> PendingPasswordReset:
    email = email.lower().strip()
    pending = await db.scalar(select(PendingPasswordReset).where(PendingPasswordReset.email == email))
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if pending.expires_at < datetime.now(UTC):
        await db.execute(delete(PendingPasswordReset).where(PendingPasswordReset.id == pending.id))
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired")

    if pending.code_hash != _hash_code(email, code.strip()):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    return pending


async def delete_password_reset(db: AsyncSession, pending: PendingPasswordReset) -> None:
    await db.delete(pending)
    await db.commit()


async def cleanup_expired_password_resets(db: AsyncSession) -> None:
    await db.execute(delete(PendingPasswordReset).where(PendingPasswordReset.expires_at < datetime.now(UTC)))
    await db.commit()
