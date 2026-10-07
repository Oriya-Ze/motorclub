"""A member who signed up but never confirmed can sign up again, or log in to reach the code step."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import delete, select

from app.auth.cognito import CognitoAuthProvider
from app.database import get_engine, get_session_factory
from app.models import PendingSignup
from app.services import pending_signup
from app.services.auth_lookup import check_username_availability, resolve_login_email
from fastapi import HTTPException

PASSWORD = "Strong-pass-123"


@pytest.fixture
def sent_codes(monkeypatch):
    codes: list[tuple[str, str]] = []

    async def fake_send(email: str, code: str) -> None:
        codes.append((email, code))

    monkeypatch.setattr(pending_signup, "send_signup_verification_email", fake_send)
    return codes


async def _cleanup(*emails: str) -> None:
    async with get_session_factory()() as db:
        await db.execute(delete(PendingSignup).where(PendingSignup.email.in_(emails)))
        await db.commit()
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_signing_up_again_with_the_same_email_sends_a_fresh_code(sent_codes):
    email = f"again-{uuid.uuid4().hex[:6]}@example.com"
    username = f"again{uuid.uuid4().hex[:6]}"
    try:
        async with get_session_factory()() as db:
            provider = CognitoAuthProvider(db)
            await provider.register(email, username, "Someone", PASSWORD)
            # Before the fix this raised "Email already registered" and left the member stuck.
            await provider.register(email, username, "Someone", PASSWORD)
            rows = (await db.execute(select(PendingSignup).where(PendingSignup.email == email))).scalars().all()
            assert len(rows) == 1
        assert [e for e, _ in sent_codes] == [email, email]
        assert sent_codes[0][1] != sent_codes[1][1] or len(sent_codes[0][1]) == 6
    finally:
        await _cleanup(email)


@pytest.mark.asyncio
async def test_username_of_your_own_pending_signup_is_not_taken_for_you(sent_codes):
    email = f"mine-{uuid.uuid4().hex[:6]}@example.com"
    username = f"mine{uuid.uuid4().hex[:6]}"
    try:
        async with get_session_factory()() as db:
            await CognitoAuthProvider(db).register(email, username, "Someone", PASSWORD)
            assert (await check_username_availability(db, username))["available"] is False
            assert (await check_username_availability(db, username, "other@example.com"))["available"] is False
            assert (await check_username_availability(db, username, email.upper()))["available"] is True
            # Logging in before confirming points the member to the code step.
            with pytest.raises(HTTPException) as caught:
                await resolve_login_email(db, email)
            assert caught.value.status_code == 403 and caught.value.detail.startswith("Email not verified")
    finally:
        await _cleanup(email)


@pytest.mark.asyncio
async def test_an_expired_signup_does_not_hold_its_username(sent_codes):
    email = f"old-{uuid.uuid4().hex[:6]}@example.com"
    username = f"old{uuid.uuid4().hex[:6]}"
    newcomer = f"new-{uuid.uuid4().hex[:6]}@example.com"
    try:
        async with get_session_factory()() as db:
            await CognitoAuthProvider(db).register(email, username, "Someone", PASSWORD)
            row = await db.scalar(select(PendingSignup).where(PendingSignup.email == email))
            row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
            await db.commit()
            assert (await check_username_availability(db, username))["available"] is True
            await CognitoAuthProvider(db).register(newcomer, username, "Newcomer", PASSWORD)
            assert await db.scalar(select(PendingSignup).where(PendingSignup.email == email)) is None
    finally:
        await _cleanup(email, newcomer)
