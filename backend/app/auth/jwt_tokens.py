import uuid
from datetime import UTC, datetime, timedelta

from jose import jwt

from app.auth.base import AuthTokens
from app.config import settings


def create_access_token(user_id: uuid.UUID, email: str) -> AuthTokens:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return AuthTokens(access_token=token, expires_in=settings.jwt_expire_minutes * 60)
