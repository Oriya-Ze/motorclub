from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_provider
from app.auth.cognito import CognitoAuthProvider
from app.auth.local import LocalAuthProvider, _create_access_token
from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import User
from app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    ConfirmSignUpRequest,
    ForgotPasswordRequest,
    LoginRequest,
    OAuthCallbackRequest,
    OAuthConfigResponse,
    PhoneAuthStartRequest,
    PhoneAuthStartResponse,
    PhoneAuthVerifyRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserPublic,
)

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)

    if isinstance(provider, CognitoAuthProvider):
        await provider.register(body.email, body.username, body.full_name, body.password)
        return AuthResponse(
            confirmation_required=True,
            message="Account created. Check your email for a verification code.",
        )

    auth_user = await provider.register(body.email, body.username, body.full_name, body.password)

    result = await db.execute(select(User).where(User.id == auth_user.id))
    user = result.scalar_one()

    tokens = _create_access_token(user.id, user.email)
    return AuthResponse(
        user=user_to_public(user),
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
    )


@router.post("/confirm", response_model=AuthResponse)
async def confirm_sign_up(body: ConfirmSignUpRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        raise HTTPException(status_code=501, detail="Account confirmation is only available with Cognito auth")

    auth_user, tokens = await provider.confirm_sign_up(body.email, body.code, body.password)

    result = await db.execute(select(User).where(User.id == auth_user.id))
    user = result.scalar_one()

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


@router.post("/phone/start", response_model=PhoneAuthStartResponse)
async def phone_auth_start(body: PhoneAuthStartRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        raise HTTPException(status_code=501, detail="Phone sign-in is only available with Cognito auth")
    result = await provider.phone_auth_start(body.phone, body.full_name, body.username)
    return PhoneAuthStartResponse(**result)


@router.post("/phone/verify", response_model=AuthResponse)
async def phone_auth_verify(body: PhoneAuthVerifyRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        raise HTTPException(status_code=501, detail="Phone sign-in is only available with Cognito auth")

    auth_user, tokens = await provider.phone_auth_verify(
        body.phone, body.code, body.session, body.full_name, body.username
    )

    result = await db.execute(select(User).where(User.id == auth_user.id))
    user = result.scalar_one()

    return AuthResponse(
        user=user_to_public(user),
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
    )


@router.get("/oauth/config", response_model=OAuthConfigResponse)
async def oauth_config(db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        return OAuthConfigResponse(google_enabled=False)
    config = provider.get_oauth_config()
    return OAuthConfigResponse(**config)


@router.post("/oauth/callback", response_model=AuthResponse)
async def oauth_callback(body: OAuthCallbackRequest, db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        raise HTTPException(status_code=501, detail="OAuth sign-in is only available with Cognito auth")

    auth_user, tokens = await provider.exchange_oauth_code(body.code, body.redirect_uri)

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
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
):
    provider = get_auth_provider(db)
    access_token = credentials.credentials if credentials else None
    if isinstance(provider, CognitoAuthProvider):
        await provider.change_password(user.id, body.current_password, body.new_password, access_token)
    else:
        await provider.change_password(user.id, body.current_password, body.new_password)
    return {"message": "Password changed successfully"}
