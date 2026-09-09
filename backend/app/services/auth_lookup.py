"""Auth lookups against Neon — avoid Cognito calls for existence checks."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.validation import normalize_email, normalize_username
from app.models import PendingSignup, User


async def resolve_login_email(db: AsyncSession, email: str) -> None:
    """Ensure email exists locally before password verification / Cognito."""
    normalized = normalize_email(email)

    pending = await db.scalar(select(PendingSignup.id).where(PendingSignup.email == normalized))
    if pending:
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Enter the confirmation code sent to your email.",
        )

    user = await db.scalar(
        select(User.id).where(func.lower(User.email) == normalized, User.is_active.is_(True))
    )
    if not user:
        inactive = await db.scalar(select(User.id).where(func.lower(User.email) == normalized))
        if inactive:
            raise HTTPException(status_code=403, detail="Account is disabled")
        raise HTTPException(status_code=401, detail="Email not registered")


async def check_username_availability(db: AsyncSession, username: str) -> dict:
    """Validate username format and check Neon availability (no Cognito)."""
    from app.auth.validation import validate_username

    raw = normalize_username(username)
    try:
        cleaned = validate_username(raw)
    except HTTPException as exc:
        detail = str(exc.detail)
        reason = "reserved" if detail == "Username is reserved" else "invalid"
        return {
            "username": raw,
            "valid": False,
            "available": False,
            "reason": reason,
        }

    username_key = cleaned.lower()
    user_taken = await db.scalar(select(User.id).where(func.lower(User.username) == username_key))
    pending_taken = await db.scalar(
        select(PendingSignup.id).where(func.lower(PendingSignup.username) == username_key)
    )

    if user_taken or pending_taken:
        return {
            "username": cleaned,
            "valid": True,
            "available": False,
            "reason": "taken",
        }

    return {
        "username": cleaned,
        "valid": True,
        "available": True,
        "reason": None,
    }


async def check_registration_availability(
    db: AsyncSession,
    email: str,
    username: str,
    *,
    exclude_pending_id=None,
) -> None:
    """Check email + username in users and pending signups (parallel DB queries)."""
    normalized_email = normalize_email(email)
    username_key = normalize_username(username).lower()

    pending_email_query = select(PendingSignup.id).where(PendingSignup.email == normalized_email)
    pending_username_query = select(PendingSignup.id).where(func.lower(PendingSignup.username) == username_key)
    if exclude_pending_id:
        pending_email_query = pending_email_query.where(PendingSignup.id != exclude_pending_id)
        pending_username_query = pending_username_query.where(PendingSignup.id != exclude_pending_id)

    user_email_id = await db.scalar(select(User.id).where(func.lower(User.email) == normalized_email))
    user_username_id = await db.scalar(select(User.id).where(func.lower(User.username) == username_key))
    pending_email_id = await db.scalar(pending_email_query)
    pending_username_id = await db.scalar(pending_username_query)

    if user_email_id or pending_email_id:
        raise HTTPException(status_code=409, detail="Email already registered")
    if user_username_id or pending_username_id:
        raise HTTPException(status_code=409, detail="Username already taken")
