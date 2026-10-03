"""Delete a member's account, everything it owns, its uploaded files, and its sign-in identity."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import delete as sql_delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_provider
from app.models import User
from app.services.media_cleanup import delete_user_media_files, user_media


async def delete_account(db: AsyncSession, user: User) -> None:
    """Rows are deleted first and committed only after the sign-in identity is gone, so a failure
    leaves the account usable rather than half deleted. Files are removed after the commit."""
    user_id, email = user.id, user.email
    keys, media_ids = await user_media(db, user_id)
    # A bulk delete lets the database's ON DELETE rules remove the member's rows. Deleting the
    # ORM object instead would try to null out foreign keys that cannot be null.
    if user in db:
        db.expunge(user)
    await db.execute(sql_delete(User).where(User.id == user_id))
    try:
        await get_auth_provider(db).delete_identity(email)
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=503, detail="account_deletion_failed") from exc
    await db.commit()
    delete_user_media_files(user_id, keys, media_ids)
