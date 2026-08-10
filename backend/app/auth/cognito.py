import uuid

import httpx
from app.auth.phone_utils import normalize_phone, phone_placeholder_email, random_password
from fastapi import HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.base import AuthProvider, AuthTokens, AuthUser
from app.config import settings
from app.models import ProfileSettings, User

_jwks_cache: dict | None = None


def _is_uuid_like(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except (ValueError, AttributeError, TypeError):
        return False


def _needs_better_username(username: str | None, cognito_sub: str | None) -> bool:
    cleaned = (username or "").strip()
    if not cleaned:
        return True
    if cognito_sub and cleaned == cognito_sub:
        return True
    return _is_uuid_like(cleaned)


def _needs_better_full_name(full_name: str | None, username: str | None, cognito_sub: str | None) -> bool:
    cleaned = (full_name or "").strip()
    if not cleaned:
        return True
    if cognito_sub and cleaned == cognito_sub:
        return True
    if username and cleaned == username and _is_uuid_like(username):
        return True
    return False


def _resolve_username_from_claims(payload: dict, email: str) -> str:
    preferred = (payload.get("preferred_username") or "").strip()
    if preferred:
        return preferred

    claim_username = (payload.get("username") or "").strip()
    if claim_username and "@" in claim_username:
        return claim_username.split("@", 1)[0]
    if claim_username and not _is_uuid_like(claim_username):
        return claim_username

    if email and "@" in email:
        return email.split("@", 1)[0]
    return claim_username or "user"


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

    @property
    def issuer(self) -> str:
        return f"https://cognito-idp.{settings.aws_region}.amazonaws.com/{settings.cognito_user_pool_id}"

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

    async def _decode_token(self, token: str, *, expected_use: str) -> dict:
        try:
            jwks = await self._get_jwks()
            unverified = jwt.get_unverified_header(token)
            key = next(k for k in jwks["keys"] if k["kid"] == unverified["kid"])
            payload = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                issuer=self.issuer,
                options={"verify_aud": False},
            )
            if payload.get("token_use") != expected_use:
                raise HTTPException(status_code=401, detail="Invalid Cognito token type")

            if expected_use == "access":
                if payload.get("client_id") != settings.cognito_client_id:
                    raise HTTPException(status_code=401, detail="Invalid Cognito client")
            elif payload.get("aud") != settings.cognito_client_id:
                raise HTTPException(status_code=401, detail="Invalid Cognito client")

            return payload
        except (JWTError, StopIteration, KeyError) as exc:
            raise HTTPException(status_code=401, detail="Invalid Cognito token") from exc

    async def _decode_access_token(self, token: str) -> dict:
        return await self._decode_token(token, expected_use="access")

    async def _decode_id_token(self, token: str) -> dict:
        return await self._decode_token(token, expected_use="id")

    def _fetch_cognito_user_attributes(self, login_email: str) -> dict[str, str]:
        client = self._cognito_client()
        response = client.admin_get_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=login_email,
        )
        return {attr["Name"]: attr["Value"] for attr in response.get("UserAttributes", [])}

    def _profile_from_claims(self, payload: dict, login_email: str, attrs: dict[str, str] | None = None) -> tuple[str, str, str]:
        attrs = attrs or {}
        email = (payload.get("email") or attrs.get("email") or login_email).strip()
        username = _resolve_username_from_claims(
            {
                "preferred_username": payload.get("preferred_username") or attrs.get("preferred_username"),
                "username": payload.get("username") or attrs.get("username"),
            },
            email,
        )
        full_name = (payload.get("name") or attrs.get("name") or "").strip() or username
        return email, username[:50], full_name[:255]

    async def _ensure_unique_username(self, username: str, exclude_user_id: uuid.UUID | None = None) -> str:
        candidate = username[:50]
        base = candidate
        suffix = 1
        while True:
            query = select(User).where(User.username == candidate)
            if exclude_user_id:
                query = query.where(User.id != exclude_user_id)
            existing = await self.db.scalar(query)
            if not existing:
                return candidate
            candidate = f"{base[:45]}_{suffix}"
            suffix += 1

    async def _apply_profile_updates(
        self,
        user: User,
        email: str,
        username: str,
        full_name: str,
    ) -> User:
        updated = False

        if email and "@" in email and (not user.email or "@" not in user.email):
            user.email = email
            updated = True

        if _needs_better_username(user.username, user.cognito_sub) and username:
            unique_username = await self._ensure_unique_username(username, user.id)
            if user.username != unique_username:
                user.username = unique_username
                updated = True

        if _needs_better_full_name(user.full_name, user.username, user.cognito_sub) and full_name:
            user.full_name = full_name
            updated = True

        if updated:
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def _get_or_create_user(
        self,
        cognito_sub: str,
        email: str,
        username: str,
        full_name: str,
        phone_number: str | None = None,
    ) -> User:
        result = await self.db.execute(select(User).where(User.cognito_sub == cognito_sub))
        user = result.scalar_one_or_none()
        if user:
            if phone_number and not user.phone_number:
                user.phone_number = phone_number
                await self.db.commit()
                await self.db.refresh(user)
            return await self._apply_profile_updates(user, email, username, full_name)

        if phone_number:
            result = await self.db.execute(select(User).where(User.phone_number == phone_number))
            user = result.scalar_one_or_none()
            if user:
                user.cognito_sub = cognito_sub
                await self.db.commit()
                return await self._apply_profile_updates(user, email, username, full_name)

        result = await self.db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user:
            user.cognito_sub = cognito_sub
            if phone_number:
                user.phone_number = phone_number
            await self.db.commit()
            return await self._apply_profile_updates(user, email, username, full_name)

        unique_username = await self._ensure_unique_username(username)
        user = User(
            cognito_sub=cognito_sub,
            email=email,
            username=unique_username,
            full_name=full_name,
            phone_number=phone_number,
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
        return await self._complete_auth_from_tokens(auth_result, fallback_email=email)

    @property
    def google_oauth_enabled(self) -> bool:
        return bool(settings.cognito_domain and settings.cognito_client_secret)

    def get_oauth_config(self) -> dict:
        if not self.google_oauth_enabled:
            return {"google_enabled": False}
        return {
            "google_enabled": True,
            "client_id": settings.cognito_client_id,
            "cognito_domain": settings.cognito_domain,
            "region": settings.aws_region,
        }

    async def exchange_oauth_code(self, code: str, redirect_uri: str) -> tuple[AuthUser, AuthTokens]:
        if not self.google_oauth_enabled:
            raise HTTPException(status_code=501, detail="Google sign-in is not configured")

        token_url = (
            f"https://{settings.cognito_domain}.auth.{settings.aws_region}.amazoncognito.com/oauth2/token"
        )
        data = {
            "grant_type": "authorization_code",
            "client_id": settings.cognito_client_id,
            "code": code,
            "redirect_uri": redirect_uri,
        }
        if settings.cognito_client_secret:
            data["client_secret"] = settings.cognito_client_secret

        async with httpx.AsyncClient() as client:
            response = await client.post(
                token_url,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

        if response.status_code != 200:
            raise HTTPException(status_code=401, detail="OAuth sign-in failed")

        auth_result = response.json()
        if "access_token" not in auth_result:
            raise HTTPException(status_code=401, detail="OAuth sign-in failed")

        normalized = {
            "AccessToken": auth_result["access_token"],
            "ExpiresIn": auth_result.get("expires_in"),
            "IdToken": auth_result.get("id_token"),
        }
        return await self._complete_auth_from_tokens(normalized)

    async def _complete_auth_from_tokens(
        self,
        auth_result: dict,
        *,
        fallback_email: str = "",
    ) -> tuple[AuthUser, AuthTokens]:
        access_token = auth_result.get("AccessToken") or auth_result.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Invalid auth response")

        access_payload = await self._decode_access_token(access_token)
        cognito_sub = access_payload["sub"]

        profile_payload = access_payload
        id_token = auth_result.get("IdToken") or auth_result.get("id_token")
        if id_token:
            profile_payload = await self._decode_id_token(id_token)

        lookup_email = profile_payload.get("email") or fallback_email
        attrs: dict[str, str] = {}
        if lookup_email and (not profile_payload.get("preferred_username") or not profile_payload.get("name")):
            try:
                attrs = self._fetch_cognito_user_attributes(lookup_email)
            except Exception:
                attrs = {}

        token_email, username, full_name = self._profile_from_claims(profile_payload, lookup_email, attrs)
        user = await self._get_or_create_user(cognito_sub, token_email, username, full_name)
        auth_user = self._to_auth_user(user)
        tokens = AuthTokens(
            access_token=access_token,
            expires_in=auth_result.get("ExpiresIn") or auth_result.get("expires_in"),
        )
        return auth_user, tokens

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

    def _auth_params(self, username: str) -> dict[str, str]:
        params = {"USERNAME": username}
        if settings.cognito_client_secret:
            params["SECRET_HASH"] = self._secret_hash(username)
        return params

    def _create_cognito_phone_user(
        self,
        phone: str,
        full_name: str,
        username: str | None = None,
    ) -> None:
        client = self._cognito_client()
        display_name = full_name.strip()
        preferred = (username or display_name).strip()[:256]
        client.admin_create_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=phone,
            MessageAction="SUPPRESS",
            UserAttributes=[
                {"Name": "phone_number", "Value": phone},
                {"Name": "phone_number_verified", "Value": "true"},
                {"Name": "name", "Value": display_name},
                {"Name": "preferred_username", "Value": preferred},
                {"Name": "email", "Value": phone_placeholder_email(phone)},
                {"Name": "email_verified", "Value": "true"},
            ],
        )
        client.admin_set_user_password(
            UserPoolId=settings.cognito_user_pool_id,
            Username=phone,
            Password=random_password(),
            Permanent=True,
        )

    async def phone_auth_start(
        self,
        phone: str,
        full_name: str | None = None,
        username: str | None = None,
    ) -> dict:
        normalized = normalize_phone(phone)
        client = self._cognito_client()
        try:
            client.admin_get_user(UserPoolId=settings.cognito_user_pool_id, Username=normalized)
        except client.exceptions.UserNotFoundException:
            if not full_name:
                return {"needs_registration": True, "phone": normalized}
            self._create_cognito_phone_user(normalized, full_name, username)

        try:
            response = client.initiate_auth(
                ClientId=settings.cognito_client_id,
                AuthFlow="CUSTOM_AUTH",
                AuthParameters=self._auth_params(normalized),
            )
        except client.exceptions.InvalidParameterException as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        if response.get("ChallengeName") != "CUSTOM_CHALLENGE":
            raise HTTPException(status_code=500, detail="Unexpected auth challenge")

        return {
            "needs_registration": False,
            "session": response["Session"],
            "phone": normalized,
            "message": "SMS code sent",
        }

    async def phone_auth_verify(
        self,
        phone: str,
        code: str,
        session: str,
        full_name: str | None = None,
        username: str | None = None,
    ) -> tuple[AuthUser, AuthTokens]:
        normalized = normalize_phone(phone)
        client = self._cognito_client()
        try:
            client.admin_get_user(UserPoolId=settings.cognito_user_pool_id, Username=normalized)
        except client.exceptions.UserNotFoundException:
            if not full_name:
                raise HTTPException(status_code=400, detail="Registration details required") from None
            self._create_cognito_phone_user(normalized, full_name, username)

        try:
            response = client.respond_to_auth_challenge(
                ClientId=settings.cognito_client_id,
                ChallengeName="CUSTOM_CHALLENGE",
                Session=session,
                ChallengeResponses={
                    "USERNAME": normalized,
                    "ANSWER": code.strip(),
                    **({"SECRET_HASH": self._secret_hash(normalized)} if settings.cognito_client_secret else {}),
                },
            )
        except client.exceptions.NotAuthorizedException:
            raise HTTPException(status_code=400, detail="Invalid or expired verification code") from None

        auth_result = response.get("AuthenticationResult")
        if not auth_result:
            raise HTTPException(status_code=400, detail="Verification failed")

        attrs = self._fetch_cognito_user_attributes(normalized)
        email = attrs.get("email") or phone_placeholder_email(normalized)
        display_name = (full_name or attrs.get("name") or normalized).strip()
        preferred_username = (username or attrs.get("preferred_username") or display_name).strip()

        access_token = auth_result.get("AccessToken") or auth_result.get("access_token")
        if not access_token:
            raise HTTPException(status_code=401, detail="Invalid auth response")

        access_payload = await self._decode_access_token(access_token)
        cognito_sub = access_payload["sub"]
        user = await self._get_or_create_user(
            cognito_sub,
            email,
            preferred_username,
            display_name,
            phone_number=normalized,
        )
        tokens = AuthTokens(
            access_token=access_token,
            expires_in=auth_result.get("ExpiresIn") or auth_result.get("expires_in"),
        )
        return self._to_auth_user(user), tokens
