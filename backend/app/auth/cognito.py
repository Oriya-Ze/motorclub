import uuid

import httpx
from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.base import AuthProvider, AuthTokens, AuthUser
from app.config import settings
from app.models import ProfileSettings, User

_jwks_cache: dict | None = None


class CognitoAuthProvider(AuthProvider):
    """AWS Cognito auth provider — activate with AUTH_PROVIDER=cognito."""

    def __init__(self, db: AsyncSession):
        self.db = db

    @property
    def jwks_url(self) -> str:
        return (
            f"https://cognito-idp.{settings.aws_region}.amazonaws.com/"
            f"{settings.cognito_user_pool_id}/.well-known/jwks.json"
        )

    def _cognito_client(self):
        try:
            import boto3
        except ImportError as exc:
            raise HTTPException(status_code=500, detail="boto3 not installed") from exc
        return boto3.client("cognito-idp", region_name=settings.aws_region)

    async def _get_jwks(self) -> dict:
        global _jwks_cache
        if _jwks_cache is None:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.jwks_url)
                response.raise_for_status()
                _jwks_cache = response.json()
        return _jwks_cache

    async def _get_or_create_user(self, cognito_sub: str, email: str, username: str, full_name: str) -> User:
        result = await self.db.execute(select(User).where(User.cognito_sub == cognito_sub))
        user = result.scalar_one_or_none()
        if user:
            return user

        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.cognito_sub = cognito_sub
            await self.db.commit()
            return user

        user = User(
            cognito_sub=cognito_sub,
            email=email,
            username=username,
            full_name=full_name,
        )
        self.db.add(user)
        await self.db.flush()
        self.db.add(ProfileSettings(user_id=user.id))
        await self.db.commit()
        await self.db.refresh(user)
        return user

    def _to_auth_user(self, user: User) -> AuthUser:
        return AuthUser(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            cognito_sub=user.cognito_sub,
        )

    async def register(self, email: str, username: str, full_name: str, password: str) -> AuthUser:
        client = self._cognito_client()
        try:
            client.sign_up(
                ClientId=settings.cognito_client_id,
                Username=email,
                Password=password,
                SecretHash=self._secret_hash(email) if settings.cognito_client_secret else None,
                UserAttributes=[
                    {"Name": "email", "Value": email},
                    {"Name": "name", "Value": full_name},
                    {"Name": "preferred_username", "Value": username},
                ],
            )
        except client.exceptions.UsernameExistsException:
            raise HTTPException(status_code=409, detail="Email already registered") from None
        except client.exceptions.InvalidPasswordException as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    async def confirm_sign_up(self, email: str, code: str, password: str) -> tuple[AuthUser, AuthTokens]:
        client = self._cognito_client()
        try:
            client.confirm_sign_up(
                ClientId=settings.cognito_client_id,
                Username=email,
                ConfirmationCode=code,
                SecretHash=self._secret_hash(email) if settings.cognito_client_secret else None,
            )
        except client.exceptions.CodeMismatchException:
            raise HTTPException(status_code=400, detail="Invalid verification code") from None
        except client.exceptions.ExpiredCodeException:
            raise HTTPException(status_code=400, detail="Verification code expired") from None
        except client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=400, detail="Account already confirmed") from None

        return await self.login(email, password)

    async def login(self, email: str, password: str) -> tuple[AuthUser, AuthTokens]:
        client = self._cognito_client()
        try:
            response = client.initiate_auth(
                ClientId=settings.cognito_client_id,
                AuthFlow="USER_PASSWORD_AUTH",
                AuthParameters={
                    "USERNAME": email,
                    "PASSWORD": password,
                    **({"SECRET_HASH": self._secret_hash(email)} if settings.cognito_client_secret else {}),
                },
            )
        except client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=401, detail="Invalid email or password") from None
        except client.exceptions.UserNotConfirmedException:
            raise HTTPException(
                status_code=403,
                detail="Email not verified. Enter the confirmation code sent to your email.",
            ) from None

        auth_result = response["AuthenticationResult"]
        access_token = auth_result["AccessToken"]
        payload = await self._decode_access_token(access_token)
        cognito_sub = payload["sub"]
        token_email = payload.get("email") or email
        username = payload.get("preferred_username") or payload.get("username") or token_email.split("@")[0]
        full_name = payload.get("name") or username
        user = await self._get_or_create_user(cognito_sub, token_email, username, full_name)
        auth_user = self._to_auth_user(user)
        tokens = AuthTokens(
            access_token=access_token,
            expires_in=auth_result.get("ExpiresIn"),
        )
        return auth_user, tokens

    async def _decode_access_token(self, token: str) -> dict:
        try:
            jwks = await self._get_jwks()
            unverified = jwt.get_unverified_header(token)
            key = next(k for k in jwks["keys"] if k["kid"] == unverified["kid"])
            issuer = f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}"
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=issuer,
                options={"verify_aud": False},
            )
            if payload.get("token_use") != "access":
                raise HTTPException(status_code=401, detail="Invalid Cognito token type")
            if payload.get("client_id") != settings.cognito_client_id:
                raise HTTPException(status_code=401, detail="Invalid Cognito client")
            return payload
        except (JWTError, StopIteration, KeyError) as exc:
            raise HTTPException(status_code=401, detail="Invalid Cognito token") from exc

    async def verify_token(self, token: str) -> AuthUser:
        payload = await self._decode_access_token(token)
        cognito_sub = payload["sub"]
        result = await self.db.execute(select(User).where(User.cognito_sub == cognito_sub))
        user = result.scalar_one_or_none()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return self._to_auth_user(user)

    async def forgot_password(self, email: str) -> None:
        client = self._cognito_client()
        client.forgot_password(
            ClientId=settings.cognito_client_id,
            Username=email,
            **({"SecretHash": self._secret_hash(email)} if settings.cognito_client_secret else {}),
        )

    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        client = self._cognito_client()
        client.confirm_forgot_password(
            ClientId=settings.cognito_client_id,
            Username=email,
            ConfirmationCode=code,
            Password=new_password,
            **({"SecretHash": self._secret_hash(email)} if settings.cognito_client_secret else {}),
        )

    async def change_password(
        self,
        user_id: uuid.UUID,
        current_password: str,
        new_password: str,
        access_token: str | None = None,
    ) -> None:
        if not access_token:
            raise HTTPException(status_code=400, detail="Access token required to change password")

        client = self._cognito_client()
        client.change_password(
            PreviousPassword=current_password,
            ProposedPassword=new_password,
            AccessToken=access_token,
        )

    def _secret_hash(self, username: str) -> str:
        import base64
        import hashlib
        import hmac

        message = username + settings.cognito_client_id
        dig = hmac.new(
            settings.cognito_client_secret.encode("utf-8"),
            message.encode("utf-8"),
            hashlib.sha256,
        ).digest()
        return base64.b64encode(dig).decode()
