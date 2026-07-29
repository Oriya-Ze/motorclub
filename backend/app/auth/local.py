import re
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.base import AuthProvider, AuthTokens, AuthUser
from app.config import settings
from app.logging_config import get_logger
from app.models import ProfileSettings, User

logger = get_logger(__name__)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

PASSWORD_MIN_LENGTH = 8
USERNAME_PATTERN = re.compile(r"^[a-zA-Z0-9_.-]+$")


def _hash_password(password: str) -> str:
    return pwd_context.hash(password[:72])


def _verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain[:72], hashed)


def _create_access_token(user_id: uuid.UUID, email: str) -> AuthTokens:
    expire = datetime.now(UTC) + timedelta(minutes=settings.jwt_expire_minutes)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    token = jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)
    return AuthTokens(access_token=token, expires_in=settings.jwt_expire_minutes * 60)


def _validate_password(password: str, email: str, username: str) -> None:
    if len(password) < PASSWORD_MIN_LENGTH:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r"[A-Za-z]", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one letter")
    if not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must contain at least one number")
    if username.lower() in password.lower():
        raise HTTPException(status_code=400, detail="Password cannot contain username")
    email_local = email.split("@")[0].lower()
    if len(email_local) >= 3 and email_local in password.lower():
        raise HTTPException(status_code=400, detail="Password cannot contain email")


class LocalAuthProvider(AuthProvider):
    def __init__(self, db: AsyncSession):
        self.db = db

    async def _get_user_by_email(self, email: str) -> User | None:
        result = await self.db.execute(select(User).where(User.email == email.lower()))
        return result.scalar_one_or_none()

    async def _get_user_by_id(self, user_id: uuid.UUID) -> User | None:
        result = await self.db.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()

    def _to_auth_user(self, user: User) -> AuthUser:
        return AuthUser(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            cognito_sub=user.cognito_sub,
        )

    async def register(self, email: str, username: str, full_name: str, password: str) -> AuthUser:
        email = email.lower().strip()
        username = username.strip()

        if len(full_name.strip()) < 2:
            raise HTTPException(status_code=400, detail="Full name must be at least 2 characters")
        if len(username) < 3:
            raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
        if not USERNAME_PATTERN.match(username):
            raise HTTPException(status_code=400, detail="Username contains invalid characters")

        _validate_password(password, email, username)

        if await self._get_user_by_email(email):
            raise HTTPException(status_code=409, detail="Email already registered")

        existing_username = await self.db.execute(select(User).where(User.username == username))
        if existing_username.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Username already taken")

        user = User(
            email=email,
            username=username,
            full_name=full_name.strip(),
            password_hash=_hash_password(password),
        )
        self.db.add(user)
        await self.db.flush()

        self.db.add(ProfileSettings(user_id=user.id))
        await self.db.commit()
        await self.db.refresh(user)
        return self._to_auth_user(user)

    async def login(self, email: str, password: str) -> tuple[AuthUser, AuthTokens]:
        user = await self._get_user_by_email(email.lower().strip())
        if not user or not user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        if not user.is_active:
            raise HTTPException(status_code=403, detail="Account is disabled")
        if not _verify_password(password, user.password_hash):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        tokens = _create_access_token(user.id, user.email)
        return self._to_auth_user(user), tokens

    async def verify_token(self, token: str) -> AuthUser:
        try:
            payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
            user_id = uuid.UUID(payload["sub"])
        except (JWTError, ValueError) as exc:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token") from exc

        user = await self._get_user_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        return self._to_auth_user(user)

    async def forgot_password(self, email: str) -> None:
        user = await self._get_user_by_email(email.lower().strip())
        if user:
            logger.info("Password reset requested")

    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        raise HTTPException(
            status_code=501,
            detail="Password reset via code is only available with Cognito auth provider",
        )

    async def change_password(self, user_id: uuid.UUID, current_password: str, new_password: str) -> None:
        user = await self._get_user_by_id(user_id)
        if not user or not user.password_hash:
            raise HTTPException(status_code=404, detail="User not found")
        if not _verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=400, detail="Current password is incorrect")
        _validate_password(new_password, user.email, user.username)
        user.password_hash = _hash_password(new_password)
        await self.db.commit()
