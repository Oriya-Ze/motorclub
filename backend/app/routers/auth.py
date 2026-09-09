from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import get_auth_provider
from app.auth.cognito import CognitoAuthProvider
from app.auth.local import LocalAuthProvider, _create_access_token
from app.config import settings
from app.database import get_db
from app.deps import get_current_user, get_user_model, user_to_public
from app.models import User
from app.rate_limit import _client_ip, enforce_rate_limit
from app.schemas import (
    AuthResponse,
    ChangePasswordRequest,
    ConfirmSignUpRequest,
    ForgotPasswordRequest,
    LoginRequest,
    OAuthCallbackRequest,
    OAuthConfigResponse,
    RegisterRequest,
    ResendConfirmationRequest,
    ResetPasswordRequest,
    UserPublic,
    UsernameCheckResponse,
)
from app.services.auth_lookup import check_username_availability
from app.services.turnstile import verify_turnstile_token

router = APIRouter(prefix="/auth", tags=["auth"])
security = HTTPBearer(auto_error=False)


async def _require_captcha(request: Request, token: str | None) -> None:
    if not settings.turnstile_enabled:
        return
    await verify_turnstile_token(token or "", _client_ip(request))


@router.get("/check-username", response_model=UsernameCheckResponse)
async def check_username(
    request: Request,
    username: str = Query(min_length=1, max_length=30),
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:check-username", limit=60, window_seconds=3600)
    await enforce_rate_limit(
        request,
        "auth:check-username:name",
        identifier=username.strip().lower(),
        limit=30,
        window_seconds=3600,
    )
    result = await check_username_availability(db, username)
    return UsernameCheckResponse(**result)


@router.post("/register", response_model=AuthResponse)
async def register(body: RegisterRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _require_captcha(request, body.captcha_token)
    await enforce_rate_limit(request, "auth:register", limit=10, window_seconds=3600)
    await enforce_rate_limit(
        request,
        "auth:register:email",
        identifier=body.email,
        limit=5,
        window_seconds=3600,
    )
    provider = get_auth_provider(db)

    if isinstance(provider, CognitoAuthProvider):
        await provider.register(body.email, body.username, body.full_name, body.password)
        return AuthResponse(
            confirmation_required=True,
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
async def confirm_sign_up(body: ConfirmSignUpRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await enforce_rate_limit(request, "auth:confirm", limit=15, window_seconds=3600)
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


@router.post("/resend-confirmation")
async def resend_confirmation(
    body: ResendConfirmationRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    await enforce_rate_limit(request, "auth:resend", limit=8, window_seconds=3600)
    await enforce_rate_limit(
        request,
        "auth:resend:email",
        identifier=body.email,
        limit=5,
        window_seconds=3600,
    )
    provider = get_auth_provider(db)
    if not isinstance(provider, CognitoAuthProvider):
        raise HTTPException(status_code=501, detail="Account confirmation is only available with Cognito auth")

    await provider.resend_confirmation(body.email)
    return {"message": "If the email is pending verification, a new code was sent"}


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await _require_captcha(request, body.captcha_token)
    await enforce_rate_limit(request, "auth:login", limit=30, window_seconds=3600)
    await enforce_rate_limit(
        request,
        "auth:login:email",
        identifier=body.email,
        limit=15,
        window_seconds=3600,
    )
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


@router.get("/oauth/config", response_model=OAuthConfigResponse)
async def oauth_config(db: AsyncSession = Depends(get_db)):
    provider = get_auth_provider(db)
    if isinstance(provider, CognitoAuthProvider):
        config = provider.get_oauth_config()
    else:
        config = {"google_enabled": False}
    return OAuthConfigResponse(
        **config,
        turnstile_enabled=settings.turnstile_enabled,
        turnstile_site_key=settings.turnstile_site_key or None,
    )


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
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)):
    await enforce_rate_limit(request, "auth:forgot", limit=3, window_seconds=3600)
    await enforce_rate_limit(
        request,
        "auth:forgot:email",
        identifier=body.email,
        limit=5,
        window_seconds=3600,
    )
    provider = get_auth_provider(db)
    await provider.forgot_password(body.email)
    return {"message": "If the email exists, a verification code was sent to your email"}


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
