from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_provider
from app.auth.base import AuthUser
from app.database import get_db
from app.models import User
from app.schemas import UserPublic

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AuthUser:
    if not credentials:
        raise HTTPException(status_code=401, detail="Not authenticated")
    provider = get_auth_provider(db)
    return await provider.verify_token(credentials.credentials)


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> AuthUser | None:
    if not credentials:
        return None
    try:
        provider = get_auth_provider(db)
        return await provider.verify_token(credentials.credentials)
    except HTTPException:
        return None


async def get_user_model(user: AuthUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> User:
    result = await db.execute(select(User).where(User.id == user.id))
    db_user = result.scalar_one_or_none()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    return db_user


def user_to_public(user: User) -> UserPublic:
    return UserPublic.model_validate(user)
