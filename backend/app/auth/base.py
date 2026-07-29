from abc import ABC, abstractmethod
from dataclasses import dataclass
from uuid import UUID


@dataclass
class AuthUser:
    id: UUID
    email: str
    username: str
    full_name: str
    cognito_sub: str | None = None


@dataclass
class AuthTokens:
    access_token: str
    token_type: str = "bearer"
    expires_in: int | None = None


class AuthProvider(ABC):
    @abstractmethod
    async def register(
        self, email: str, username: str, full_name: str, password: str
    ) -> AuthUser:
        pass

    @abstractmethod
    async def login(self, email: str, password: str) -> tuple[AuthUser, AuthTokens]:
        pass

    @abstractmethod
    async def verify_token(self, token: str) -> AuthUser:
        pass

    @abstractmethod
    async def forgot_password(self, email: str) -> None:
        pass

    @abstractmethod
    async def reset_password(self, email: str, code: str, new_password: str) -> None:
        pass

    @abstractmethod
    async def change_password(self, user_id: UUID, current_password: str, new_password: str) -> None:
        pass
