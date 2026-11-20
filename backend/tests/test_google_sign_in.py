import uuid

import pytest
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete, select

from app.auth.cognito import CognitoAuthProvider
from app.database import get_engine, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import User
from tests.test_user_privacy import _person


class _NotFound(Exception):
    pass


class FakeCognito:
    """Just the Cognito calls Google sign-in uses, recorded."""

    class exceptions:
        UserNotFoundException = _NotFound

    def __init__(self, native: dict | None = None, by_sub: list[str] | None = None):
        self.native = native
        self.by_sub = by_sub or []
        self.calls: list[tuple] = []

    def admin_get_user(self, UserPoolId, Username):
        if self.native is None:
            raise _NotFound
        return self.native

    def admin_delete_user(self, UserPoolId, Username):
        self.calls.append(("delete", Username))

    def admin_link_provider_for_user(self, UserPoolId, DestinationUser, SourceUser):
        self.calls.append(("link", DestinationUser["ProviderAttributeValue"], SourceUser["ProviderAttributeValue"]))

    def list_users(self, UserPoolId, Filter, Limit):
        self.calls.append(("list", Filter))
        return {"Users": [{"Username": name} for name in self.by_sub]}


def _google_claims(email: str, *, username: str = "google_1098", verified=True) -> dict:
    return {
        "sub": str(uuid.uuid4()),
        "email": email,
        "email_verified": "true" if verified else "false",
        "cognito:username": username,
        "identities": [{"providerName": "Google", "userId": "1098", "providerType": "Google"}],
        "name": "Google Person",
    }


async def _dispose():
    await get_engine().dispose()
    get_engine.cache_clear()
    get_session_factory.cache_clear()


@pytest.mark.asyncio
async def test_google_sign_in_joins_an_existing_password_account(monkeypatch):
    member = _person("withpw")
    async with get_session_factory()() as db:
        db.add(member)
        await db.commit()
    try:
        async with get_session_factory()() as db:
            provider = CognitoAuthProvider(db)
            native = {"Username": "native-uuid", "UserStatus": "CONFIRMED"}

            fake = FakeCognito(native)
            monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
            with pytest.raises(HTTPException) as linked:
                await provider._link_google_to_existing_account(_google_claims(member.email.upper()))
            assert linked.value.detail == "oauth_account_linked"
            assert fake.calls == [("delete", "google_1098"), ("link", "native-uuid", "1098")]

            # Google did not confirm the email: no link, the email stays with its owner.
            fake = FakeCognito(native)
            monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
            with pytest.raises(HTTPException) as refused:
                await provider._link_google_to_existing_account(_google_claims(member.email, verified=False))
            assert refused.value.detail == "Email already registered" and fake.calls == []

            # Already linked: Cognito signs in as the password account itself, nothing to do.
            fake = FakeCognito(native)
            monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
            await provider._link_google_to_existing_account(_google_claims(member.email, username="native-uuid"))
            assert fake.calls == []

            # A new email: nothing to link.
            fake = FakeCognito(None)
            monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
            await provider._link_google_to_existing_account(_google_claims("someone-new@example.com"))
            assert fake.calls == []

            # A sign-up that never entered its code gives way to Google, which proves the email.
            fake = FakeCognito({"Username": "unconfirmed-uuid", "UserStatus": "UNCONFIRMED"})
            monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
            await provider._link_google_to_existing_account(_google_claims("never-confirmed@example.com"))
            assert fake.calls == [("delete", "unconfirmed-uuid")]
    finally:
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.id == member.id))
            await db.commit()
        await _dispose()


@pytest.mark.asyncio
async def test_a_new_google_member_must_finish_setup(monkeypatch):
    email = f"google-{uuid.uuid4().hex[:6]}@example.com"
    claims = _google_claims(email)
    other = _person("takenname")
    async with get_session_factory()() as db:
        db.add(other)
        await db.commit()
    try:
        async with get_session_factory()() as db:
            provider = CognitoAuthProvider(db)
            monkeypatch.setattr(provider, "_cognito_client", lambda: FakeCognito(None))

            async def decode(token):
                return claims

            monkeypatch.setattr(provider, "_decode_access_token", decode)
            monkeypatch.setattr(provider, "_decode_id_token", decode)
            auth_user, _ = await provider._complete_auth_from_tokens(
                {"AccessToken": "a", "IdToken": "i", "RefreshToken": "r"}, oauth=True
            )
            user = await db.get(User, auth_user.id)
            assert user.account_setup_pending is True and user.email == email
            user_id = user.id

        async with get_session_factory()() as db:
            user = await db.get(User, user_id)
            app.dependency_overrides[get_user_model] = lambda: user
            async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
                me = await client.post("/api/v1/auth/account-setup", json={"username": "googler_one", "accept_terms": False})
                assert me.status_code == 400 and me.json()["detail"] == "terms_required"
                bad = await client.post("/api/v1/auth/account-setup", json={"username": "1bad name", "accept_terms": True})
                assert bad.status_code == 400
                taken = await client.post("/api/v1/auth/account-setup", json={"username": other.username, "accept_terms": True})
                assert taken.status_code == 409 and taken.json()["detail"] == "Username already taken"
                done = await client.post("/api/v1/auth/account-setup", json={"username": "googler_one", "accept_terms": True})
                assert done.status_code == 200, done.text
                assert done.json()["username"] == "googler_one" and done.json()["account_setup_pending"] is False
                again = await client.post("/api/v1/auth/account-setup", json={"username": "googler_two", "accept_terms": True})
                assert again.status_code == 409
        async with get_session_factory()() as db:
            stored = await db.scalar(select(User).where(User.id == user_id))
            assert stored.username == "googler_one" and stored.account_setup_pending is False
    finally:
        app.dependency_overrides.clear()
        async with get_session_factory()() as db:
            await db.execute(delete(User).where(User.email.in_([email, other.email])))
            await db.commit()
        await _dispose()


@pytest.mark.asyncio
async def test_deleting_an_account_removes_its_google_sign_in(monkeypatch):
    async with get_session_factory()() as db:
        provider = CognitoAuthProvider(db)
        fake = FakeCognito(None, by_sub=["google_1098"])
        monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
        sub = str(uuid.uuid4())
        await provider.delete_identity("person@example.com", sub)
        assert ("list", f'sub = "{sub}"') in fake.calls and ("delete", "google_1098") in fake.calls

        fake = FakeCognito(None, by_sub=["x"])
        monkeypatch.setattr(provider, "_cognito_client", lambda: fake)
        await provider.delete_identity("person@example.com", 'bad" or sub = "x')
        assert not any(call[0] == "list" for call in fake.calls), "a malformed sub never reaches the filter"
    await _dispose()
