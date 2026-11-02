"""The code a member enters to delete their own account: emailed, short-lived, and limited in attempts."""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models import PendingAccountDeletion, User
from app.services.email import send_account_deletion_email

CODE_LENGTH = 6
MAX_ATTEMPTS = 5
CODE_PEPPER = "motorclub-account-deletion-code"


def _hash_code(user_id, code: str) -> str:
    pepper = settings.jwt_secret or CODE_PEPPER
    return hmac.new(pepper.encode(), f"account-deletion:{user_id}:{code}".encode(), hashlib.sha256).hexdigest()


def mask_email(email: str) -> str:
    """Enough of the address to recognise it on screen, not enough to read it off a shoulder."""
    local, _, domain = email.partition("@")
    return f"{local[:2]}{'•' * max(len(local) - 2, 1)}@{domain}"


async def send_deletion_code(db: AsyncSession, user: User) -> None:
    """A new code replaces any earlier one and resets its attempts."""
    code = f"{secrets.randbelow(10**CODE_LENGTH):0{CODE_LENGTH}d}"
    expires_at = datetime.now(UTC) + timedelta(minutes=settings.account_deletion_code_expire_minutes)
    pending = await db.scalar(select(PendingAccountDeletion).where(PendingAccountDeletion.user_id == user.id))
    if pending:
        pending.code_hash, pending.expires_at, pending.attempts = _hash_code(user.id, code), expires_at, 0
    else:
        db.add(PendingAccountDeletion(user_id=user.id, code_hash=_hash_code(user.id, code), expires_at=expires_at, attempts=0))
    await db.flush()
    try:
        await send_account_deletion_email(user.email, code)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="deletion_code_not_sent") from exc
    await db.commit()


async def check_deletion_code(db: AsyncSession, user: User, code: str) -> None:
    """Raises with a code the page explains; a right code removes itself so it cannot be used twice."""
    pending = await db.scalar(select(PendingAccountDeletion).where(PendingAccountDeletion.user_id == user.id))
    if not pending:
        raise HTTPException(status_code=400, detail="deletion_code_missing")
    if pending.expires_at < datetime.now(UTC):
        await db.execute(delete(PendingAccountDeletion).where(PendingAccountDeletion.id == pending.id))
        await db.commit()
        raise HTTPException(status_code=400, detail="deletion_code_expired")
    if not hmac.compare_digest(pending.code_hash, _hash_code(user.id, code.strip())):
        pending.attempts += 1
        if pending.attempts >= MAX_ATTEMPTS:
            await db.execute(delete(PendingAccountDeletion).where(PendingAccountDeletion.id == pending.id))
            await db.commit()
            raise HTTPException(status_code=400, detail="deletion_code_locked")
        await db.commit()
        raise HTTPException(status_code=400, detail="deletion_code_invalid")
    await db.execute(delete(PendingAccountDeletion).where(PendingAccountDeletion.id == pending.id))
    await db.flush()
