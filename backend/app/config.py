from typing import Literal

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_INSECURE_JWT_SECRETS = frozenset(
    {
        "dev-secret",
        "change-me-in-production-use-long-random-string",
        "dev-secret-change-in-production",
    }
)

_LOCAL_DATABASE_URL = "postgresql+asyncpg://motorclub:motorclub_dev@localhost:5432/motorclub"
_LOCAL_JWT_SECRET = "dev-secret"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "local"
    log_level: str = "INFO"
    app_version: str = "dev"
    service_name: str = "motorclub-api"

    database_url: str = ""
    auth_provider: Literal["local", "cognito"] = "local"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    aws_region: str = "eu-west-1"
    cognito_user_pool_id: str = ""
    cognito_client_id: str = ""
    cognito_client_secret: str = ""
    backend_cors_origins: str = ""
    upload_dir: str = "./uploads"
    media_storage_provider: Literal["local", "s3"] = "local"
    media_base_url: str = ""
    s3_media_bucket: str = ""
    s3_presigned_url_expiry_seconds: int = 300
    max_image_upload_bytes: int = 10 * 1024 * 1024
    max_video_upload_bytes: int = 10 * 1024 * 1024

    @field_validator("environment")
    @classmethod
    def normalize_environment(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("log_level")
    @classmethod
    def normalize_log_level(cls, value: str) -> str:
        return value.strip().upper()

    @field_validator("auth_provider")
    @classmethod
    def normalize_auth_provider(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("media_storage_provider")
    @classmethod
    def normalize_media_storage_provider(cls, value: str) -> str:
        return value.strip().lower()

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.backend_cors_origins.split(",") if origin.strip()]

    @property
    def is_local(self) -> bool:
        return self.environment == "local"

    @model_validator(mode="after")
    def apply_environment_defaults_and_validation(self) -> "Settings":
        if self.media_storage_provider == "s3":
            if not self.s3_media_bucket:
                raise ValueError("S3_MEDIA_BUCKET is required when MEDIA_STORAGE_PROVIDER=s3")
            if not self.aws_region:
                raise ValueError("AWS_REGION is required when MEDIA_STORAGE_PROVIDER=s3")

        if self.is_local:
            if not self.database_url:
                self.database_url = _LOCAL_DATABASE_URL
            if not self.jwt_secret:
                self.jwt_secret = _LOCAL_JWT_SECRET
            if not self.backend_cors_origins:
                self.backend_cors_origins = "http://localhost:5173,http://localhost:3000,http://localhost"
            return self

        if not self.database_url:
            raise ValueError("DATABASE_URL is required when ENVIRONMENT is not 'local'")

        if not self.backend_cors_origins:
            raise ValueError("BACKEND_CORS_ORIGINS is required when ENVIRONMENT is not 'local'")

        if self.auth_provider == "local":
            if not self.jwt_secret:
                raise ValueError("JWT_SECRET is required when AUTH_PROVIDER=local and ENVIRONMENT is not 'local'")
            if len(self.jwt_secret) < 32:
                raise ValueError("JWT_SECRET must be at least 32 characters when ENVIRONMENT is not 'local'")
            if self.jwt_secret in _INSECURE_JWT_SECRETS:
                raise ValueError("JWT_SECRET uses an insecure default value")

        if self.auth_provider == "cognito":
            if not self.cognito_user_pool_id:
                raise ValueError("COGNITO_USER_POOL_ID is required when AUTH_PROVIDER=cognito")
            if not self.cognito_client_id:
                raise ValueError("COGNITO_CLIENT_ID is required when AUTH_PROVIDER=cognito")

        return self


settings = Settings()
