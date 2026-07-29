from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_provider
from app.auth.local import LocalAuthProvider, _create_access_token
from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import User
from app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    auth_user = await provider.register(body.email, body.username, body.full_name, body.password)

    result = await db.execute(select(User).where(User.id == auth_user.id))
    user = result.scalar_one()

    if isinstance(provider, LocalAuthProvider):
        tokens = _create_access_token(user.id, user.email)
        return AuthResponse(
            user=user_to_public(user),
            access_token=tokens.access_token,
            token_type=tokens.token_type,
            expires_in=tokens.expires_in,
        )

    _, tokens = await provider.login(body.email, body.password)
    return AuthResponse(
        user=user_to_public(user),
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
    )


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    auth_user, tokens = await provider.login(body.email, body.password)

    result = await db.execute(select(User).where(User.id == auth_user.id))
    user = result.scalar_one()

    return AuthResponse(
        user=user_to_public(user),
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
    )


@router.get("/me", response_model=UserPublic)
async def me(user: User = Depends(get_user_model)):
    return user_to_public(user)


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    await provider.forgot_password(body.email)
    return {"message": "If the email exists, a reset link was sent"}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    await provider.reset_password(body.email, body.code, body.new_password)
    return {"message": "Password reset successfully"}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    provider = get_auth_provider(db)
    await provider.change_password(user.id, body.current_password, body.new_password)
    return {"message": "Password changed successfully"}
