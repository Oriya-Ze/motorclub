from datetime import UTC, datetime, timedelta

import pytest
from fastapi import Depends
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.database import get_db, get_session_factory
from app.deps import get_user_model
from app.main import app
from app.models import PendingAccountDeletion, User
from tests.test_content_deletion import _add, _drop_users, _local_env, _person


@pytest.mark.asyncio
async def test_deletion_code_expires_and_locks_after_five_wrong_tries(tmp_path, monkeypatch):
    _local_env(tmp_path, monkeypatch)
    member = _person("d")
    await _add(member)
    sent: list[str] = []

    async def _capture(_to: str, code: str) -> None:
        sent.append(code)

    monkeypatch.setattr("app.services.account_deletion_code.send_account_deletion_email", _capture)

    async def _member(db=Depends(get_db)):
        return await db.get(User, member.id)

    app.dependency_overrides[get_user_model] = _member
    try:
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            assert (await client.post("/api/v1/users/me/deletion-code")).status_code == 200
            async with get_session_factory()() as db:
                pending = await db.scalar(select(PendingAccountDeletion).where(PendingAccountDeletion.user_id == member.id))
                pending.expires_at = datetime.now(UTC) - timedelta(minutes=1)
                await db.commit()
            expired = await client.request("DELETE", "/api/v1/users/me", json={"code": sent[-1]})
            assert expired.json()["detail"] == "deletion_code_expired"

            assert (await client.post("/api/v1/users/me/deletion-code")).status_code == 200
            good = sent[-1]
            wrong = "000000" if good != "000000" else "111111"
            details = [(await client.request("DELETE", "/api/v1/users/me", json={"code": wrong})).json()["detail"] for _ in range(5)]
            assert details == ["deletion_code_invalid"] * 4 + ["deletion_code_locked"]
            locked = await client.request("DELETE", "/api/v1/users/me", json={"code": good})
            assert locked.json()["detail"] == "deletion_code_missing", "after the lock even the right code needs a new one"

            assert (await client.post("/api/v1/users/me/deletion-code")).status_code == 200
            assert sent[-1] != "" and len(sent) == 3
        async with get_session_factory()() as db:
            assert await db.get(User, member.id) is not None, "nothing was deleted along the way"
    finally:
        app.dependency_overrides.clear()
        await _drop_users(member)
