"""Temporary signup storage until email verification completes."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PendingSignup
from app.services.auth_lookup import check_registration_availability
from app.services.email import send_signup_verification_email

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

CODE_LENGTH = 6
SIGNUP_CODE_PEPPER = "motorclub-signup-code"


def _hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


def _generate_code() -> str:
    return f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"


def _hash_code(email: str, code: str) -> str:
    pepper = settings.jwt_secret or SIGNUP_CODE_PEPPER
    digest = hmac.new(
        pepper.encode("utf-8"),
        f"{email.lower()}:{code}".encode("utf-8"),
        hashlib.sha256,
    )
    return digest.hexdigest()


def _expires_at() -> datetime:
    return datetime.now(UTC) + timedelta(minutes=settings.signup_code_expire_minutes)


async def _ensure_email_and_username_available(
    db: AsyncSession,
    email: str,
    username: str,
    *,
    exclude_pending_id=None,
) -> None:
    await check_registration_availability(
        db,
        email,
        username,
        exclude_pending_id=exclude_pending_id,
    )


async def create_or_refresh_pending_signup(
    db: AsyncSession,
    *,
    email: str,
    username: str,
    full_name: str,
    password: str,
) -> None:
    email = email.lower().strip()
    username = username.strip()
    full_name = full_name.strip()

    existing = await db.scalar(select(PendingSignup).where(PendingSignup.email == email))
    if existing:
        await _ensure_email_and_username_available(
            db, email, username, exclude_pending_id=existing.id
        )
        code = _generate_code()
        existing.username = username
        existing.full_name = full_name
        existing.password_hash = _hash_password(password)
        existing.code_hash = _hash_code(email, code)
        existing.expires_at = _expires_at()
        await db.flush()
        try:
            await send_signup_verification_email(email, code)
        except Exception as exc:
            await db.rollback()
            raise HTTPException(status_code=503, detail="Could not send verification email") from exc
        await db.commit()
        return

    await _ensure_email_and_username_available(db, email, username)

    code = _generate_code()
    pending = PendingSignup(
        email=email,
        username=username,
        full_name=full_name,
        password_hash=_hash_password(password),
        code_hash=_hash_code(email, code),
        expires_at=_expires_at(),
    )
    db.add(pending)
    await db.flush()
    try:
        await send_signup_verification_email(email, code)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="Could not send verification email") from exc
    await db.commit()


async def resend_pending_signup_code(db: AsyncSession, email: str) -> None:
    email = email.lower().strip()
    pending = await db.scalar(select(PendingSignup).where(PendingSignup.email == email))
    if not pending:
        return

    code = _generate_code()
    pending.code_hash = _hash_code(email, code)
    pending.expires_at = _expires_at()
    await db.flush()
    try:
        await send_signup_verification_email(email, code)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="Could not send verification email") from exc
    await db.commit()


async def verify_pending_signup(
    db: AsyncSession,
    *,
    email: str,
    code: str,
    password: str,
) -> PendingSignup:
    email = email.lower().strip()
    pending = await db.scalar(select(PendingSignup).where(PendingSignup.email == email))
    if not pending:
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if pending.expires_at < datetime.now(UTC):
        await db.execute(delete(PendingSignup).where(PendingSignup.id == pending.id))
        await db.commit()
        raise HTTPException(status_code=400, detail="Verification code expired")

    if pending.code_hash != _hash_code(email, code.strip()):
        raise HTTPException(status_code=400, detail="Invalid verification code")

    if not _verify_password(password, pending.password_hash):
        raise HTTPException(status_code=400, detail="Invalid email or password")

    return pending


async def delete_pending_signup(db: AsyncSession, pending: PendingSignup) -> None:
    await db.delete(pending)
    await db.commit()


async def cleanup_expired_pending_signups(db: AsyncSession) -> None:
    await db.execute(delete(PendingSignup).where(PendingSignup.expires_at < datetime.now(UTC)))
    await db.commit()
