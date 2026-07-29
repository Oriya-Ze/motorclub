from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.base import AuthProvider
from app.auth.cognito import CognitoAuthProvider
from app.auth.local import LocalAuthProvider
from app.config import settings


def get_auth_provider(db: AsyncSession) -> AuthProvider:
    if settings.auth_provider == "cognito":
        return CognitoAuthProvider(db)
    return LocalAuthProvider(db)
